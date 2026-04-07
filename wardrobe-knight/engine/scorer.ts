/**
 * Item Scorer — Step 2
 *
 * Assigns a numeric score (0–100) to each filtered wardrobe item.
 *
 * Scoring factors:
 *   - Weather match:              0–40 points
 *   - Formality match:            0–30 points
 *   - Context match:              0–20 points
 *   - User style preference:      0–10 points
 *
 * Scoring rules (from architecture doc):
 *   - temperature < 18        → outerwear bonus
 *   - temperature > 24        → penalize heavy layers
 *   - rainProbability > 30    → boost water-safe items
 *   - highestFormality=formal → heavily penalize casual
 *   - dayType=casual          → broad scoring range
 *   - wind > 20               → boost closed shoes + outerwear
 *   - no meetings             → reduce formality threshold
 *
 * Input:  WardrobeItem[] + DailyContext
 * Output: ScoredItem[] (item + score, sorted descending)
 *
 * Pure function. Weights come from constants/scoring.ts.
 */

import {
  ACCESSORY_SCORE_MIN,
  CONTEXT_SCORES,
  FORMALITY_SCORES,
  HOT_TEMP,
  STYLE_SCORES,
  WEATHER_BONUSES,
  WEATHER_WEIGHT,
} from '@/constants/scoring';
import type { DailyContext } from '@/types/context';
import type { WardrobeItem } from '@/types/wardrobe';
import type { ScoredItem } from './types';
import {
  getDayContextTag,
  getFormalityDistance,
  getRequiredFormality,
  isHotDay,
  isRainyDay,
  isWindyDay,
} from './utils';

function scoreWeather(item: WardrobeItem, context: DailyContext): number {
  const temp = context.weather.temperature;
  const center = (item.weatherSuitability.minTemp + item.weatherSuitability.maxTemp) / 2;
  const distance = Math.abs(temp - center);
  let score = distance <= 4 ? WEATHER_BONUSES.exactTempFit : WEATHER_BONUSES.nearTempFit;

  if (isRainyDay(context) && item.weatherSuitability.rainOk) {
    score += WEATHER_BONUSES.rainSafe;
  }

  if (isWindyDay(context) && item.weatherSuitability.windOk) {
    score += WEATHER_BONUSES.windySafe;
  }

  if (item.category === 'outerwear' && temp < HOT_TEMP) {
    score += WEATHER_BONUSES.outerwearOnColdDay;
  }

  if (item.category === 'shoes' && item.type !== 'sandals' && (isRainyDay(context) || isWindyDay(context))) {
    score += WEATHER_BONUSES.closedShoesOnWetDay;
  }

  if (isHotDay(context) && (item.category === 'outerwear' || item.type === 'boots')) {
    score += WEATHER_BONUSES.hotDayHeavyPenalty;
  }

  return Math.max(0, Math.min(WEATHER_WEIGHT, score));
}

function scoreFormality(item: WardrobeItem, context: DailyContext): number {
  const distance = getFormalityDistance(item.formality, getRequiredFormality(context));

  if (distance === 0) {
    return FORMALITY_SCORES.exact;
  }

  if (distance === 1) {
    return FORMALITY_SCORES.oneStepAway;
  }

  return FORMALITY_SCORES.twoStepsAway;
}

function scoreContext(item: WardrobeItem, context: DailyContext): number {
  const tag = getDayContextTag(context);

  if (item.contexts.includes(tag)) {
    return CONTEXT_SCORES.exact;
  }

  if (context.agenda.dayType === 'mixed') {
    return CONTEXT_SCORES.mixedDayFallback;
  }

  if (context.agenda.meetingsCount === 0) {
    return CONTEXT_SCORES.noMeetingsFallback;
  }

  return CONTEXT_SCORES.mismatch;
}

function scoreStyle(item: WardrobeItem, context: DailyContext): number {
  if (context.userStylePreference === 'mixed') {
    return STYLE_SCORES.mixed;
  }

  const distance = getFormalityDistance(item.formality, context.userStylePreference);
  if (distance === 0) {
    return STYLE_SCORES.exact;
  }

  if (distance === 1) {
    return STYLE_SCORES.adjacent;
  }

  return STYLE_SCORES.mismatch;
}

export function scoreItems(items: WardrobeItem[], context: DailyContext): ScoredItem[] {
  return items
    .map((item) => {
      const breakdown = {
        weather: scoreWeather(item, context),
        formality: scoreFormality(item, context),
        context: scoreContext(item, context),
        style: scoreStyle(item, context),
      };

      return {
        item,
        breakdown,
        score: breakdown.weather + breakdown.formality + breakdown.context + breakdown.style,
      };
    })
    .filter((entry) => {
      if (entry.item.category !== 'accessories') {
        return true;
      }

      return entry.score >= ACCESSORY_SCORE_MIN;
    })
    .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name));
}
