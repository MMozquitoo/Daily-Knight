/**
 * Outfit Store — Zustand
 *
 * Holds the current outfit recommendation.
 * Output of the decision engine.
 *
 * State:
 *   - recommendation: OutfitRecommendation | null
 *
 * Actions:
 *   - generate(context, wardrobe)  → runs engine, stores result
 *   - regenerate()                 → excludes current, picks next best
 *   - swapLayer(layer)             → re-scores one layer only
 */

// TODO: create(set, get) → OutfitStore
