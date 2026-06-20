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

const MODEL = 'cuuupid/idm-vton:3b032a70c29aef7b9c3222f2e40b71660201d8c288336475ba326f3ca278a3e1';

function toTryonCategory(item: ClothingItem): 'upper_body' | 'lower_body' | 'dresses' {
  const layer = categoryFromSheet(item.categorie);
  if (layer === 'bottom') return 'lower_body';
  return 'upper_body';
}

function buildGarmentDescription(item: ClothingItem): string {
  const parts = [item.categorie, item.sousCategorie, item.couleur, item.matiere, item.marque].filter(Boolean);
  return parts.join(' ') || item.categorie;
}

export async function generateTryOn(
  item: ClothingItem,
  baseImageUrl?: string,
): Promise<string | null> {
  const humanImg = baseImageUrl ?? process.env.TRYON_BASE_IMAGE;
  if (!humanImg) throw new Error('TRYON_BASE_IMAGE not configured');
  if (!item.imageUrl) return null;

  const replicate = getClient();

  const output = await replicate.run(MODEL, {
    input: {
      human_img: humanImg,
      garm_img: item.imageUrl,
      garment_des: buildGarmentDescription(item),
      category: toTryonCategory(item),
      crop: true,
      steps: 30,
      seed: 42,
    },
  });

  if (typeof output === 'string') return output;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  if (output && typeof output === 'object' && 'url' in (output as any)) return (output as any).url();
  return null;
}
