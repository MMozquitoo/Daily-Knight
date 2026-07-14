/**
 * Constraint Filter — Step 1
 *
 * Removes wardrobe items that cannot be worn today.
 * Pure function. No scoring — just yes/no elimination.
 */

import type { DailyContext } from '../types/context.js';
import type { LayerCategory, WardrobeItem } from '../types/wardrobe.js';
import { dayTemperature, getFormalityDistance, getRequiredFormality, isRainyDay, isWindyDay } from './utils.js';

/** A garment a few degrees outside its band is uncomfortable, not unwearable */
const TEMP_TOLERANCE = 3;

/** Never leave a required layer empty — the bot must always have an answer */
const REQUIRED_LAYERS: LayerCategory[] = ['top', 'bottom', 'shoes'];
const MIN_PER_LAYER = 3;

/** How badly a garment misses today's temperature */
function tempMiss(item: WardrobeItem, temp: number): number {
  const { minTemp, maxTemp } = item.weatherSuitability;
  if (temp < minTemp) return minTemp - temp;
  if (temp > maxTemp) return temp - maxTemp;
  return 0;
}

/**
 * Top a layer back up when the constraints emptied it.
 *
 * A formal day at 34°C used to produce nothing at all: the formality rule dropped
 * every casual garment, and the heat rule dropped every dress shirt and blazer, so
 * the engine threw. Better to hand back the least-wrong shirt than to hand back an
 * error at 7am.
 */
function topUpLayer(
  kept: WardrobeItem[],
  all: WardrobeItem[],
  layer: LayerCategory,
  temp: number,
): WardrobeItem[] {
  const have = kept.filter((item) => item.category === layer);
  if (have.length >= MIN_PER_LAYER) return kept;

  const missing = all
    .filter((item) => item.category === layer && !kept.includes(item))
    .sort((a, b) => tempMiss(a, temp) - tempMiss(b, temp))
    .slice(0, MIN_PER_LAYER - have.length);

  return [...kept, ...missing];
}

export function filterItems(items: WardrobeItem[], context: DailyContext): WardrobeItem[] {
  const requiredFormality = getRequiredFormality(context);
  const rainyDay = isRainyDay(context);
  const windyDay = isWindyDay(context);
  const temp = dayTemperature(context);

  const kept = items.filter((item) => {
    if (item.availability !== 'available') return false;
    if (tempMiss(item, temp) > TEMP_TOLERANCE) return false;
    if (rainyDay && !item.weatherSuitability.rainOk) return false;
    if (windyDay && !item.weatherSuitability.windOk) return false;
    if (requiredFormality === 'formal' && getFormalityDistance(item.formality, requiredFormality) > 1) return false;
    return true;
  });

  return REQUIRED_LAYERS.reduce((acc, layer) => topUpLayer(acc, items, layer, temp), kept);
}
