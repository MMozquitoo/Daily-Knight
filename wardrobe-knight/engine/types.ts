import type { CarryItem, OutfitRecommendation } from '@/types/outfit';
import type { DailyContext } from '@/types/context';
import type { LayerCategory, PaletteColor, WardrobeItem } from '@/types/wardrobe';

export type RequiredLayer = 'top' | 'bottom' | 'shoes';
export type OptionalLayer = 'outerwear';
export type OutfitLayer = RequiredLayer | OptionalLayer;

export interface ScoredItem {
  item: WardrobeItem;
  score: number;
  breakdown: {
    weather: number;
    formality: number;
    context: number;
    style: number;
  };
}

export interface RawOutfit {
  top: WardrobeItem;
  bottom: WardrobeItem;
  shoes: WardrobeItem;
  outerwear?: WardrobeItem;
  accessories: WardrobeItem[];
}

export interface Conflict {
  code:
    | 'missing_required_layer'
    | 'formality_mismatch'
    | 'color_mismatch'
    | 'weather_mismatch'
    | 'missing_protection_layer';
  message: string;
  itemIds: string[];
}

export interface ValidationResult {
  valid: boolean;
  conflicts: Conflict[];
}

export interface AssembleOptions {
  excludedItemIds?: string[];
  lockedLayerIds?: Partial<Record<OutfitLayer, string | undefined>>;
}

export interface EngineResult extends OutfitRecommendation {
  meta: {
    context: DailyContext;
    carry: CarryItem[];
    selectedColors: PaletteColor[];
  };
}

export type LayerBuckets = Record<LayerCategory, WardrobeItem[]>;
