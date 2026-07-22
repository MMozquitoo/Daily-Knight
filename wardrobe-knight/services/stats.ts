/**
 * Wardrobe statistics & benchmarks (pure — no I/O).
 *
 * Turns the raw sheet items into ratios per category / formality / season /
 * condition, plus a set of heuristic "benchmark" insights: what's
 * over-represented, what's missing, what needs replacing. Thresholds are
 * deliberate rules of thumb, not science — tune them here.
 */

import type { ClothingItem, LayerCategory } from '../types/wardrobe.js';
import { categoryFromSheet } from '../types/wardrobe.js';

export interface StatBucket {
  label: string;
  count: number;
  pct: number;
}

export interface Insight {
  kind: 'over' | 'under' | 'warn' | 'ok';
  text: string;
}

export interface StatsSummary {
  total: number;
  byLayer: StatBucket[];
  byFormality: StatBucket[];
  bySeason: StatBucket[];
  condition: { neuf: number; bon: number; use: number };
  insights: Insight[];
}

const LAYER_ORDER: LayerCategory[] = ['top', 'bottom', 'shoes', 'outerwear', 'accessories'];
const LAYER_LABEL: Record<LayerCategory, string> = {
  top: 'Hauts',
  bottom: 'Bas',
  shoes: 'Chaussures',
  outerwear: 'Vestes',
  accessories: 'Accessoires',
};

function seasonKey(raw: string): string {
  const l = (raw || 'toutes').toLowerCase();
  if (l.includes('hiver') || l.includes('automne')) return 'Automne/Hiver';
  if (l.includes('été') || l.includes('ete') || l.includes('printemps')) return 'Printemps/Été';
  return 'Toutes saisons';
}

export function computeStats(items: ClothingItem[]): StatsSummary {
  const total = items.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const layerCounts = new Map<LayerCategory, number>();
  const seasonCounts = new Map<string, number>();
  for (const i of items) {
    const layer = categoryFromSheet(i.categorie);
    layerCounts.set(layer, (layerCounts.get(layer) ?? 0) + 1);
    const s = seasonKey(i.saison);
    seasonCounts.set(s, (seasonCounts.get(s) ?? 0) + 1);
  }

  const byLayer = LAYER_ORDER.map((l) => {
    const c = layerCounts.get(l) ?? 0;
    return { label: LAYER_LABEL[l], count: c, pct: pct(c) };
  });

  const bands: { label: string; test: (f: number) => boolean }[] = [
    { label: 'Casual (1–2)', test: (f) => f <= 2 },
    { label: 'Smart (3)', test: (f) => f === 3 },
    { label: 'Habillé (4–5)', test: (f) => f >= 4 },
  ];
  const byFormality = bands.map((b) => {
    const c = items.filter((i) => b.test(i.formalite)).length;
    return { label: b.label, count: c, pct: pct(c) };
  });

  const bySeason = ['Printemps/Été', 'Automne/Hiver', 'Toutes saisons'].map((s) => {
    const c = seasonCounts.get(s) ?? 0;
    return { label: s, count: c, pct: pct(c) };
  });

  const condition = {
    neuf: items.filter((i) => i.etat === 'neuf').length,
    bon: items.filter((i) => i.etat === 'bon').length,
    use: items.filter((i) => i.etat === 'usé').length,
  };

  // ── Benchmarks ──────────────────────────────────────────────────────────
  const insights: Insight[] = [];
  const tops = layerCounts.get('top') ?? 0;
  const bottoms = layerCounts.get('bottom') ?? 0;
  const shoes = layerCounts.get('shoes') ?? 0;
  const outer = layerCounts.get('outerwear') ?? 0;

  if (tops > 0 && bottoms < tops * 0.3) {
    insights.push({ kind: 'under', text: `Pas assez de bas : ${bottoms} pour ${tops} hauts — vise au moins ${Math.ceil(tops * 0.4)}.` });
  }
  if (tops > 0 && bottoms > tops) {
    insights.push({ kind: 'over', text: `Plus de bas (${bottoms}) que de hauts (${tops}) — inhabituel.` });
  }
  if (shoes < 3) {
    insights.push({ kind: 'under', text: `Peu de chaussures (${shoes}) — la variété manque.` });
  } else if (pct(shoes) > 25) {
    insights.push({ kind: 'over', text: `Beaucoup de chaussures : ${shoes} (${pct(shoes)}% de l'armoire).` });
  }
  if (outer === 0) {
    insights.push({ kind: 'under', text: `Aucune veste/manteau — rien pour se couvrir.` });
  }
  if (byFormality[2].count === 0) {
    insights.push({ kind: 'under', text: `Rien d'habillé (formalité 4–5) — un manque pour une occasion formelle.` });
  }
  if (byFormality[0].count > total * 0.7) {
    insights.push({ kind: 'over', text: `Très casual : ${byFormality[0].pct}% en formalité 1–2.` });
  }
  // Effective coverage = season-specific + "toutes saisons" (which counts for both),
  // so a wardrobe full of all-season pieces isn't wrongly flagged as thin.
  const allSeason = bySeason[2].count;
  const summerCap = bySeason[0].count + allSeason;
  const winterCap = bySeason[1].count + allSeason;
  if (total >= 20 && summerCap < total * 0.3) {
    insights.push({ kind: 'under', text: `Peu de pièces pour le printemps/été (${summerCap} en comptant les « toutes saisons »).` });
  }
  if (total >= 20 && winterCap < total * 0.3) {
    insights.push({ kind: 'under', text: `Peu de pièces pour l'automne/hiver (${winterCap} en comptant les « toutes saisons »).` });
  }
  if (condition.use > total * 0.2) {
    insights.push({ kind: 'warn', text: `${condition.use} pièces usées (${pct(condition.use)}%) — à renouveler.` });
  }

  if (insights.length === 0) {
    insights.push({ kind: 'ok', text: `Garde-robe équilibrée — rien à signaler.` });
  }

  return { total, byLayer, byFormality, bySeason, condition, insights };
}
