/**
 * Constraint Filter — Step 1
 *
 * Removes wardrobe items that cannot be worn today.
 *
 * Filters out:
 *   - Items marked as unavailable
 *   - Items outside current temperature range
 *   - Items mismatched to required formality level
 *   - Items mismatched to day context (if strict mode)
 *
 * Input:  WardrobeItem[] + DailyContext
 * Output: WardrobeItem[] (filtered subset)
 *
 * Pure function. No scoring — just yes/no elimination.
 */

import type { DailyContext } from '@/types/context';
import type { WardrobeItem } from '@/types/wardrobe';
import { getFormalityDistance, getRequiredFormality, isRainyDay, isWindyDay } from './utils';

export function filterItems(items: WardrobeItem[], context: DailyContext): WardrobeItem[] {
  const requiredFormality = getRequiredFormality(context);
  const rainyDay = isRainyDay(context);
  const windyDay = isWindyDay(context);
  const currentTemp = context.weather.temperature;

  return items.filter((item) => {
    if (item.availability !== 'available') {
      return false;
    }

    if (currentTemp < item.weatherSuitability.minTemp || currentTemp > item.weatherSuitability.maxTemp) {
      return false;
    }

    if (rainyDay && !item.weatherSuitability.rainOk) {
      return false;
    }

    if (windyDay && !item.weatherSuitability.windOk) {
      return false;
    }

    if (requiredFormality === 'formal' && getFormalityDistance(item.formality, requiredFormality) > 1) {
      return false;
    }

    return true;
  });
}
