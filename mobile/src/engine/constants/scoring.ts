/**
 * Scoring Constants
 *
 * Weights and thresholds for the decision engine scorer.
 * Separated from logic so they can be tuned without changing code.
 *
 * Weight groups (sum to 100):
 *   - WEATHER_WEIGHT:    40
 *   - FORMALITY_WEIGHT:  30
 *   - CONTEXT_WEIGHT:    20
 *   - STYLE_WEIGHT:      10
 *
 * Thresholds:
 *   - COLD_TEMP:         18°C  → triggers outerwear scoring
 *   - HOT_TEMP:          24°C  → penalizes heavy layers
 *   - RAIN_THRESHOLD:    30%   → boosts rain-safe items
 *   - WIND_THRESHOLD:    20 km/h → boosts closed items
 *   - OUTERWEAR_SCORE_MIN: 50  → minimum score to include outerwear
 */

export const WEATHER_WEIGHT = 40;
export const FORMALITY_WEIGHT = 30;
export const CONTEXT_WEIGHT = 20;
export const STYLE_WEIGHT = 10;

export const COLD_TEMP = 18;
export const HOT_TEMP = 24;
export const RAIN_THRESHOLD = 30;
export const WIND_THRESHOLD = 20;
export const OUTERWEAR_SCORE_MIN = 50;
export const ACCESSORY_SCORE_MIN = 45;

export const WEATHER_BONUSES = {
  exactTempFit: 24,
  nearTempFit: 14,
  rainSafe: 8,
  windySafe: 5,
  outerwearOnColdDay: 8,
  closedShoesOnWetDay: 6,
  hotDayHeavyPenalty: -8,
  /** Shorts come first once it is genuinely warm — the owner's rule */
  shortsOnHotDay: 14,
  /** …and long trousers stop being the obvious answer */
  longLegsOnHotDay: -6,
  /** Boots on a hot day are a mistake even if the leather says "toutes saisons" */
  bootsOnHotDay: -12,
} as const;

/** A worn-out garment still gets worn — it just loses to a better one */
export const CONDITION_MULTIPLIER: Record<string, number> = {
  neuf: 1,
  bon: 1,
  'usé': 0.55,
};

export const FORMALITY_SCORES = {
  exact: 30,
  oneStepAway: 18,
  twoStepsAway: 6,
} as const;

export const CONTEXT_SCORES = {
  exact: 20,
  mixedDayFallback: 12,
  noMeetingsFallback: 10,
  mismatch: 4,
} as const;

export const STYLE_SCORES = {
  mixed: 8,
  exact: 10,
  adjacent: 6,
  mismatch: 2,
} as const;

/**
 * Feedback (👍/👎) tuning.
 *
 * Each net vote on an item shifts its score by FEEDBACK_STEP points, bounded by
 * ±FEEDBACK_CAP — so a strong opinion nudges the ranking without ever overriding
 * a good weather/formality fit. Applied before the cooldown/condition multipliers.
 */
export const FEEDBACK_STEP = 5;
export const FEEDBACK_CAP = 20;

/**
 * Style rules ("Règles" tab) tuning.
 *
 * An "éviter" rule is a hard opinion the user stated in words — it has to sink the
 * item below every rival in its layer, not just nudge it, or the bot looks like it
 * doesn't listen. It still goes through Math.max(0, …) so an emptied layer can
 * fall back rather than crash the morning.
 */
export const RULE_AVOID_PENALTY = -80;
export const RULE_PREFER_BONUS = 15;
