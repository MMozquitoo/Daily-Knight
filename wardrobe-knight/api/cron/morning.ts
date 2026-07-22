import type { Request, Response } from 'express';
import { requireCron } from '../_auth.js';
import { WebClient } from '@slack/web-api';
import { generateOutfit } from '../../engine/index.js';
import { buildDailyContext } from '../../engine/context.js';
import { toWardrobeItems } from '../../types/adapter.js';
import * as sheets from '../../services/sheets.js';
import * as memory from '../../services/memory.js';
import { getPlannedOutfit } from '../../services/planner.js';
import { fetchWeather, getUserLocation } from '../../services/weather.js';
import { resolveDayPlace } from '../../services/destination.js';
import { fetchTodayAgenda } from '../../services/calendar.js';
import { todayStr, daysAgo } from '../../services/dates.js';
import { outfitMessage, tryonMessage } from '../../bot/blocks.js';
import { generateOutfitLook } from '../../services/tryon.js';

export const config = {
  runtime: 'nodejs',
  // Bumped for the virtual try-on: two chained IDM-VTON passes (~40-50s) run after
  // the outfit is posted. Well under the outfit itself, which is sent first.
  maxDuration: 60,
};

const SLACK_USER_ID = process.env.SLACK_USER_ID ?? '';



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

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!requireCron(req, res)) return;
  if (!SLACK_USER_ID) {
    res.status(500).json({ error: 'SLACK_USER_ID not configured' });
    return;
  }

  try {
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    const loc = getUserLocation();

    // Check for pre-planned outfit first
    const planned = await getPlannedOutfit(todayStr()).catch(() => null);

    const [agenda, items, wornHistory, feedbackScores] = await Promise.all([
      fetchTodayAgenda(),
      sheets.getAll(),
      sheets.getWornRecently(7),
      sheets.getFeedbackScores().catch(() => new Map<string, number>()),
    ]);

    // Dress for where the day happens, not for the bedroom window
    const place = await resolveDayPlace(agenda);
    const weather = place.weather;

    let recommendation;

    if (planned && planned.top) {
      // Use pre-planned outfit
      recommendation = {
        wear: {
          top: planned.top,
          bottom: planned.bottom || '',
          shoes: planned.shoes || '',
          outerwear: planned.outerwear || undefined,
          accessories: [] as string[],
        },
        carry: (planned.carry ? planned.carry.split(', ') : []) as any,
        why: planned.why + ' _(planifié)_',
      };
    } else {
      // Generate on the fly
      const wardrobeItems = toWardrobeItems(items);
      const context = buildDailyContext(weather, agenda, 'mixed', place.name);
      const recentlyWorn = buildCooldownMap(wornHistory);
      recommendation = generateOutfit(wardrobeItems, context, recentlyWorn, feedbackScores);
    }

    // Deliver first, then log. If the post fails, the day should not be recorded
    // as "worn" — otherwise the outfit that was never shown poisons tomorrow's
    // cooldown, and the user got nothing to wear either way.
    await slack.chat.postMessage({
      channel: SLACK_USER_ID,
      text: ':magic_wand: Bonjour ! Voici ta tenue du jour :',
      blocks: outfitMessage(recommendation, items, weather) as any,
    });

    await sheets.logWorn(todayStr(), {
      top: recommendation.wear.top,
      bottom: recommendation.wear.bottom,
      shoes: recommendation.wear.shoes,
      outerwear: recommendation.wear.outerwear,
    });

    // Check for pending follow-ups and send reminders
    const followUps = await memory.getPendingFollowUps(SLACK_USER_ID).catch(() => []);
    if (followUps.length > 0) {
      const reminders = followUps
        .map((f) => `• ${f.content} _(suggéré le ${f.date})_`)
        .join('\n');
      await slack.chat.postMessage({
        channel: SLACK_USER_ID,
        text: `:brain: *Rappels :*\n${reminders}`,
      });
      for (const f of followUps) {
        if (f.rowIndex) await memory.markDone(f.rowIndex);
      }
    }

    // Weekend personality: check for observations about weekends
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const memories = await memory.getMemories(SLACK_USER_ID).catch(() => []);
      const weekendObs = memories.find(
        (m) => m.type === 'observation' && /samedi|dimanche|weekend|repos/i.test(m.content),
      );
      if (weekendObs) {
        await slack.chat.postMessage({
          channel: SLACK_USER_ID,
          text: ':couch_and_lamp: Bon weekend ! Journée pyjama autorisée :wink:',
        });
      }
    }

    // Virtual try-on, best-effort and last (it's the slow part). Only fires for
    // closed tops — generateOutfitLook returns null otherwise, so open-shirt days
    // just skip it rather than showing a mangled render.
    try {
      const topItem = items.find((i) => i.id === recommendation.wear.top);
      const bottomItem = items.find((i) => i.id === recommendation.wear.bottom);
      if (topItem && bottomItem) {
        const look = await generateOutfitLook(topItem, bottomItem);
        if (look) {
          await slack.chat.postMessage({
            channel: SLACK_USER_ID,
            text: ':sparkles: Essai virtuel du jour',
            blocks: tryonMessage(look) as any,
          });
        }
      }
    } catch (err) {
      console.error('[CRON MORNING TRYON]', err);
    }

    res.status(200).json({ ok: true, date: todayStr() });
  } catch (err) {
    console.error('[CRON MORNING]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
