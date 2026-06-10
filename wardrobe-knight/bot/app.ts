/**
 * Wardrobe Knight — Slack Bot App
 *
 * Shared Slack Bolt app definition for both local HTTP development and Vercel.
 */

import { App, ExpressReceiver } from '@slack/bolt';
import { generateOutfit, regenerateOutfit } from '../engine/index.js';
import { buildDailyContext } from '../engine/context.js';
import { toWardrobeItems } from '../types/adapter.js';
import type { ClothingItem } from '../types/wardrobe.js';
import * as sheets from '../services/sheets.js';
import { fetchWeather, getUserLocation, formatWeatherSlack } from '../services/weather.js';
import { fetchTodayAgenda, formatAgendaSlack } from '../services/calendar.js';
import { parseAddItem, parseAddItemFromImage, isAddItemIntent } from '../services/parser.js';
import { outfitMessage, confirmAddItem, wardrobeList } from './blocks.js';
import type { DayWeather } from '../types/weather.js';
import type { AgendaSummary } from '../types/agenda.js';
import type { OutfitRecommendation } from '../types/outfit.js';

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET ?? '',
  processBeforeResponse: false,
  endpoints: '/api/slack/events',
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
  processBeforeResponse: false,
});

// --- State cache (per-instance, regeneration needs previous outfit) ---
let lastRecommendation: OutfitRecommendation | null = null;
let lastItems: ClothingItem[] = [];
let lastWeather: DayWeather | null = null;
let lastAgenda: AgendaSummary | null = null;

async function getOutfitContext() {
  const loc = getUserLocation();
  const [weather, agenda, items] = await Promise.all([
    fetchWeather(loc.lat, loc.lon),
    fetchTodayAgenda(),
    sheets.getAll(),
  ]);

  lastItems = items;
  lastWeather = weather;
  lastAgenda = agenda;

  const wardrobeItems = toWardrobeItems(items);
  const context = buildDailyContext(weather, agenda);

  return { weather, agenda, items, wardrobeItems, context };
}

app.command('/outfit', async ({ ack, respond }) => {
  await ack();
  try {
    const { weather, items, wardrobeItems, context } = await getOutfitContext();
    const recommendation = generateOutfit(wardrobeItems, context);
    lastRecommendation = recommendation;
    await respond({ blocks: outfitMessage(recommendation, items, weather) as any });
  } catch (err) {
    await respond(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
});

app.command('/armoire', async ({ ack, respond }) => {
  await ack();
  try {
    const items = await sheets.getAll();
    await respond({ blocks: wardrobeList(items) as any });
  } catch (err) {
    await respond(`:x: Erreur lors de la lecture de l'armoire : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
});

app.command('/agenda', async ({ ack, respond }) => {
  await ack();
  try {
    const agenda = await fetchTodayAgenda();
    lastAgenda = agenda;
    await respond(formatAgendaSlack(agenda));
  } catch (err) {
    await respond(`:x: Erreur lors de la lecture de l'agenda : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
});

app.command('/meteo', async ({ ack, respond }) => {
  await ack();
  try {
    const loc = getUserLocation();
    const weather = await fetchWeather(loc.lat, loc.lon);
    lastWeather = weather;
    await respond(formatWeatherSlack(weather));
  } catch (err) {
    await respond(`:x: Erreur lors de la récupération de la météo : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
});

function isDM(message: { channel_type?: string }): boolean {
  return message.channel_type === 'im';
}

async function generateAndSendOutfit(say: (msg: any) => Promise<any>) {
  const { weather, items, wardrobeItems, context } = await getOutfitContext();
  const recommendation = generateOutfit(wardrobeItems, context);
  lastRecommendation = recommendation;
  await say({ blocks: outfitMessage(recommendation, items, weather) as any });
}

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

async function downloadSlackFile(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function findImageFile(files: any[]): { mimetype: string; url_private_download?: string; permalink?: string } | undefined {
  return files.find(
    (f: any) => f.mimetype && IMAGE_MIME_TYPES.includes(f.mimetype),
  );
}

async function handleImageMessage(
  imageFile: { mimetype: string; url_private_download?: string; permalink?: string },
  userText: string | undefined,
  say: (msg: any) => Promise<any>,
): Promise<void> {
  if (!imageFile.url_private_download) {
    await say(':x: Je ne peux pas accéder à la photo. Vérifie que le bot a le scope `files:read`.');
    return;
  }
  await say(':hourglass_flowing_sand: J\'analyse la photo...');
  const buffer = await downloadSlackFile(imageFile.url_private_download);
  const base64 = buffer.toString('base64');
  const parsed = await parseAddItemFromImage(base64, imageFile.mimetype, userText || undefined);
  if (!parsed.categorie) {
    await say(':x: Je n\'ai pas pu identifier le vêtement sur la photo. Essaie avec une meilleure image ou ajoute une description.');
    return;
  }
  const generatedId = await sheets.generateId(parsed.categorie);
  const imageUrl = imageFile.permalink;
  await say({ blocks: confirmAddItem(parsed, generatedId, imageUrl) as any });
}

const OUTFIT_PATTERN = /je\s+mets?\s+quoi|quoi\s+porter|outfit|qu[ée]\s+me\s+pongo|tenue/i;
const GREETING_PATTERN = /^(bonjour|salut|hello|hey|hi|coucou|bonsoir)\b/i;
const ARMOIRE_PATTERN = /armoire|armario|wardrobe|garde-?robe|voir.*vêtements|mes\s+vêtements/i;
const AGENDA_PATTERN = /agenda|calendrier|calendar|réunion|événements|eventos/i;
const METEO_PATTERN = /météo|meteo|weather|temps\s+qu'il\s+fait|clima/i;
const HELP_PATTERN = /aide|help|ayuda|commandes?|commands?|que\s+(sais|peux|puedes)/i;

// Handle file_share subtype (Slack sends photos as messages with this subtype)
app.event('message', async ({ event, say }) => {
  const msg = event as any;
  if (msg.subtype !== 'file_share') return;

  const files = msg.files ?? [];
  const imageFile = findImageFile(files);
  if (!imageFile) return;

  try {
    const userText = msg.text || undefined;
    await handleImageMessage(imageFile, userText, say);
  } catch (err) {
    await say(`:x: Erreur lors de l'analyse de la photo : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
});

app.message(async ({ message, say }) => {
  // Check for images in regular messages (non-file_share subtype)
  const files = 'files' in message ? (message.files ?? []) : [];
  const imageFile = findImageFile(files);
  if (imageFile) {
    try {
      const userText = 'text' in message ? (message.text ?? '') : '';
      await handleImageMessage(imageFile, userText, say);
    } catch (err) {
      await say(`:x: Erreur lors de l'analyse de la photo : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
    return;
  }

  if (message.type !== 'message' || !('text' in message) || !message.text) return;

  const text = message.text;

  if (OUTFIT_PATTERN.test(text)) {
    try {
      await generateAndSendOutfit(say);
    } catch (err) {
      await say(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
    return;
  }

  if (isAddItemIntent(text)) {
    try {
      const parsed = await parseAddItem(text);
      if (!parsed.categorie) {
        await say('Je n\'ai pas pu détecter le type de vêtement. Essaie avec plus de détails (ex : « ajoute un jean noir slim de Zara formalité 2 »)');
        return;
      }
      const generatedId = await sheets.generateId(parsed.categorie);
      await say({ blocks: confirmAddItem(parsed, generatedId) as any });
    } catch (err) {
      await say(`:x: Erreur d'interprétation : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
    return;
  }

  if (ARMOIRE_PATTERN.test(text)) {
    try {
      const items = await sheets.getAll();
      await say({ blocks: wardrobeList(items) as any });
    } catch (err) {
      await say(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
    return;
  }

  if (AGENDA_PATTERN.test(text)) {
    try {
      const agenda = await fetchTodayAgenda();
      lastAgenda = agenda;
      await say(formatAgendaSlack(agenda));
    } catch (err) {
      await say(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
    return;
  }

  if (METEO_PATTERN.test(text)) {
    try {
      const loc = getUserLocation();
      const weather = await fetchWeather(loc.lat, loc.lon);
      lastWeather = weather;
      await say(formatWeatherSlack(weather));
    } catch (err) {
      await say(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
    return;
  }

  if (HELP_PATTERN.test(text)) {
    await say(`:shield: *Wardrobe Knight — Commandes*\n\n`
      + `• *« je mets quoi ? »* ou */outfit* — Tenue du jour\n`
      + `• *« armoire »* ou */armoire* — Voir tes vêtements\n`
      + `• *« agenda »* ou */agenda* — Événements du jour\n`
      + `• *« météo »* ou */meteo* — Météo du jour\n`
      + `• *« ajoute [vêtement] »* — Ajouter un vêtement\n`
      + `• *:camera: Envoie une photo* — Ajouter un vêtement par photo\n`
      + `• *« aide »* — Ce message`);
    return;
  }

  if (isDM(message)) {
    if (GREETING_PATTERN.test(text)) {
      try {
        await say(':shield: Bonjour ! Voici ta tenue du jour :');
        await generateAndSendOutfit(say);
      } catch (err) {
        await say(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      }
      return;
    }

    await say(`:shield: Je n'ai pas compris. Essaie :\n`
      + `• *« je mets quoi ? »* — Tenue du jour\n`
      + `• *« armoire »* — Tes vêtements\n`
      + `• *« agenda »* — Ton agenda\n`
      + `• *« météo »* — La météo\n`
      + `• *« aide »* — Toutes les commandes`);
  }
});

app.action('regenerate_outfit', async ({ ack, respond }) => {
  await ack();
  try {
    const { weather, items, wardrobeItems, context } = await getOutfitContext();
    const excludeIds = lastRecommendation
      ? [lastRecommendation.wear.top, lastRecommendation.wear.bottom].filter(Boolean) as string[]
      : [];
    const recommendation = regenerateOutfit(wardrobeItems, context, excludeIds);
    lastRecommendation = recommendation;
    await respond({ replace_original: true, blocks: outfitMessage(recommendation, items, weather) as any });
  } catch (err) {
    await respond(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
});

app.action('more_formal', async ({ ack, respond }) => {
  await ack();
  try {
    const { weather, items, wardrobeItems, context } = await getOutfitContext();
    context.agenda = { ...context.agenda, highestFormality: 'formal' };
    const recommendation = generateOutfit(wardrobeItems, context);
    lastRecommendation = recommendation;
    await respond({ replace_original: true, blocks: outfitMessage(recommendation, items, weather) as any });
  } catch (err) {
    await respond(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
});

app.action('view_agenda', async ({ ack, respond }) => {
  await ack();
  try {
    const agenda = lastAgenda ?? await fetchTodayAgenda();
    await respond(formatAgendaSlack(agenda));
  } catch (err) {
    await respond(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
});

app.action('confirm_add_item', async ({ ack, action, respond }) => {
  await ack();
  try {
    const payload = 'value' in action ? JSON.parse(action.value as string) : {};
    const item: ClothingItem = {
      id: payload.id,
      categorie: payload.categorie ?? '',
      sousCategorie: payload.sousCategorie ?? '',
      marque: payload.marque ?? '',
      modele: payload.modele ?? '',
      couleur: payload.couleur ?? 'gris',
      palette: payload.palette ?? 'neutre',
      matiere: payload.matiere ?? '',
      coupe: payload.coupe ?? '',
      niveau: payload.niveau ?? 'casual',
      saison: payload.saison ?? 'toutes',
      formalite: payload.formalite ?? 3,
      impact: payload.impact ?? 3,
      polyvalence: payload.polyvalence ?? 3,
      etat: payload.etat ?? 'neuf',
      imageUrl: payload.imageUrl ?? undefined,
    };

    await sheets.append(item);
    const name = `${item.categorie} ${item.sousCategorie}`.trim();
    await respond({
      replace_original: true,
      text: `:white_check_mark: *${name}* (${item.id}) enregistré dans ton armoire.`,
    });
  } catch (err) {
    await respond(`:x: Erreur lors de l'enregistrement : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
});

app.action('cancel_add_item', async ({ ack, respond }) => {
  await ack();
  await respond({ replace_original: true, text: ':x: Annulé. Le vêtement n\'a pas été enregistré.' });
});

app.error(async (error) => {
  console.error('[ERROR DETAIL]', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
});

export { app, receiver };
