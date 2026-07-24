import type { Request, Response } from 'express';
import { requireCron } from '../_auth.js';
import { WebClient } from '@slack/web-api';
import { generateOutfit } from '../../engine/index.js';
import { buildDailyContext } from '../../engine/context.js';
import { ruleApplies, ruleTargets } from '../../engine/utils.js';
import { toWardrobeItems } from '../../types/adapter.js';
import type { DailyContext } from '../../types/context.js';
import type { StyleRule } from '../../types/rules.js';
import type { WardrobeItem } from '../../types/wardrobe.js';
import * as sheets from '../../services/sheets.js';
import * as memory from '../../services/memory.js';
import { getPlannedOutfit } from '../../services/planner.js';
import { getUserLocation } from '../../services/weather.js';
import { resolveDayPlace } from '../../services/destination.js';
import { fetchTodayAgenda } from '../../services/calendar.js';
import { todayStr } from '../../services/dates.js';
import { outfitMessage } from '../../bot/blocks.js';
import { generateFullLook } from '../../services/tryon.js';

export const config = {
  runtime: 'nodejs',
  // Bumped for the virtual try-on: the full-look render (~20-50s uncached, instant
  // when the evening cron pre-warmed it) runs BEFORE the outfit is posted so the
  // message ships with its single image.
  maxDuration: 60,
};

const SLACK_USER_ID = process.env.SLACK_USER_ID ?? '';

/** Give up on the look render before the cron budget does. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * A plan is written on Sunday; a rule can be spoken on Wednesday. If the planned
 * outfit breaks a rule that is in force today, the plan loses and the engine
 * regenerates fresh — otherwise "the bot doesn't learn" is literally true until
 * next Sunday.
 */
function plannedViolatesRules(
  plannedIds: (string | undefined)[],
  wardrobeItems: WardrobeItem[],
  context: DailyContext,
  styleRules: StyleRule[],
): boolean {
  for (const id of plannedIds) {
    if (!id) continue;
    const item = wardrobeItems.find((i) => i.id === id);
    if (!item) continue;
    for (const rule of styleRules) {
      if (rule.action === 'eviter' && ruleApplies(rule, context) && ruleTargets(rule, item)) {
        return true;
      }
    }
  }
  return false;
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

    const [agenda, items, wornHistory, feedbackScores, styleRules] = await Promise.all([
      fetchTodayAgenda(),
      sheets.getAll(),
      sheets.getWornRecently(7),
      sheets.getFeedbackScores().catch(() => new Map<string, number>()),
      sheets.getStyleRules().catch(() => [] as StyleRule[]),
    ]);

    // Dress for where the day happens, not for the bedroom window
    const place = await resolveDayPlace(agenda);
    const weather = place.weather;

    const wardrobeItems = toWardrobeItems(items);
    const context = buildDailyContext(weather, agenda, 'mixed', place.name);
    const recentlyWorn = sheets.buildCooldownMap(wornHistory);

    let recommendation;

    const plannedIds = planned ? [planned.top, planned.bottom, planned.shoes, planned.outerwear] : [];
    if (planned && planned.top && !plannedViolatesRules(plannedIds, wardrobeItems, context, styleRules)) {
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
      recommendation = generateOutfit(wardrobeItems, context, recentlyWorn, feedbackScores, styleRules);
    }

    // Render the single "you wearing it" image BEFORE posting — the goal is one
    // message with one picture of the user in the look, not a pile of product
    // shots. Usually instant: the evening cron pre-warms the cache. Capped so a
    // slow render can't eat the whole cron budget; on timeout the message ships
    // text-only.
    let look: string | null = null;
    try {
      const topItem = items.find((i) => i.id === recommendation.wear.top);
      const bottomItem = items.find((i) => i.id === recommendation.wear.bottom);
      const shoesItem = items.find((i) => i.id === recommendation.wear.shoes);
      if (topItem && bottomItem) {
        look = await withTimeout(generateFullLook(topItem, bottomItem, shoesItem), 40_000);
      }
    } catch (err) {
      console.error('[CRON MORNING TRYON]', err);
    }

    // Deliver first, then log. If the post fails, the day should not be recorded
    // as "worn" — otherwise the outfit that was never shown poisons tomorrow's
    // cooldown, and the user got nothing to wear either way.
    await slack.chat.postMessage({
      channel: SLACK_USER_ID,
      text: ':magic_wand: Bonjour ! Voici ta tenue du jour :',
      blocks: outfitMessage(recommendation, items, weather, look) as any,
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

    res.status(200).json({ ok: true, date: todayStr(), look: look ? 'sent' : 'skipped' });
  } catch (err) {
    console.error('[CRON MORNING]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
