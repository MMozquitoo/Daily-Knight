/**
 * Outfit Engine — Public API
 *
 * Single entry point for the decision pipeline.
 * Orchestrates all steps in sequence:
 *
 *   1. filter.ts    → Remove invalid items
 *   2. scorer.ts    → Score remaining items
 *   3. assembler.ts → Pick best per layer
 *   4. validator.ts → Check combination rules
 *   5. carry.ts     → Determine carry items
 *   6. why.ts       → Generate explanation
 *
 * Exports:
 *   - generateOutfit(items, context)    → OutfitRecommendation
 *   - regenerateOutfit(items, context, exclude)  → OutfitRecommendation
 *   - swapLayer(items, context, current, layer)  → OutfitRecommendation
 *
 * This module imports NOTHING from React or Expo.
 * It is pure TypeScript — testable with plain Jest.
 */

import type { DailyContext } from '@/types/context';
import type { OutfitRecommendation } from '@/types/outfit';
import type { WardrobeItem } from '@/types/wardrobe';
import { assembleOutfit } from './assembler';
import { recommendCarry } from './carry';
import { filterItems } from './filter';
import type { AssembleOptions, OutfitLayer, RawOutfit, ScoredItem } from './types';
import { validateOutfit } from './validator';
import { generateWhy } from './why';
import { scoreItems } from './scorer';

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
    if (outfit && validation.valid) {
      return outfit;
    }

    const conflictingIds = validation.conflicts.flatMap((conflict) => conflict.itemIds);
    const nextExcluded = conflictingIds
      .map((id) => scoredItems.find((entry) => entry.item.id === id))
      .filter(Boolean)
      .sort((left, right) => (left?.score ?? 0) - (right?.score ?? 0))[0];

    if (!nextExcluded) {
      break;
    }

    excluded.add(nextExcluded.item.id);
  }

  throw new Error('Unable to assemble a valid outfit from the current wardrobe.');
}

export function generateOutfit(items: WardrobeItem[], context: DailyContext): OutfitRecommendation {
  const filteredItems = filterItems(items, context);
  const scoredItems = scoreItems(filteredItems, context);
  const outfit = findValidOutfit(scoredItems, context);

  return toRecommendation(outfit, context);
}

export function regenerateOutfit(
  items: WardrobeItem[],
  context: DailyContext,
  excludeItemIds: string[] = [],
): OutfitRecommendation {
  const filteredItems = filterItems(items, context);
  const scoredItems = scoreItems(filteredItems, context);
  const outfit = findValidOutfit(scoredItems, context, {
    excludedItemIds: excludeItemIds,
  });

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
  const lockedLayerIds = {
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
