import type { Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import { generateOutfit } from '../../engine/index.js';
import { buildDailyContext } from '../../engine/context.js';
import { toWardrobeItems } from '../../types/adapter.js';
import * as sheets from '../../services/sheets.js';
import * as memory from '../../services/memory.js';
import { fetchWeather, getUserLocation } from '../../services/weather.js';
import { fetchTodayAgenda } from '../../services/calendar.js';
import { outfitMessage } from '../../bot/blocks.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

const SLACK_USER_ID = process.env.SLACK_USER_ID ?? '';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildCooldownMap(history: sheets.WornEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const entry of history) {
    const entryDate = new Date(entry.date + 'T00:00:00');
    const daysDiff = Math.round((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
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

export default async function handler(_req: Request, res: Response): Promise<void> {
  if (!SLACK_USER_ID) {
    res.status(500).json({ error: 'SLACK_USER_ID not configured' });
    return;
  }

  try {
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    const loc = getUserLocation();

    const [weather, agenda, items, wornHistory] = await Promise.all([
      fetchWeather(loc.lat, loc.lon),
      fetchTodayAgenda(),
      sheets.getAll(),
      sheets.getWornRecently(7),
    ]);

    const wardrobeItems = toWardrobeItems(items);
    const context = buildDailyContext(weather, agenda);
    const recentlyWorn = buildCooldownMap(wornHistory);

    const recommendation = generateOutfit(wardrobeItems, context, recentlyWorn);

    await sheets.logWorn(todayStr(), {
      top: recommendation.wear.top,
      bottom: recommendation.wear.bottom,
      shoes: recommendation.wear.shoes,
      outerwear: recommendation.wear.outerwear,
    });

    await slack.chat.postMessage({
      channel: SLACK_USER_ID,
      text: ':shield: Bonjour ! Voici ta tenue du jour :',
      blocks: outfitMessage(recommendation, items, weather) as any,
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

    res.status(200).json({ ok: true, date: todayStr() });
  } catch (err) {
    console.error('[CRON MORNING]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
