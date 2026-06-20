/**
 * ClothingItem → WardrobeItem adapter
 *
 * Bridges the 15-column Google Sheets schema to the engine's WardrobeItem type.
 * All mapping logic is centralized here.
 */

import type {
  ClothingItem,
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
  'bleu clair': 'blue', bleu: 'blue', blue: 'blue', ciel: 'blue',
  gris: 'gray', gray: 'gray', anthracite: 'gray',
  beige: 'beige', sable: 'beige', cream: 'beige',
  marron: 'brown', brown: 'brown', camel: 'brown', cognac: 'brown',
  chocolat: 'brown', 'marron foncé': 'brown', tan: 'brown',
  olive: 'olive', kaki: 'olive',
  rouge: 'red', red: 'red', bordeaux: 'red', bourgogne: 'red',
  vert: 'green', green: 'green', sapin: 'green',
};

function mapColor(couleur: string): PaletteColor {
  const normalized = couleur.toLowerCase().trim();
  return COLOR_MAP[normalized] ?? 'gray';
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

// --- Weather derivation from saison + matière ---

function deriveWeather(item: ClothingItem): { minTemp: number; maxTemp: number; rainOk: boolean } {
  const saison = item.saison.toLowerCase();
  const matiere = item.matiere.toLowerCase();
  const cat = item.categorie.toLowerCase();

  let minTemp = 5;
  let maxTemp = 45;

  if (saison.includes('hiver') || saison.includes('automne')) {
    minTemp = -5;
    maxTemp = 20;
  } else if (saison.includes('été')) {
    minTemp = 15;
    maxTemp = 45;
  } else if (saison.includes('printemps')) {
    minTemp = 8;
    maxTemp = 35;
  }

  // Shorts/sandals are warm weather
  if (cat === 'shorts' || cat === 'sandals') {
    minTemp = 20;
    maxTemp = 40;
  }

  // Coats are cold weather
  if (cat === 'coat') {
    minTemp = -10;
    maxTemp = 15;
  }

  // Leather + suede don't love rain
  const rainOk = !matiere.includes('daim') && !matiere.includes('suede');

  return { minTemp, maxTemp, rainOk };
}

// --- Main adapter ---

export function toWardrobeItem(item: ClothingItem): WardrobeItem {
  const category = categoryFromSheet(item.categorie);
  const type = typeFromSheet(item.categorie, item.sousCategorie);
  const weather = deriveWeather(item);

  // Use niveau (text) as primary, formalite (number) as fallback
  const formality = item.niveau ? mapNiveau(item.niveau) : mapFormalite(item.formalite);

  return {
    id: item.id,
    name: `${item.categorie} ${item.sousCategorie}`.trim(),
    type,
    category,
    templateId: `${category}_${type}_${item.sousCategorie.toLowerCase()}`,
    color: mapColor(item.couleur),
    formality,
    contexts: deriveContexts(item.niveau, item.formalite),
    weatherSuitability: {
      minTemp: weather.minTemp,
      maxTemp: weather.maxTemp,
      rainOk: weather.rainOk,
      windOk: true,
    },
    availability: item.etat === 'usé' ? 'unavailable' : 'available',
    layer: category,
    createdAt: new Date().toISOString(),
  };
}

export function toWardrobeItems(items: ClothingItem[]): WardrobeItem[] {
  return items.map(toWardrobeItem);
}
