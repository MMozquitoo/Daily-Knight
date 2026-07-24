/**
 * Outfit Engine — Public API
 *
 * Single entry point for the decision pipeline.
 * This module imports NOTHING from Slack, Google, or any framework.
 * It is pure TypeScript — testable with plain test runners.
 */

import type { DailyContext } from '../types/context.js';
import type { OutfitRecommendation } from '../types/outfit.js';
import type { StyleRule } from '../types/rules.js';
import type { LayerCategory, WardrobeItem } from '../types/wardrobe.js';
import { assembleOutfit } from './assembler.js';
import { recommendCarry } from './carry.js';
import { filterItems } from './filter.js';
import { evaluateHarmony, accessorySuits } from './harmony.js';
import type { AssembleOptions, OutfitLayer, RawOutfit, ScoredItem } from './types.js';
import { needsOuterwear } from './utils.js';
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

/** How many candidates per layer to consider when composing */
const CANDIDATES_PER_LAYER = 6;

/** How much a coordinated palette is worth against raw per-item score */
const HARMONY_WEIGHT = 2.5;

function topCandidates(
  scoredItems: ScoredItem[],
  layer: LayerCategory,
  excluded: Set<string>,
  lockedId?: string,
): ScoredItem[] {
  if (lockedId) {
    const locked = scoredItems.find((entry) => entry.item.id === lockedId);
    return locked ? [locked] : [];
  }
  return scoredItems
    .filter((entry) => entry.item.category === layer && !excluded.has(entry.item.id))
    .slice(0, CANDIDATES_PER_LAYER);
}

/**
 * Compose the best-looking valid outfit, not merely three separately-good garments.
 *
 * The old assembler took the top-scoring item in each layer independently, then
 * dropped whichever piece caused a conflict and tried again. Nothing ever compared
 * one *combination* against another, so a coordinated outfit could only happen by
 * luck. Here every plausible combination of the top few per layer is scored as a
 * whole — item scores plus how well the palette hangs together — and the best one
 * wins.
 */
function findValidOutfit(
  scoredItems: ScoredItem[],
  context: DailyContext,
  options: AssembleOptions = {},
): RawOutfit {
  const excluded = new Set(options.excludedItemIds ?? []);
  const locked = options.lockedLayerIds ?? {};

  const tops = topCandidates(scoredItems, 'top', excluded, locked.top);
  const bottoms = topCandidates(scoredItems, 'bottom', excluded, locked.bottom);
  const shoes = topCandidates(scoredItems, 'shoes', excluded, locked.shoes);

  const outerwearOptions: (ScoredItem | undefined)[] = needsOuterwear(context)
    ? topCandidates(scoredItems, 'outerwear', excluded, locked.outerwear)
    : [undefined];
  if (outerwearOptions.length === 0) outerwearOptions.push(undefined);

  // One of each kind, ranked. Accessories are chosen to FIT the finished outfit —
  // they never gate the search. A belt whose leather clashes with the shoes should
  // simply be left off, not invalidate every top/bottom/shoes combination and drop
  // the whole thing to the greedy fallback.
  const seenTypes = new Set<string>();
  const accessoryCandidates = scoredItems
    .filter((entry) => entry.item.category === 'accessories' && !excluded.has(entry.item.id))
    .filter((entry) => {
      if (seenTypes.has(entry.item.type)) return false;
      seenTypes.add(entry.item.type);
      return true;
    })
    .map((entry) => entry.item);

  let best: { outfit: RawOutfit; total: number } | null = null;

  // Search on primaries only — accessories are added after a winner is chosen
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        for (const outer of outerwearOptions) {
          const outfit: RawOutfit = {
            top: top.item,
            bottom: bottom.item,
            shoes: shoe.item,
            outerwear: outer?.item,
            accessories: [],
          };

          if (!validateOutfit(outfit, context).valid) continue;

          const itemScore = top.score + bottom.score + shoe.score + (outer?.score ?? 0);
          const total = itemScore + evaluateHarmony(outfit).score * HARMONY_WEIGHT;

          if (!best || total > best.total) best = { outfit, total };
        }
      }
    }
  }

  if (best) {
    // Add up to two accessories, each only if it suits the occasion AND keeps the
    // outfit conflict-free — so a smart tie never lands on casual shorts.
    const accessories: WardrobeItem[] = [];
    for (const candidate of accessoryCandidates) {
      if (accessories.length >= 2) break;
      if (!accessorySuits(candidate, best.outfit)) continue;
      const trial = { ...best.outfit, accessories: [...accessories, candidate] };
      if (evaluateHarmony(trial).conflicts.length === 0) accessories.push(candidate);
    }
    return { ...best.outfit, accessories };
  }

  // Nothing survived the rules — fall back to the old greedy pick so the user gets
  // *something*, rather than an error at 7am.
  const fallback = assembleOutfit(scoredItems, context, { ...options, excludedItemIds: [...excluded] });
  if (fallback) return fallback;

  throw new Error('Impossible de composer une tenue valide avec ton armoire actuelle.');
}

export function generateOutfit(
  items: WardrobeItem[],
  context: DailyContext,
  recentlyWorn?: Map<string, number>,
  feedbackScores?: Map<string, number>,
  styleRules?: StyleRule[],
): OutfitRecommendation {
  const filteredItems = filterItems(items, context);
  const scoredItems = scoreItems(filteredItems, context, recentlyWorn, feedbackScores, styleRules);
  const outfit = findValidOutfit(scoredItems, context);
  return toRecommendation(outfit, context);
}

export function regenerateOutfit(
  items: WardrobeItem[],
  context: DailyContext,
  excludeItemIds: string[] = [],
  recentlyWorn?: Map<string, number>,
  feedbackScores?: Map<string, number>,
  styleRules?: StyleRule[],
): OutfitRecommendation {
  const filteredItems = filterItems(items, context);
  const scoredItems = scoreItems(filteredItems, context, recentlyWorn, feedbackScores, styleRules);
  const outfit = findValidOutfit(scoredItems, context, { excludedItemIds: excludeItemIds });
  return toRecommendation(outfit, context);
}

export function swapLayer(
  items: WardrobeItem[],
  context: DailyContext,
  current: OutfitRecommendation,
  layer: OutfitLayer,
  recentlyWorn?: Map<string, number>,
  feedbackScores?: Map<string, number>,
  styleRules?: StyleRule[],
): OutfitRecommendation {
  const filteredItems = filterItems(items, context);
  // Honour the cooldown here too, or swapping can surface yesterday's item that
  // generateOutfit/regenerateOutfit would have suppressed.
  const scoredItems = scoreItems(filteredItems, context, recentlyWorn, feedbackScores, styleRules);
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
