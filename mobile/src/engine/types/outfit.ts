/**
 * Outfit Recommendation type
 *
 * The output of the decision engine.
 * Contains what to wear, what to carry, and why.
 */

/** Carry item types */
export type CarryItem = 'umbrella' | 'light-layer' | 'bag' | 'sunglasses';

/** The full recommendation */
export interface OutfitRecommendation {
  wear: {
    top: string;
    bottom: string;
    shoes: string;
    outerwear?: string;
    accessories: string[];
  };
  carry: CarryItem[];
  why: string;
}
