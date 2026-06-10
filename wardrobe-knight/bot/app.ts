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
import { outfitMessage, savedItemMessage, editItemModal, wardrobeList } from './blocks.js';
import type { DayWeather } from '../types/weather.js';
import type { AgendaSummary } from '../types/agenda.js';
import type { OutfitRecommendation } from '../types/outfit.js';

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET ?? '',
  processBeforeResponse: true,
  endpoints: '/api/slack/events',
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
  processBeforeResponse: true,
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

// Dedup: track processed event timestamps to prevent duplicate processing
const processedEvents = new Set<string>();

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
  // Database-level dedup: skip if an item with this image URL already exists
  if (imageFile.permalink) {
    const existing = await sheets.getAll();
    if (existing.some(i => i.imageUrl === imageFile.permalink)) return;
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
  const item: ClothingItem = {
    id: generatedId,
    categorie: parsed.categorie ?? '',
    sousCategorie: parsed.sousCategorie ?? '',
    marque: parsed.marque ?? '',
    modele: parsed.modele ?? '',
    couleur: parsed.couleur ?? 'gris',
    palette: parsed.palette ?? 'neutre',
    matiere: parsed.matiere ?? '',
    coupe: parsed.coupe ?? '',
    niveau: parsed.niveau ?? 'casual',
    saison: parsed.saison ?? 'toutes',
    formalite: parsed.formalite ?? 3,
    impact: parsed.impact ?? 3,
    polyvalence: parsed.polyvalence ?? 3,
    etat: parsed.etat ?? 'neuf',
    imageUrl: imageFile.permalink,
  };
  await sheets.append(item);
  await say({ blocks: savedItemMessage(item) as any });
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
  if (msg.bot_id) return;

  // In-memory dedup: skip if this event timestamp was already processed
  const eventKey = msg.event_ts || msg.ts;
  if (processedEvents.has(eventKey)) return;
  processedEvents.add(eventKey);

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
      const item: ClothingItem = {
        id: generatedId,
        categorie: parsed.categorie ?? '',
        sousCategorie: parsed.sousCategorie ?? '',
        marque: parsed.marque ?? '',
        modele: parsed.modele ?? '',
        couleur: parsed.couleur ?? 'gris',
        palette: parsed.palette ?? 'neutre',
        matiere: parsed.matiere ?? '',
        coupe: parsed.coupe ?? '',
        niveau: parsed.niveau ?? 'casual',
        saison: parsed.saison ?? 'toutes',
        formalite: parsed.formalite ?? 3,
        impact: parsed.impact ?? 3,
        polyvalence: parsed.polyvalence ?? 3,
        etat: parsed.etat ?? 'neuf',
      };
      await sheets.append(item);
      await say({ blocks: savedItemMessage(item) as any });
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

app.action('edit_item', async ({ ack, action, body, client }) => {
  await ack();
  try {
    const itemId = 'value' in action ? (action.value as string) : '';
    const item = await sheets.getById(itemId);
    if (!item) return;
    await client.views.open({
      trigger_id: (body as any).trigger_id,
      view: editItemModal(item) as any,
    });
  } catch (err) {
    console.error('[EDIT_ITEM]', err);
  }
});

app.view('edit_item_modal', async ({ ack, view, body, client }) => {
  await ack();
  try {
    const itemId = view.private_metadata;
    const v = view.state.values;
    const text = (blockId: string) => v[blockId]?.[blockId]?.value ?? '';
    const select = (blockId: string) => v[blockId]?.[blockId]?.selected_option?.value ?? '';

    const fields: Partial<ClothingItem> = {
      categorie: text('categorie'),
      sousCategorie: text('sousCategorie'),
      marque: text('marque'),
      modele: text('modele'),
      couleur: text('couleur'),
      palette: (select('palette') || 'neutre') as ClothingItem['palette'],
      matiere: text('matiere'),
      coupe: text('coupe'),
      niveau: select('niveau') || 'casual',
      saison: select('saison') || 'toutes',
      formalite: parseInt(text('formalite') || '3', 10) || 3,
      impact: parseInt(text('impact') || '3', 10) || 3,
      polyvalence: parseInt(text('polyvalence') || '3', 10) || 3,
      etat: (select('etat') || 'neuf') as ClothingItem['etat'],
    };

    await sheets.update(itemId, fields);
    const name = `${fields.categorie} ${fields.sousCategorie}`.trim();
    await client.chat.postMessage({
      channel: (body as any).user.id,
      text: `:white_check_mark: *${name}* (${itemId}) mis à jour.`,
    });
  } catch (err) {
    console.error('[EDIT_MODAL]', err);
  }
});

app.error(async (error) => {
  console.error('[ERROR DETAIL]', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
});

export { app, receiver };
