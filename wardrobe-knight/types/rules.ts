/**
 * Style rules — durable constraints learned from the user's feedback.
 *
 * Saved by the advisor when the user expresses a lasting preference
 * ("pas de chemise quand je reste à la maison") and applied by the
 * deterministic engine on every generation. Stored in the "Règles" sheet tab.
 */

/** Where a rule applies. "maison" = day with nothing on the calendar. */
export type RuleContext = 'maison' | 'bureau' | 'voyage' | 'toujours';

export type RuleAction = 'eviter' | 'preferer';

export interface StyleRule {
  date: string;
  context: RuleContext;
  /** Engine ClothingType keyword (e.g. "shirt") or a specific item ID (e.g. "CA-03") */
  target: string;
  action: RuleAction;
  note?: string;
}
