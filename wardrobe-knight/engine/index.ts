/**
 * Outfit Engine — Public API
 *
 * Single entry point for the decision pipeline.
 * This module imports NOTHING from Slack, Google, or any framework.
 * It is pure TypeScript — testable with plain test runners.
 */

import type { DailyContext } from '../types/context.js';
import type { OutfitRecommendation } from '../types/outfit.js';
import type { WardrobeItem } from '../types/wardrobe.js';
import { assembleOutfit } from './assembler.js';
import { recommendCarry } from './carry.js';
import { filterItems } from './filter.js';
import type { AssembleOptions, OutfitLayer, RawOutfit, ScoredItem } from './types.js';
import { validateOutfit } from './validator.js';
import { generateWhy } from './why.js';
import { scoreItems } from './scorer.js';

function toRecommendation(outfit: RawOutfit, context: DailyContext): OutfitRecommendation {
  const carry = recommendCarry(context);
  return {
    wear: {
      top: outfit.top.id,
      bottom: outfit.bottom.id,
      shoes: outfit.shoes.id,
      outerwear: outfit.outerwear?.id,
      accessories: outfit.accessories.map((item) => item.id),
    },
    carry,
    why: generateWhy(context, carry),
  };
}

function findValidOutfit(
  scoredItems: ScoredItem[],
  context: DailyContext,
  options: AssembleOptions = {},
): RawOutfit {
  const excluded = new Set(options.excludedItemIds ?? []);
  const maxAttempts = Math.max(1, scoredItems.length);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const outfit = assembleOutfit(scoredItems, context, {
      ...options,
      excludedItemIds: [...excluded],
    });

    const validation = validateOutfit(outfit, context);
    if (outfit && validation.valid) return outfit;

    const conflictingIds = validation.conflicts.flatMap((conflict) => conflict.itemIds);
    const nextExcluded = conflictingIds
      .map((id) => scoredItems.find((entry) => entry.item.id === id))
      .filter(Boolean)
      .sort((left, right) => (left?.score ?? 0) - (right?.score ?? 0))[0];

    if (!nextExcluded) break;
    excluded.add(nextExcluded.item.id);
  }

  throw new Error('Impossible de composer une tenue valide avec ton armoire actuelle.');
}

export function generateOutfit(
  items: WardrobeItem[],
  context: DailyContext,
  recentlyWorn?: Map<string, number>,
): OutfitRecommendation {
  const filteredItems = filterItems(items, context);
  const scoredItems = scoreItems(filteredItems, context, recentlyWorn);
  const outfit = findValidOutfit(scoredItems, context);
  return toRecommendation(outfit, context);
}

export function regenerateOutfit(
  items: WardrobeItem[],
  context: DailyContext,
  excludeItemIds: string[] = [],
  recentlyWorn?: Map<string, number>,
): OutfitRecommendation {
  const filteredItems = filterItems(items, context);
  const scoredItems = scoreItems(filteredItems, context, recentlyWorn);
  const outfit = findValidOutfit(scoredItems, context, { excludedItemIds: excludeItemIds });
  return toRecommendation(outfit, context);
}

export function swapLayer(
  items: WardrobeItem[],
  context: DailyContext,
  current: OutfitRecommendation,
  layer: OutfitLayer,
): OutfitRecommendation {
  const filteredItems = filterItems(items, context);
  const scoredItems = scoreItems(filteredItems, context);
  const lockedLayerIds: Record<string, string | undefined> = {
    top: current.wear.top,
    bottom: current.wear.bottom,
    shoes: current.wear.shoes,
    outerwear: current.wear.outerwear,
  };

  const excludeItemIds = current.wear[layer] ? [current.wear[layer] as string] : [];
  delete lockedLayerIds[layer];

  const outfit = findValidOutfit(scoredItems, context, {
    excludedItemIds: excludeItemIds,
    lockedLayerIds,
  });
  return toRecommendation(outfit, context);
}
