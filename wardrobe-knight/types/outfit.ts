/**
 * Outfit Recommendation type
 *
 * The output of the decision engine.
 * Contains what to wear, what to carry, and why.
 */

/** Carry item types */
export type CarryItem = 'umbrella' | 'light-layer' | 'bag' | 'sunglasses';

/** The full recommendation shown on the Home screen */
export interface OutfitRecommendation {
  wear: {
    top: string;        // wardrobe item ID
    bottom: string;     // wardrobe item ID
    shoes: string;      // wardrobe item ID
    outerwear?: string; // wardrobe item ID, optional
    accessories: string[]; // wardrobe item IDs
  };
  carry: CarryItem[];
  why: string;
}
