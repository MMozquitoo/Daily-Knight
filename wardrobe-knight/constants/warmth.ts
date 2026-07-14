/**
 * Warmth model
 *
 * How warm a garment actually is, by what it *is* — not by what the "Saison"
 * column happens to say.
 *
 * The sheet's Saison is free text written by hand ("toutes", "mi-saison",
 * "printemps/été"), and deriving the temperature range from it alone meant any
 * garment marked "toutes" was declared wearable from 5°C to 45°C. That is how a
 * hooded sweatshirt came back as the recommendation for a 34°C day in Paris.
 *
 * A hoodie is warm at 34°C whatever the spreadsheet says. So the band starts from
 * the garment type, and Saison and Matière only nudge it.
 */

import type { ClothingType } from '../types/wardrobe.js';

export interface TempBand {
  min: number;
  max: number;
}

/** Temperature range in which the garment alone is comfortable, in °C */
export const COMFORT_BAND: Record<ClothingType, TempBand> = {
  tshirt:   { min: 16, max: 45 },
  shirt:    { min: 12, max: 34 },
  sweater:  { min: -5, max: 17 },
  hoodie:   { min: 0,  max: 19 },

  pants:    { min: 5,  max: 28 },
  jeans:    { min: 5,  max: 28 },
  shorts:   { min: 22, max: 45 },
  skirt:    { min: 16, max: 40 },

  sneakers: { min: 2,  max: 38 },
  boots:    { min: -10, max: 17 },
  loafers:  { min: 10, max: 36 },
  sandals:  { min: 23, max: 45 },

  jacket:   { min: -2, max: 19 },
  coat:     { min: -12, max: 12 },
  blazer:   { min: 8,  max: 29 },
  vest:     { min: 0,  max: 20 },

  // Accessories are worn across the year; the ones that aren't get a real band
  hat:      { min: -15, max: 45 },
  scarf:    { min: -15, max: 12 },
  belt:     { min: -15, max: 45 },
  tie:      { min: -15, max: 45 },
  bag:      { min: -15, max: 45 },
  watch:    { min: -15, max: 45 },
};

/** Materials that trap heat — they lower the ceiling */
const WARM_MATERIALS = ['laine', 'mérinos', 'merinos', 'flanelle', 'cachemire', 'duvet', 'velours', 'polaire', 'cuir'];

/** Materials that breathe — they raise both ends */
const COOL_MATERIALS = ['lin', 'chanvre', 'seersucker', 'popeline'];

/**
 * Nudge the band by material and season.
 *
 * Unknown or vague seasons ("toutes", "mi-saison") leave the band alone, rather
 * than falling through to a 5–45°C free-for-all as the old code did.
 */
export function adjustBand(band: TempBand, matiere: string, saison: string): TempBand {
  let { min, max } = band;

  const material = matiere.toLowerCase();
  if (WARM_MATERIALS.some((m) => material.includes(m))) {
    min -= 3;
    max -= 4;
  }
  if (COOL_MATERIALS.some((m) => material.includes(m))) {
    min += 2;
    max += 4;
  }
  if (material.includes('denim')) max -= 2;

  const season = saison.toLowerCase();
  if (season.includes('hiver')) max -= 3;
  if (season.includes('automne')) max -= 2;
  if (season.includes('été') || season.includes('ete')) {
    min += 3;
    max += 3;
  }
  if (season.includes('printemps')) min += 1;

  // A nudge must never invert the band
  if (max <= min) max = min + 6;

  return { min, max };
}
