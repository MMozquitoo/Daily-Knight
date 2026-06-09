/**
 * Why Message Generator — Step 6
 *
 * Template-based short sentences in Spanish.
 */

import { WHY_TEMPLATES } from '../constants/why-templates.js';
import type { DailyContext } from '../types/context.js';
import type { CarryItem } from '../types/outfit.js';

export function generateWhy(context: DailyContext, carry: CarryItem[]): string {
  if (context.weather.rainProbability > 30 || carry.includes('umbrella')) return WHY_TEMPLATES.rain;
  if (context.agenda.highestFormality === 'formal') return WHY_TEMPLATES.formal;
  if (context.weather.temperature < 18 || context.weather.feelsLike < 16) return WHY_TEMPLATES.cold;
  if (context.agenda.meetingsCount === 0 && context.agenda.dayType === 'casual') return WHY_TEMPLATES.casual;
  return WHY_TEMPLATES.default;
}
