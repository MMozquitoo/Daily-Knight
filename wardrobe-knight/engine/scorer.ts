/**
 * Item Scorer — Step 2
 *
 * Assigns a numeric score (0–100) to each filtered wardrobe item.
 * Weights come from constants/scoring.ts.
 */

import {
  ACCESSORY_SCORE_MIN,
  CONDITION_MULTIPLIER,
  CONTEXT_SCORES,
  FORMALITY_SCORES,
  HOT_TEMP,
  STYLE_SCORES,
  WEATHER_BONUSES,
  WEATHER_WEIGHT,
} from '../constants/scoring.js';
import type { DailyContext } from '../types/context.js';
import type { WardrobeItem } from '../types/wardrobe.js';
import type { ScoredItem } from './types.js';
import {
  dayTemperature,
  getDayContextTag,
  getFormalityDistance,
  getRequiredFormality,
  isHotDay,
  isRainyDay,
  isShortsWeather,
  isWindyDay,
} from './utils.js';

function scoreWeather(item: WardrobeItem, context: DailyContext): number {
  const temp = dayTemperature(context);
  const center = (item.weatherSuitability.minTemp + item.weatherSuitability.maxTemp) / 2;
  const distance = Math.abs(temp - center);
  let score = distance <= 4 ? WEATHER_BONUSES.exactTempFit : WEATHER_BONUSES.nearTempFit;

  if (isRainyDay(context) && item.weatherSuitability.rainOk) score += WEATHER_BONUSES.rainSafe;
  if (isWindyDay(context) && item.weatherSuitability.windOk) score += WEATHER_BONUSES.windySafe;
  if (item.category === 'outerwear' && temp < HOT_TEMP) score += WEATHER_BONUSES.outerwearOnColdDay;
  if (item.category === 'shoes' && item.type !== 'sandals' && (isRainyDay(context) || isWindyDay(context))) {
    score += WEATHER_BONUSES.closedShoesOnWetDay;
  }
  if (isHotDay(context) && item.category === 'outerwear') score += WEATHER_BONUSES.hotDayHeavyPenalty;
  if (isHotDay(context) && item.type === 'boots') score += WEATHER_BONUSES.bootsOnHotDay;

  // Warm day: reach for the shorts before the trousers
  if (isShortsWeather(context)) {
    if (item.type === 'shorts') score += WEATHER_BONUSES.shortsOnHotDay;
    if (item.type === 'pants' || item.type === 'jeans') score += WEATHER_BONUSES.longLegsOnHotDay;
  }

  return Math.max(0, Math.min(WEATHER_WEIGHT, score));
}

function scoreFormality(item: WardrobeItem, context: DailyContext): number {
  const distance = getFormalityDistance(item.formality, getRequiredFormality(context));
  if (distance === 0) return FORMALITY_SCORES.exact;
  if (distance === 1) return FORMALITY_SCORES.oneStepAway;
  return FORMALITY_SCORES.twoStepsAway;
}

function scoreContext(item: WardrobeItem, context: DailyContext): number {
  const tag = getDayContextTag(context);
  if (item.contexts.includes(tag)) return CONTEXT_SCORES.exact;
  if (context.agenda.dayType === 'mixed') return CONTEXT_SCORES.mixedDayFallback;
  if (context.agenda.meetingsCount === 0) return CONTEXT_SCORES.noMeetingsFallback;
  return CONTEXT_SCORES.mismatch;
}

function scoreStyle(item: WardrobeItem, context: DailyContext): number {
  if (context.userStylePreference === 'mixed') return STYLE_SCORES.mixed;
  const distance = getFormalityDistance(item.formality, context.userStylePreference);
  if (distance === 0) return STYLE_SCORES.exact;
  if (distance === 1) return STYLE_SCORES.adjacent;
  return STYLE_SCORES.mismatch;
}

function getCooldownMultiplier(itemId: string, recentlyWorn?: Map<string, number>): number {
  if (!recentlyWorn) return 1;
  const daysSinceWorn = recentlyWorn.get(itemId);
  if (daysSinceWorn === undefined) return 1;
  if (daysSinceWorn <= 1) return 0;
  if (daysSinceWorn === 2) return 0.4;
  if (daysSinceWorn === 3) return 0.7;
  return 1;
}

export function scoreItems(
  items: WardrobeItem[],
  context: DailyContext,
  recentlyWorn?: Map<string, number>,
): ScoredItem[] {
  return items
    .map((item) => {
      const breakdown = {
        weather: scoreWeather(item, context),
        formality: scoreFormality(item, context),
        context: scoreContext(item, context),
        style: scoreStyle(item, context),
      };
      const rawScore = breakdown.weather + breakdown.formality + breakdown.context + breakdown.style;
      const wear = CONDITION_MULTIPLIER[item.condition] ?? 1;
      return {
        item,
        breakdown,
        score: rawScore * getCooldownMultiplier(item.id, recentlyWorn) * wear,
      };
    })
    .filter((entry) => {
      if (entry.item.category !== 'accessories') return true;
      return entry.score >= ACCESSORY_SCORE_MIN;
    })
    .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name));
}
