/**
 * Combination Validator — Step 4
 *
 * Checks outfit-level rules on the assembled combination.
 */

import type { DailyContext } from '../types/context.js';
import type { PaletteColor, WardrobeItem } from '../types/wardrobe.js';
import type { Conflict, RawOutfit, ValidationResult } from './types.js';
import { getFormalityDistance, isNeutralColor, needsOuterwear } from './utils.js';

const RAIN_UNSAFE_TYPES = new Set(['sandals', 'shorts']);

function collectColors(outfit: RawOutfit): PaletteColor[] {
  return [outfit.top, outfit.bottom, outfit.shoes, outfit.outerwear, ...outfit.accessories]
    .filter(Boolean)
    .map((item) => (item as WardrobeItem).color);
}

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

  const colors = collectColors(outfit);
  const accentColors = colors.filter((color) => !isNeutralColor(color));
  if (accentColors.length > 1 || new Set(colors).size > 4) {
    conflicts.push({
      code: 'color_mismatch',
      message: 'The color combination is too busy.',
      itemIds: [outfit.top.id, outfit.bottom.id, outfit.shoes.id],
    });
  }

  const rainUnsafeItems = primaryItems.filter((item) => RAIN_UNSAFE_TYPES.has(item.type));
  if ((context.weather.rainProbability > 30 || context.weather.temperature < 12) && rainUnsafeItems.length > 0) {
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
