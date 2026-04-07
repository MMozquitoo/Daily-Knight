/**
 * Why Message Generator — Step 6
 *
 * Generates a single short explanation sentence.
 * Uses template strings, not generative AI.
 *
 * Templates are stored in constants/why-templates.ts.
 *
 * Examples:
 *   "Rain later today, so a jacket and umbrella are recommended."
 *   "Your calendar is formal, so the outfit is slightly more structured."
 *   "Mild weather and no meetings allow a simpler casual combination."
 *
 * Input:  DailyContext + OutfitRecommendation
 * Output: string (one sentence)
 */

import { WHY_TEMPLATES } from '@/constants/why-templates';
import type { DailyContext } from '@/types/context';
import type { CarryItem } from '@/types/outfit';

export function generateWhy(context: DailyContext, carry: CarryItem[]): string {
  if (context.weather.rainProbability > 30 || carry.includes('umbrella')) {
    return WHY_TEMPLATES.rain;
  }

  if (context.agenda.highestFormality === 'formal') {
    return WHY_TEMPLATES.formal;
  }

  if (context.weather.temperature < 18 || context.weather.feelsLike < 16) {
    return WHY_TEMPLATES.cold;
  }

  if (context.agenda.meetingsCount === 0 && context.agenda.dayType === 'casual') {
    return WHY_TEMPLATES.casual;
  }

  return WHY_TEMPLATES.default;
}
