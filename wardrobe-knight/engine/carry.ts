/**
 * Carry Recommendation — Step 5
 *
 * Pure rule-based. No scoring.
 *
 * Rules:
 *   - rainProbability > 30       → umbrella
 *   - temperature swing > 8°C   → light layer
 *   - formal office day          → bag
 *   - no condition triggered     → nothing
 *
 * Input:  DailyContext
 * Output: CarryItem[]
 */

import type { DailyContext } from '@/types/context';
import type { CarryItem } from '@/types/outfit';
import { getTemperatureSwing } from './utils';

export function recommendCarry(context: DailyContext): CarryItem[] {
  const carry: CarryItem[] = [];

  if (context.weather.rainProbability > 30) {
    carry.push('umbrella');
  }

  if (getTemperatureSwing(context) > 8) {
    carry.push('light-layer');
  }

  if (context.agenda.dayType === 'office' && context.agenda.highestFormality === 'formal') {
    carry.push('bag');
  }

  return carry;
}
