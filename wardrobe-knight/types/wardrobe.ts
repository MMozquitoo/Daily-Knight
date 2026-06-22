/**
 * Wardrobe types — v2 Google Sheets schema (15 columns)
 *
 * The Google Sheet "Armoire" has these exact column headers:
 * A: ID | B: Catégorie | C: Sous-catégorie | D: Marque | E: Modèle
 * F: Couleur | G: Palette | H: Matière | I: Coupe | J: Niveau
 * K: Saison | L: Formalité | M: Impact | N: Polyvalence | O: État
 */

/** 15-column Google Sheets schema — maps 1:1 to a row */
export interface ClothingItem {
  id: string;              // A: JE-01, SO-02, etc.
  categorie: string;       // B: Jeans, Shoes, Boots, Sneakers, Pants, Shirt, etc.
  sousCategorie: string;   // C: Straight, Oxford, Slim, Derby, Low-top, etc.
  marque: string;          // D: Brand
  modele: string;          // E: Model name
  couleur: string;         // F: Bleu clair, Noir, Marron, etc.
  palette: PaletteTemp;    // G: froid, neutre, chaud
  matiere: string;         // H: denim, cuir, nylon, daim, etc.
  coupe: string;           // I: straight, structured, slim, regular
  niveau: string;          // J: casual, smart casual, business, formal
  saison: string;          // K: toutes, automne/hiver, été, etc.
  formalite: number;       // L: 1–5
  impact: number;          // M: 1–5
  polyvalence: number;     // N: 1–5
  etat: ItemCondition;     // O: neuf, bon, usé
  imageUrl?: string;       // P: Slack permalink (optional)
  tryonUrl?: string;       // Q: Virtual try-on image URL (optional)
  productUrl?: string;     // R: AI-generated product image URL (optional)
}

/** Palette temperature (column G) */
export type PaletteTemp = 'froid' | 'neutre' | 'chaud';

/** Item condition */
export type ItemCondition = 'neuf' | 'bon' | 'usé';

/** Physical clothing types used by the engine */
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

export type LayerCategory = 'top' | 'bottom' | 'shoes' | 'outerwear' | 'accessories';
export type LayerSlot = LayerCategory;

/** Legacy formality levels used by the engine */
export type FormalityLevel = 'casual' | 'smart' | 'formal';

/** Usage contexts used by the engine scorer */
export type UsageContext = 'office' | 'casual' | 'sport' | 'travel' | 'evening';

/** Availability type for engine compatibility */
export type Availability = 'available' | 'unavailable';

/** Palette colors used by the engine */
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

/** Weather suitability range — derived from ClothingItem fields */
export interface WeatherRange {
  minTemp: number;
  maxTemp: number;
  rainOk: boolean;
  windOk: boolean;
}

/** Engine-compatible item (adapted from ClothingItem) */
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

/** ID prefixes by sheet Catégorie */
export const CATEGORY_PREFIXES: Record<string, string> = {
  jeans: 'JE',
  pants: 'PA',
  chino: 'PA',
  shorts: 'SH',
  skirt: 'SK',
  shirt: 'CA',
  tshirt: 'CM',
  't-shirt': 'CM',
  sweater: 'SU',
  hoodie: 'HO',
  shoes: 'SO',
  boots: 'BO',
  sneakers: 'SN',
  sandals: 'SA',
  jacket: 'CH',
  coat: 'AB',
  blazer: 'BL',
  vest: 'VE',
  hat: 'GO',
  scarf: 'BU',
  bag: 'MA',
  watch: 'RE',
};

/** Map sheet Catégorie to engine LayerCategory */
export function categoryFromSheet(categorie: string): LayerCategory {
  const lower = categorie.toLowerCase();
  if (['jeans', 'pants', 'chino', 'shorts', 'skirt'].includes(lower)) return 'bottom';
  if (['shoes', 'boots', 'sneakers', 'sandals'].includes(lower)) return 'shoes';
  if (['jacket', 'coat', 'blazer', 'vest'].includes(lower)) return 'outerwear';
  if (['hat', 'scarf', 'bag', 'watch'].includes(lower)) return 'accessories';
  return 'top'; // shirt, tshirt, t-shirt, sweater, hoodie, polo, etc.
}

/** Map sheet Catégorie to engine ClothingType */
export function typeFromSheet(categorie: string, sousCategorie: string): ClothingType {
  const lower = categorie.toLowerCase();
  if (lower === 'jeans') return 'jeans';
  if (lower === 'pants' || lower === 'chino') return 'pants';
  if (lower === 'shorts') return 'shorts';
  if (lower === 'skirt') return 'skirt';
  if (lower === 'boots') return 'boots';
  if (lower === 'sneakers') return 'sneakers';
  if (lower === 'sandals') return 'sandals';
  if (lower === 'shoes') {
    const sub = sousCategorie.toLowerCase();
    if (sub.includes('boot') || sub.includes('chelsea')) return 'boots';
    return 'loafers';
  }
  if (lower === 'jacket') return 'jacket';
  if (lower === 'coat') return 'coat';
  if (lower === 'blazer') return 'blazer';
  if (lower === 'vest') return 'vest';
  if (lower === 'sweater') return 'sweater';
  if (lower === 'hoodie') return 'hoodie';
  if (lower === 't-shirt' || lower === 'tshirt') return 'tshirt';
  if (lower === 'hat') return 'hat';
  if (lower === 'scarf') return 'scarf';
  if (lower === 'bag') return 'bag';
  if (lower === 'watch') return 'watch';
  return 'shirt';
}
