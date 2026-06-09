/**
 * Constraint Filter — Step 1
 *
 * Removes wardrobe items that cannot be worn today.
 * Pure function. No scoring — just yes/no elimination.
 */

import type { DailyContext } from '../types/context.js';
import type { WardrobeItem } from '../types/wardrobe.js';
import { getFormalityDistance, getRequiredFormality, isRainyDay, isWindyDay } from './utils.js';

export function filterItems(items: WardrobeItem[], context: DailyContext): WardrobeItem[] {
  const requiredFormality = getRequiredFormality(context);
  const rainyDay = isRainyDay(context);
  const windyDay = isWindyDay(context);
  const currentTemp = context.weather.temperature;

  return items.filter((item) => {
    if (item.availability !== 'available') return false;
    if (currentTemp < item.weatherSuitability.minTemp || currentTemp > item.weatherSuitability.maxTemp) return false;
    if (rainyDay && !item.weatherSuitability.rainOk) return false;
    if (windyDay && !item.weatherSuitability.windOk) return false;
    if (requiredFormality === 'formal' && getFormalityDistance(item.formality, requiredFormality) > 1) return false;
    return true;
  });
}
