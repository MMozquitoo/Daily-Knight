/**
 * Why Message Templates
 *
 * Template strings used by engine/why.ts to generate
 * the one-sentence explanation on the Home screen.
 *
 * Each template has:
 *   - condition: when to use this template
 *   - message: the sentence, with optional {variable} placeholders
 *
 * Examples:
 *   { condition: 'rain',    message: "Rain later today, so a jacket and umbrella are recommended." }
 *   { condition: 'formal',  message: "Your calendar is formal, so the outfit is slightly more structured." }
 *   { condition: 'casual',  message: "Mild weather and no meetings allow a simpler casual combination." }
 *   { condition: 'cold',    message: "It's cold outside — layering up with {outerwear}." }
 *   { condition: 'default', message: "A balanced outfit for today's conditions." }
 */

export const WHY_TEMPLATES = {
  rain: 'Rain is likely today, so the outfit adds protection and a practical carry item.',
  formal: 'Your calendar is more formal today, so the outfit stays structured.',
  cold: 'Cool conditions make layering the safer choice today.',
  casual: 'A lighter day allows a simpler outfit without over-dressing.',
  default: 'This combination balances weather, context, and comfort.',
} as const;
