/**
 * ClothingItem → WardrobeItem adapter
 *
 * Bridges the 15-column Google Sheets schema to the engine's WardrobeItem type.
 * All mapping logic is centralized here.
 */

import { COMFORT_BAND, adjustBand } from '../constants/warmth.js';
import type {
  ClothingItem,
  ClothingType,
  FormalityLevel,
  PaletteColor,
  UsageContext,
  WardrobeItem,
} from './wardrobe.js';
import { categoryFromSheet, typeFromSheet } from './wardrobe.js';

// --- Color mapping ---

const COLOR_MAP: Record<string, PaletteColor> = {
  blanc: 'white', white: 'white', écru: 'white', crème: 'white',
  noir: 'black', black: 'black',
  'bleu marine': 'navy', marine: 'navy', navy: 'navy',
  'bleu pétrole': 'navy', pétrole: 'navy',
  'bleu clair': 'blue', 'bleu ciel': 'blue', 'bleu roi': 'blue',
  bleu: 'blue', blue: 'blue', ciel: 'blue', bleach: 'blue',
  gris: 'gray', gray: 'gray', anthracite: 'gray',
  beige: 'beige', sable: 'beige', cream: 'beige', mastic: 'beige',
  marron: 'brown', brown: 'brown', camel: 'brown', cognac: 'brown',
  chocolat: 'brown', 'marron foncé': 'brown', tan: 'brown',
  olive: 'olive', kaki: 'olive',
  rouge: 'red', red: 'red', bordeaux: 'red', bourgogne: 'red', corail: 'red',
  vert: 'green', green: 'green', sapin: 'green', menthe: 'green',
  turquoise: 'blue', cyan: 'blue',
  jaune: 'yellow', yellow: 'yellow', moutarde: 'yellow', fluo: 'yellow',
  rose: 'pink', pink: 'pink', poudré: 'pink',
  violet: 'purple', purple: 'purple', mauve: 'purple', lilas: 'purple', prune: 'purple',
  orange: 'orange', abricot: 'orange', rouille: 'orange',
};

function mapColor(couleur: string): PaletteColor {
  const normalized = couleur.toLowerCase().trim();
  const exact = COLOR_MAP[normalized];
  if (exact) return exact;

  // Longest key wins, so "bleu ciel" resolves before the bare "bleu"
  const match = Object.keys(COLOR_MAP)
    .filter((key) => normalized.includes(key))
    .sort((a, b) => b.length - a.length)[0];

  return match ? COLOR_MAP[match] : 'gray';
}

// --- Formality mapping ---

function mapNiveau(niveau: string): FormalityLevel {
  const lower = niveau.toLowerCase().trim();
  if (lower === 'casual') return 'casual';
  if (lower === 'smart casual') return 'smart';
  if (lower === 'business') return 'smart';
  if (lower === 'formal') return 'formal';
  return 'casual';
}

function mapFormalite(formalite: number): FormalityLevel {
  if (formalite <= 2) return 'casual';
  if (formalite <= 3) return 'smart';
  return 'formal';
}

// --- Context derivation ---

function deriveContexts(niveau: string, formalite: number): UsageContext[] {
  const lower = niveau.toLowerCase().trim();
  if (lower === 'formal' || formalite >= 4) return ['office', 'evening'];
  if (lower === 'business' || formalite === 3) return ['office', 'casual'];
  if (lower === 'smart casual') return ['office', 'casual'];
  return ['casual', 'travel'];
}

// --- Weather derivation from the garment itself ---

function deriveWeather(item: ClothingItem, type: ClothingType): { minTemp: number; maxTemp: number; rainOk: boolean } {
  // The band comes from what the garment IS. Saison and Matière only nudge it —
  // see constants/warmth.ts for why deriving it from Saison alone was wrong.
  const band = adjustBand(COMFORT_BAND[type], item.matiere, item.saison);

  const matiere = item.matiere.toLowerCase();
  const rainOk = !matiere.includes('daim') && !matiere.includes('suede');

  return { minTemp: band.min, maxTemp: band.max, rainOk };
}

// --- Main adapter ---

export function toWardrobeItem(item: ClothingItem): WardrobeItem {
  const category = categoryFromSheet(item.categorie);
  const type = typeFromSheet(item.categorie, item.sousCategorie);
  const weather = deriveWeather(item, type);

  // Use niveau (text) as primary, formalite (number) as fallback
  const formality = item.niveau ? mapNiveau(item.niveau) : mapFormalite(item.formalite);

  return {
    id: item.id,
    name: `${item.categorie} ${item.sousCategorie}`.trim(),
    type,
    category,
    templateId: `${category}_${type}_${item.sousCategorie.toLowerCase()}`,
    color: mapColor(item.couleur),
    palette: item.palette,
    formality,
    contexts: deriveContexts(item.niveau, item.formalite),
    weatherSuitability: {
      minTemp: weather.minTemp,
      maxTemp: weather.maxTemp,
      rainOk: weather.rainOk,
      windOk: true,
    },
    // A worn-out garment is still wearable — it should lose to a better one, not
    // vanish. It used to be filtered out entirely as 'unavailable'.
    condition: item.etat,
    availability: 'available',
    layer: category,
    createdAt: new Date().toISOString(),
  };
}

export function toWardrobeItems(items: ClothingItem[]): WardrobeItem[] {
  return items.map(toWardrobeItem);
}
