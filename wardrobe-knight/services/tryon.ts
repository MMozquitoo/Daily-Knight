import Replicate from 'replicate';
import { categoryFromSheet } from '../types/wardrobe.js';
import type { ClothingItem } from '../types/wardrobe.js';

let client: Replicate | null = null;

function getClient(): Replicate {
  if (!client) {
    client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }
  return client;
}

const MODEL_VERSION = '3b032a70c29aef7b9c3222f2e40b71660201d8c288336475ba326f3ca278a3e1';

function toTryonCategory(item: ClothingItem): 'upper_body' | 'lower_body' | 'dresses' {
  const layer = categoryFromSheet(item.categorie);
  if (layer === 'bottom') return 'lower_body';
  return 'upper_body';
}

function buildGarmentDescription(item: ClothingItem): string {
  const parts = [item.categorie, item.sousCategorie, item.couleur, item.matiere, item.marque].filter(Boolean);
  return parts.join(' ') || item.categorie;
}

function buildInput(item: ClothingItem, baseImageUrl?: string) {
  const humanImg = baseImageUrl ?? process.env.TRYON_BASE_IMAGE;
  if (!humanImg) throw new Error('TRYON_BASE_IMAGE not configured');
  return {
    human_img: humanImg,
    garm_img: item.imageUrl!,
    garment_des: buildGarmentDescription(item),
    category: toTryonCategory(item),
    crop: true,
    steps: 30,
    seed: 42,
  };
}

function extractUrl(output: unknown): string | null {
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  if (output && typeof output === 'object' && 'url' in (output as any)) return (output as any).url();
  return null;
}

/** Generate a single try-on (blocking — waits for result) */
export async function generateTryOn(
  item: ClothingItem,
  baseImageUrl?: string,
): Promise<string | null> {
  if (!item.imageUrl) return null;
  const replicate = getClient();
  const output = await replicate.run(`cuuupid/idm-vton:${MODEL_VERSION}`, {
    input: buildInput(item, baseImageUrl),
  });
  return extractUrl(output);
}

/** Create a prediction without waiting (returns prediction ID) */
export async function createTryOnPrediction(
  item: ClothingItem,
  baseImageUrl?: string,
): Promise<string | null> {
  if (!item.imageUrl) return null;
  const replicate = getClient();
  const prediction = await replicate.predictions.create({
    version: MODEL_VERSION,
    input: buildInput(item, baseImageUrl),
  });
  return prediction.id;
}

/** Poll a prediction until complete, return output URL */
export async function waitForPrediction(predictionId: string, timeoutMs: number = 120_000): Promise<string | null> {
  const replicate = getClient();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const p = await replicate.predictions.get(predictionId);
    if (p.status === 'succeeded') return extractUrl(p.output);
    if (p.status === 'failed' || p.status === 'canceled') throw new Error(`Prediction ${p.status}: ${p.error}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Prediction timed out');
}
