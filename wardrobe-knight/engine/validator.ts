/**
 * Combination Validator — Step 4
 *
 * Checks outfit-level rules on the assembled combination.
 */

import type { DailyContext } from '../types/context.js';
import type { WardrobeItem } from '../types/wardrobe.js';
import type { Conflict, RawOutfit, ValidationResult } from './types.js';
import { evaluateHarmony } from './harmony.js';
import { dayTemperature, getFormalityDistance, needsOuterwear } from './utils.js';

const RAIN_UNSAFE_TYPES = new Set(['sandals', 'shorts']);

export function validateOutfit(outfit: RawOutfit | null, context: DailyContext): ValidationResult {
  const conflicts: Conflict[] = [];

  if (!outfit?.top || !outfit.bottom || !outfit.shoes) {
    conflicts.push({
      code: 'missing_required_layer',
      message: 'Top, bottom, and shoes are required.',
      itemIds: [],
    });
    return { valid: false, conflicts };
  }

  const primaryItems = [outfit.top, outfit.bottom, outfit.shoes, outfit.outerwear].filter(Boolean) as WardrobeItem[];

  const formalityGap = primaryItems.some((item) =>
    primaryItems.some((other) => getFormalityDistance(item.formality, other.formality) > 1),
  );
  if (formalityGap) {
    conflicts.push({
      code: 'formality_mismatch',
      message: 'Selected items do not match the same level of formality.',
      itemIds: primaryItems.map((item) => item.id),
    });
  }

  // Colour is judged by engine/harmony.ts — leather matching, black/brown,
  // navy/black, warm-vs-cool, not just "too many colours"
  conflicts.push(...evaluateHarmony(outfit).conflicts);

  const rainUnsafeItems = primaryItems.filter((item) => RAIN_UNSAFE_TYPES.has(item.type));
  if ((context.weather.rainProbability > 30 || dayTemperature(context) < 12) && rainUnsafeItems.length > 0) {
    conflicts.push({
      code: 'weather_mismatch',
      message: 'One or more items are not suitable for today\'s weather.',
      itemIds: rainUnsafeItems.map((item) => item.id),
    });
  }

  if (needsOuterwear(context) && !outfit.outerwear) {
    conflicts.push({
      code: 'missing_protection_layer',
      message: 'Today requires an outerwear layer.',
      itemIds: [outfit.top.id],
    });
  }

  return { valid: conflicts.length === 0, conflicts };
}
