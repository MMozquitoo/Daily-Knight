/**
 * Colour harmony
 *
 * The old rule was a single blunt check: at most one non-neutral colour, at most
 * four colours total. That rejects a clown suit but happily assembles brown shoes
 * with a black belt, or a navy jacket over a black top — the things that actually
 * make an outfit look thrown together.
 *
 * This scores an assembled outfit instead of only vetoing it, so the engine can
 * prefer the better-coordinated of two otherwise equal combinations.
 *
 * The rules are the boring, load-bearing ones a person with taste follows without
 * thinking:
 *
 *   1. One accent, tops. Everything else neutral.
 *   2. Leather matches leather — belt and shoes agree, black with black, brown
 *      with brown. This is the single most visible tell.
 *   3. Black and brown don't share an outfit.
 *   4. Navy and black together read as a mistake, not a choice.
 *   5. Warm and cool palettes don't get mixed half and half.
 *   6. Some contrast between top and bottom — head-to-toe one shade is a uniform.
 */

import type { PaletteColor, PaletteTemp, WardrobeItem } from '../types/wardrobe.js';
import type { Conflict, RawOutfit } from './types.js';
import { isNeutralColor } from './utils.js';

/** Leather goods whose colours must agree */
const LEATHER_TYPES = new Set(['belt', 'shoes', 'boots', 'loafers']);

/** Colours that read as leather */
const LEATHER_COLORS = new Set<PaletteColor>(['black', 'brown']);

export interface HarmonyResult {
  /** −40 … +25. Added to the outfit's total when comparing combinations. */
  score: number;
  conflicts: Conflict[];
  notes: string[];
}

function primaries(outfit: RawOutfit): WardrobeItem[] {
  return [outfit.top, outfit.bottom, outfit.shoes, outfit.outerwear].filter(Boolean) as WardrobeItem[];
}

function paletteTemp(items: WardrobeItem[], temp: PaletteTemp): number {
  return items.filter((item) => item.palette === temp).length;
}

export function evaluateHarmony(outfit: RawOutfit): HarmonyResult {
  const conflicts: Conflict[] = [];
  const notes: string[] = [];
  let score = 0;

  const items = primaries(outfit);
  const all = [...items, ...outfit.accessories];
  const colors = all.map((item) => item.color);

  // 1. One accent, tops
  const accents = colors.filter((color) => !isNeutralColor(color));
  if (accents.length === 0) {
    score += 6; // an all-neutral outfit is never wrong
    notes.push('palette entièrement neutre');
  } else if (accents.length === 1) {
    score += 10; // one accent on a neutral base is the sweet spot
    notes.push('une seule couleur d’accent');
  } else {
    conflicts.push({
      code: 'color_mismatch',
      message: 'Plus d’une couleur d’accent : la tenue devient bruyante.',
      itemIds: all.filter((item) => !isNeutralColor(item.color)).map((item) => item.id),
    });
    score -= 20;
  }

  // 2. Leather matches leather — the belt gives you away
  const leather = all.filter((item) => LEATHER_TYPES.has(item.type) && LEATHER_COLORS.has(item.color));
  const leatherColors = new Set(leather.map((item) => item.color));
  if (leatherColors.size > 1) {
    conflicts.push({
      code: 'color_mismatch',
      message: 'La ceinture et les chaussures ne sont pas du même cuir.',
      itemIds: leather.map((item) => item.id),
    });
    score -= 18;
  } else if (leather.length >= 2) {
    score += 8;
    notes.push('ceinture et chaussures assorties');
  }

  // 3. Black and brown don't share an outfit
  const set = new Set(colors);
  if (set.has('black') && set.has('brown')) {
    conflicts.push({
      code: 'color_mismatch',
      message: 'Noir et marron ensemble.',
      itemIds: all.filter((i) => i.color === 'black' || i.color === 'brown').map((i) => i.id),
    });
    score -= 14;
  }

  // 4. Navy and black read as an accident
  if (set.has('navy') && set.has('black')) {
    score -= 8;
    notes.push('marine et noir : à éviter');
  }

  // 5. Warm and cool, half and half
  const warm = paletteTemp(items, 'chaud');
  const cool = paletteTemp(items, 'froid');
  if (warm >= 2 && cool >= 2) {
    score -= 10;
    notes.push('palette chaude et froide mélangées');
  } else if (warm === 0 || cool === 0) {
    score += 5; // coherent temperature
  }

  // 6. Head-to-toe one shade is a uniform, not an outfit
  if (outfit.top.color === outfit.bottom.color && outfit.top.color !== 'white') {
    score -= 6;
    notes.push('haut et bas de la même couleur');
  }

  // A tight palette is a good sign; five colours is a jumble
  if (set.size <= 3) score += 4;
  if (set.size > 4) {
    conflicts.push({
      code: 'color_mismatch',
      message: 'Trop de couleurs différentes.',
      itemIds: [outfit.top.id, outfit.bottom.id, outfit.shoes.id],
    });
    score -= 12;
  }

  return { score, conflicts, notes };
}
