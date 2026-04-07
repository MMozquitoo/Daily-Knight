/**
 * Wardrobe domain types
 *
 * Core types for clothing items, categories, and formality levels.
 * These map directly to the data structure in architecture doc Section 5.
 */

/** Physical clothing types */
export type ClothingType =
  | 'tshirt'
  | 'shirt'
  | 'sweater'
  | 'hoodie'
  | 'pants'
  | 'jeans'
  | 'shorts'
  | 'skirt'
  | 'sneakers'
  | 'boots'
  | 'loafers'
  | 'sandals'
  | 'jacket'
  | 'coat'
  | 'blazer'
  | 'vest'
  | 'hat'
  | 'scarf'
  | 'bag'
  | 'watch';

/** Layer categories — maps to avatar z-index system */
export type LayerCategory = 'top' | 'bottom' | 'shoes' | 'outerwear' | 'accessories';

/** Avatar layer slots — same as LayerCategory but used in rendering context */
export type LayerSlot = LayerCategory;

/** Formality levels */
export type FormalityLevel = 'casual' | 'smart' | 'formal';

/** Usage contexts */
export type UsageContext = 'office' | 'casual' | 'sport' | 'travel' | 'evening';

/** Item availability */
export type Availability = 'available' | 'unavailable';

/** Weather suitability range for a clothing item */
export interface WeatherRange {
  minTemp: number;
  maxTemp: number;
  rainOk: boolean;
  windOk: boolean;
}

/** A single clothing item in the user's wardrobe */
export interface WardrobeItem {
  id: string;
  name: string;
  type: ClothingType;
  category: LayerCategory;
  templateId: string;
  color: PaletteColor;
  formality: FormalityLevel;
  contexts: UsageContext[];
  weatherSuitability: WeatherRange;
  availability: Availability;
  layer: LayerSlot;
  createdAt: string;
}

/** Input shape for creating a new item (id and createdAt are generated) */
export type NewWardrobeItem = Omit<WardrobeItem, 'id' | 'createdAt'>;

/** Controlled color palette — all clothing colors map to one of these */
export type PaletteColor =
  | 'white'
  | 'black'
  | 'navy'
  | 'gray'
  | 'beige'
  | 'brown'
  | 'olive'
  | 'red'
  | 'blue'
  | 'green';
