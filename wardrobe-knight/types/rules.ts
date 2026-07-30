/**
 * Style rules — durable constraints learned from the user's feedback, or seeded
 * from the style-profile Google Doc's "charte vestimentaire" (see
 * scripts/seed-charte-rules.ts).
 *
 * Saved by the advisor when the user expresses a lasting preference
 * ("pas de chemise quand je reste à la maison") and applied by the
 * deterministic engine on every generation. Stored in the "Règles" sheet tab.
 */

import type { PaletteColor } from './wardrobe.js';

/** Where a rule applies. "maison" = day with nothing on the calendar. */
export type RuleContext = 'maison' | 'bureau' | 'voyage' | 'toujours';

export type RuleAction = 'eviter' | 'preferer';

export interface StyleRule {
  date: string;
  context: RuleContext;
  /** Engine ClothingType keyword (e.g. "shirt"), a specific item ID (e.g. "CA-03"), or "*" to target by color/cut alone. */
  target: string;
  action: RuleAction;
  /** Only match items of this color — e.g. the charte's "jamais de jaune". */
  color?: PaletteColor;
  /** Substring match against the item's cut/sous-catégorie (lowercased) — e.g. "skinny". */
  cut?: string;
  note?: string;
}
