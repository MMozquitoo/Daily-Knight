/**
 * Outfit Assembler — Step 3
 *
 * Picks the highest-scoring valid item for each required layer.
 */

import { ACCESSORY_SCORE_MIN, OUTERWEAR_SCORE_MIN } from '../constants/scoring.js';
import type { DailyContext } from '../types/context.js';
import type { LayerCategory, WardrobeItem } from '../types/wardrobe.js';
import type { AssembleOptions, RawOutfit, ScoredItem } from './types.js';
import { needsOuterwear } from './utils.js';

const REQUIRED_LAYERS: LayerCategory[] = ['top', 'bottom', 'shoes'];

function pickLayerItem(
  scoredItems: ScoredItem[],
  layer: LayerCategory,
  options: AssembleOptions,
): WardrobeItem | undefined {
  const lockedId = options.lockedLayerIds?.[layer as keyof AssembleOptions['lockedLayerIds']];
  if (lockedId) {
    return scoredItems.find((entry) => entry.item.id === lockedId)?.item;
  }
  return scoredItems.find(
    (entry) =>
      entry.item.category === layer &&
      !options.excludedItemIds?.includes(entry.item.id),
  )?.item;
}

export function assembleOutfit(
  scoredItems: ScoredItem[],
  context: DailyContext,
  options: AssembleOptions = {},
): RawOutfit | null {
  const [top, bottom, shoes] = REQUIRED_LAYERS.map((layer) => pickLayerItem(scoredItems, layer, options));

  if (!top || !bottom || !shoes) return null;

  const lockedOuterwearId = options.lockedLayerIds?.outerwear;
  const outerwearCandidate = lockedOuterwearId
    ? scoredItems.find((entry) => entry.item.id === lockedOuterwearId)
    : scoredItems.find(
        (entry) =>
          entry.item.category === 'outerwear' &&
          entry.score >= OUTERWEAR_SCORE_MIN &&
          !options.excludedItemIds?.includes(entry.item.id),
      );

  // One of each kind — never two belts or two hats (matches findValidOutfit)
  const seenTypes = new Set<string>();
  const accessories = scoredItems
    .filter(
      (entry) =>
        entry.item.category === 'accessories' &&
        entry.score >= ACCESSORY_SCORE_MIN &&
        !options.excludedItemIds?.includes(entry.item.id),
    )
    .filter((entry) => {
      if (seenTypes.has(entry.item.type)) return false;
      seenTypes.add(entry.item.type);
      return true;
    })
    .slice(0, 2)
    .map((entry) => entry.item);

  return {
    top,
    bottom,
    shoes,
    outerwear: needsOuterwear(context) ? outerwearCandidate?.item : undefined,
    accessories,
  };
}
