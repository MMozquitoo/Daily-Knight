/**
 * Mage Stylist — Slack Bot App
 *
 * Shared Slack Bolt app definition for both local HTTP development and Vercel.
 */

import { App, ExpressReceiver } from '@slack/bolt';
import { signFileUrl } from '../api/_sign.js';
import { generateOutfit, regenerateOutfit } from '../engine/index.js';
import { buildDailyContext } from '../engine/context.js';
import { toWardrobeItems } from '../types/adapter.js';
import type { ClothingItem } from '../types/wardrobe.js';
import * as sheets from '../services/sheets.js';
import { fetchWeather, getUserLocation, formatWeatherSlack } from '../services/weather.js';
import { resolveDayPlace } from '../services/destination.js';
import { fetchTodayAgenda, formatAgendaSlack } from '../services/calendar.js';
import { todayStr, daysAgo } from '../services/dates.js';
import { parseAddItem, parseAddItemFromImage, isAddItemIntent } from '../services/parser.js';
import { askAdvisor, clearHistory } from '../services/advisor.js';
import { generateTryOn } from '../services/tryon.js';
import { computeStats } from '../services/stats.js';
import sharp from 'sharp';
import { outfitMessage, savedItemMessage, editItemModal, wardrobeList, statsMessage } from './blocks.js';
import { afterAck } from './defer.js';
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

function buildCooldownMap(history: sheets.WornEntry[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const entry of history) {
    // Anchored to Europe/Paris, so it agrees with how todayStr() writes the log
    const daysDiff = daysAgo(entry.date);
    for (const id of [entry.top, entry.bottom, entry.shoes, entry.outerwear]) {
      if (!id) continue;
      const existing = map.get(id);
      if (existing === undefined || daysDiff < existing) {
        map.set(id, daysDiff);
      }
    }
  }
  return map;
}

async function getOutfitContext() {
  const [agenda, items, wornHistory, feedbackScores] = await Promise.all([
    fetchTodayAgenda(),
    sheets.getAll(),
    sheets.getWornRecently(7),
    sheets.getFeedbackScores().catch(() => new Map<string, number>()),
  ]);

  // The agenda decides where the day happens, so it has to come first
  const place = await resolveDayPlace(agenda);
  const weather = place.weather;

  lastItems = items;
  lastWeather = weather;
  lastAgenda = agenda;

  const wardrobeItems = toWardrobeItems(items);
  const context = buildDailyContext(weather, agenda, 'mixed', place.name);
  const recentlyWorn = buildCooldownMap(wornHistory);

  return { weather, agenda, items, wardrobeItems, context, recentlyWorn, feedbackScores };
}

app.command('/outfit', async ({ ack, respond }) => {
  // Ack now, work later — the outfit pipeline (agenda + sheet + weather + engine)
  // can exceed Slack's 3s on a cold start; afterAck flushes the ack immediately and
  // finishes under waitUntil so no "operation_timeout" flashes.
  await ack();
  afterAck(async () => {
    try {
      const { weather, items, wardrobeItems, context, recentlyWorn, feedbackScores } = await getOutfitContext();
      const recommendation = generateOutfit(wardrobeItems, context, recentlyWorn, feedbackScores);
      lastRecommendation = recommendation;
      await sheets.logWorn(todayStr(), {
        top: recommendation.wear.top,
        bottom: recommendation.wear.bottom,
        shoes: recommendation.wear.shoes,
        outerwear: recommendation.wear.outerwear,
      });
      await respond({ blocks: outfitMessage(recommendation, items, weather) as any });
    } catch (err) {
      await respond(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  });
});

app.command('/armoire', async ({ ack, respond }) => {
  await ack();
  afterAck(async () => {
    try {
      const items = await sheets.getAll();
      await respond({ blocks: wardrobeList(items) as any });
    } catch (err) {
      await respond(`:x: Erreur lors de la lecture de l'armoire : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  });
});

app.command('/stats', async ({ ack, respond }) => {
  await ack();
  afterAck(async () => {
    try {
      const items = await sheets.getAll();
      await respond({ blocks: statsMessage(computeStats(items)) as any });
    } catch (err) {
      await respond(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  });
});

app.command('/agenda', async ({ ack, respond }) => {
  await ack();
  afterAck(async () => {
    try {
      const agenda = await fetchTodayAgenda();
      lastAgenda = agenda;
      await respond(formatAgendaSlack(agenda));
    } catch (err) {
      await respond(`:x: Erreur lors de la lecture de l'agenda : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  });
});

app.command('/meteo', async ({ ack, respond }) => {
  await ack();
  afterAck(async () => {
    try {
      const loc = getUserLocation();
      const weather = await fetchWeather(loc.lat, loc.lon);
      lastWeather = weather;
      await respond(formatWeatherSlack(weather));
    } catch (err) {
      await respond(`:x: Erreur lors de la récupération de la météo : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  });
});

function isDM(message: { channel_type?: string }): boolean {
  return message.channel_type === 'im';
}



async function generateAndSendOutfit(say: (msg: any) => Promise<any>) {
  const { weather, items, wardrobeItems, context, recentlyWorn, feedbackScores } = await getOutfitContext();
  const recommendation = generateOutfit(wardrobeItems, context, recentlyWorn, feedbackScores);
  lastRecommendation = recommendation;
  await sheets.logWorn(todayStr(), {
    top: recommendation.wear.top,
    bottom: recommendation.wear.bottom,
    shoes: recommendation.wear.shoes,
    outerwear: recommendation.wear.outerwear,
  });
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

function findImageFile(files: any[]): { id: string; mimetype: string; url_private_download?: string; permalink?: string } | undefined {
  return files.find(
    (f: any) => f.mimetype && IMAGE_MIME_TYPES.includes(f.mimetype),
  );
}

const VERCEL_BASE = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://daily-knight.vercel.app';

function buildImageProxyUrl(slackPrivateUrl: string): string {
  const sig = signFileUrl(slackPrivateUrl);
  return `${VERCEL_BASE}/api/images?url=${encodeURIComponent(slackPrivateUrl)}&sig=${sig}`;
}

async function handleImageMessage(
  imageFile: { id: string; mimetype: string; url_private_download?: string; permalink?: string },
  userText: string | undefined,
  say: (msg: any) => Promise<any>,
  userId?: string,
): Promise<void> {
  if (!imageFile.url_private_download) {
    await say(':x: Je ne peux pas accéder à la photo. Vérifie que le bot a le scope `files:read`.');
    return;
  }

  // Database-level dedup: skip if an item with this file ID already exists
  const existing = await sheets.getAll();
  if (existing.some(i => i.imageUrl?.includes(imageFile.id))) return;

  await say(':hourglass_flowing_sand: J\'analyse la photo...');
  const buffer = await downloadSlackFile(imageFile.url_private_download);

  const resized = await sharp(buffer)
    .resize(1568, 1568, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const base64 = resized.toString('base64');
  const parsed = await parseAddItemFromImage(base64, 'image/jpeg', userText || undefined);
  if (!parsed.categorie) {
    await say(':x: Je n\'ai pas pu identifier le vêtement sur la photo. Essaie avec une meilleure image ou ajoute une description.');
    return;
  }
  const imageUrl = buildImageProxyUrl(imageFile.url_private_download);
  const fields = {
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
    imageUrl,
  };
  // ID assigned atomically so two quick photos can't collide on it
  const id = await sheets.createItem(fields);
  const item = { ...fields, id } as ClothingItem;
  // The wardrobe just changed. Drop this user's advisor chat history so a stale
  // "tu n'as pas de X" from an earlier turn can't anchor the next answer against
  // the item they just added.
  if (userId) clearHistory(userId);
  await say({ blocks: savedItemMessage(item) as any });

  // Auto-generate try-on in the background — but ONLY off Vercel. On serverless the
  // instance freezes the moment the response is flushed, so this promise never
  // resolves: no sheet write, and the ":sparkles: généré" message never arrives.
  // In production, try-on is generated by the /api/tryon endpoint instead.
  const onServerless = Boolean(process.env.VERCEL);
  if (!onServerless && item.imageUrl && process.env.TRYON_BASE_IMAGE) {
    generateTryOn(item)
      .then(async (tryonUrl) => {
        if (tryonUrl) {
          await sheets.update(item.id, { tryonUrl } as any);
          await say(`:sparkles: Try-on généré pour *${item.id}* ! ${tryonUrl}`);
        }
      })
      .catch(() => {});
  }
}

const FUTURE_PATTERN = /demain|mañana|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|tomorrow|next|prochain|semaine|week|lunes|martes|miércoles|jueves|viernes|sábado|domingo/i;
const OUTFIT_PATTERN = /je\s+mets?\s+quoi|quoi\s+porter|outfit|qu[ée]\s+me\s+pongo|tenue/i;
const GREETING_PATTERN = /^(bonjour|salut|hello|hey|hi|coucou|bonsoir)\b/i;
const ARMOIRE_PATTERN = /armoire|armario|wardrobe|garde-?robe|voir.*vêtements|mes\s+vêtements/i;
const AGENDA_PATTERN = /agenda|calendrier|calendar|réunion|événements|eventos/i;
const METEO_PATTERN = /météo|meteo|weather|temps\s+qu'il\s+fait|clima/i;
const STATS_PATTERN = /\bstats?\b|statistiques?|estad[íi]sticas?/i;
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
    await handleImageMessage(imageFile, userText, say, msg.user);
  } catch (err) {
    await say(`:x: Erreur lors de l'analyse de la photo : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
});

app.message(async ({ message, say }) => {
  // A photo uploaded WITH a caption is delivered to both this handler and the
  // file_share event handler above. Let that one own it, or the caption gets
  // processed twice — appending the same item once from the image and once from
  // the text.
  if ((message as { subtype?: string }).subtype === 'file_share') return;
  if (message.type !== 'message' || !('text' in message) || !message.text) return;

  const text = message.text;

  if (OUTFIT_PATTERN.test(text) && !FUTURE_PATTERN.test(text)) {
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
      const fields = {
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
      const id = await sheets.createItem(fields);
      const item = { ...fields, id } as ClothingItem;
      // Wardrobe changed — drop stale advisor history (see handleImageMessage).
      const addUserId = 'user' in message ? (message as any).user : undefined;
      if (addUserId) clearHistory(addUserId);
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

  if (STATS_PATTERN.test(text)) {
    try {
      const items = await sheets.getAll();
      await say({ blocks: statsMessage(computeStats(items)) as any });
    } catch (err) {
      await say(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
    return;
  }

  if (HELP_PATTERN.test(text)) {
    await say(`:magic_wand: *Mage Stylist — Commandes*\n\n`
      + `• *« je mets quoi ? »* ou */outfit* — Tenue du jour\n`
      + `• *« armoire »* ou */armoire* — Voir tes vêtements\n`
      + `• *« agenda »* ou */agenda* — Événements du jour\n`
      + `• *« météo »* ou */meteo* — Météo du jour\n`
      + `• *« stats »* ou */stats* — Analyse de ta garde-robe\n`
      + `• *« ajoute [vêtement] »* — Ajouter un vêtement\n`
      + `• *:camera: Envoie une photo* — Ajouter un vêtement par photo\n`
      + `• *« aide »* — Ce message`);
    return;
  }

  if (isDM(message)) {
    if (GREETING_PATTERN.test(text)) {
      try {
        await say(':magic_wand: Bonjour ! Voici ta tenue du jour :');
        await generateAndSendOutfit(say);
      } catch (err) {
        await say(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      }
      return;
    }

    const userId = 'user' in message ? (message as any).user : 'unknown';
    try {
      const items = await sheets.getAll();
      const answer = await askAdvisor(
        userId,
        text,
        items,
        lastWeather ?? undefined,
        lastAgenda ?? undefined,
      );
      await say(answer);

      // Show images for any item IDs mentioned in the response
      try {
        const mentionedIds = answer.match(/[A-Z]{2}-\d{2,}/g);
        if (mentionedIds) {
          const uniqueIds = [...new Set(mentionedIds)];
          const imageBlocks: object[] = [];
          for (const id of uniqueIds) {
            const item = items.find((i) => i.id === id);
            if (!item) continue;
            const imgUrl = item.productUrl
              || (item.tryonUrl && !item.tryonUrl.includes('replicate.delivery') ? item.tryonUrl : null)
              || item.imageUrl;
            if (!imgUrl) continue;
            const name = [item.marque, item.categorie, item.sousCategorie, item.couleur].filter(Boolean).join(' ') || item.id;
            imageBlocks.push({
              type: 'image',
              title: { type: 'plain_text', text: name },
              image_url: imgUrl,
              alt_text: name,
            });
          }
          if (imageBlocks.length > 0) {
            await say({ text: 'Images des vêtements mentionnés', blocks: imageBlocks as any });
          }
        }
      } catch {
        // Don't fail the whole response if images can't be shown
      }
    } catch (err) {
      await say(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  }
});

app.action('regenerate_outfit', async ({ ack, respond, action }) => {
  await ack();
  const shownIds = ((action as { value?: string }).value ?? '').split(',').filter(Boolean);
  afterAck(async () => {
    try {
      const { weather, items, wardrobeItems, context, recentlyWorn, feedbackScores } = await getOutfitContext();
      // The shown outfit rides in the button value, so regenerate works on any cold
      // serverless instance — lastRecommendation module state is often null there,
      // which used to make "regenerate" return the same outfit.
      const excludeIds = shownIds.length ? shownIds.slice(0, 2) : [];
      const recommendation = regenerateOutfit(wardrobeItems, context, excludeIds, recentlyWorn, feedbackScores);
      lastRecommendation = recommendation;
      await sheets.logWorn(todayStr(), {
        top: recommendation.wear.top,
        bottom: recommendation.wear.bottom,
        shoes: recommendation.wear.shoes,
        outerwear: recommendation.wear.outerwear,
      });
      await respond({ replace_original: true, blocks: outfitMessage(recommendation, items, weather) as any });
    } catch (err) {
      await respond(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  });
});

app.action('more_formal', async ({ ack, respond }) => {
  await ack();
  afterAck(async () => {
    try {
      const { weather, items, wardrobeItems, context, recentlyWorn, feedbackScores } = await getOutfitContext();
      context.agenda = { ...context.agenda, highestFormality: 'formal' };
      const recommendation = generateOutfit(wardrobeItems, context, recentlyWorn, feedbackScores);
      lastRecommendation = recommendation;
      await sheets.logWorn(todayStr(), {
        top: recommendation.wear.top,
        bottom: recommendation.wear.bottom,
        shoes: recommendation.wear.shoes,
        outerwear: recommendation.wear.outerwear,
      });
      await respond({ replace_original: true, blocks: outfitMessage(recommendation, items, weather) as any });
    } catch (err) {
      await respond(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  });
});

app.action('view_agenda', async ({ ack, respond }) => {
  await ack();
  afterAck(async () => {
    try {
      const agenda = lastAgenda ?? await fetchTodayAgenda();
      await respond(formatAgendaSlack(agenda));
    } catch (err) {
      await respond(`:x: Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  });
});

app.action('item_feedback', async ({ ack, respond, action }) => {
  await ack();
  try {
    const value = (action as { selected_option?: { value?: string } }).selected_option?.value ?? '';
    const [kind, itemId] = value.split(':');
    if (!itemId || (kind !== 'like' && kind !== 'dislike')) return;
    await sheets.logFeedback(itemId, kind === 'like' ? 1 : -1);
    await respond({
      response_type: 'ephemeral',
      replace_original: false,
      text: kind === 'like'
        ? ':+1: Bien noté — je te le proposerai plus souvent.'
        : ':-1: Bien noté — je te le proposerai moins.',
    });
  } catch (err) {
    console.error('[ITEM_FEEDBACK]', err);
  }
});

const loadingModal = (text: string) => ({
  type: 'modal' as const,
  title: { type: 'plain_text' as const, text: 'Modifier' },
  blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }],
});

app.action('edit_item', async ({ ack, action, body, client }) => {
  await ack();
  try {
    const itemId = 'value' in action ? (action.value as string) : '';

    // Open a placeholder modal FIRST — trigger_id is valid for only ~3s, and the
    // getById below is a full sheet read that can blow that on a cold instance.
    // Then fill it with views.update, which has no such deadline.
    const opened = await client.views.open({
      trigger_id: (body as any).trigger_id,
      view: loadingModal(':hourglass_flowing_sand: Chargement…'),
    });

    const viewId = opened.view?.id;
    if (!viewId) return;

    const item = await sheets.getById(itemId);
    await client.views.update({
      view_id: viewId,
      view: (item
        ? editItemModal(item)
        : loadingModal(`:x: L'article *${itemId}* n'existe plus.`)) as any,
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
