/**
 * Carry Recommendation — Step 5
 *
 * Pure rule-based. No scoring.
 */

import type { DailyContext } from '../types/context.js';
import type { CarryItem } from '../types/outfit.js';
import { getTemperatureSwing } from './utils.js';

export function recommendCarry(context: DailyContext): CarryItem[] {
  const carry: CarryItem[] = [];

  if (context.weather.rainProbability > 30) carry.push('umbrella');
  if (getTemperatureSwing(context) > 8) carry.push('light-layer');
  if (context.agenda.dayType === 'office' && context.agenda.highestFormality === 'formal') carry.push('bag');

  return carry;
}
