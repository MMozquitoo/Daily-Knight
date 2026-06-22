import Replicate from 'replicate';
import { uploadImageFromUrl } from './blob.js';
import type { ClothingItem } from '../types/wardrobe.js';

let client: Replicate | null = null;

function getClient(): Replicate {
  if (!client) {
    client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }
  return client;
}

function buildProductPrompt(item: ClothingItem): string {
  const garmentType = item.sousCategorie
    ? `${item.categorie} ${item.sousCategorie}`
    : item.categorie;

  const brand = item.marque ? ` by ${item.marque}` : '';
  const model = item.modele ? ` (${item.modele})` : '';
  const color = item.couleur || 'neutral';
  const material = item.matiere ? `, ${item.matiere} fabric` : '';
  const fit = item.coupe ? `, ${item.coupe} fit` : '';

  return [
    `Professional high-quality product photograph of a ${color} ${garmentType}${brand}${model}${material}${fit}.`,
    `Clean white studio background, e-commerce catalog style.`,
    `Studio lighting with soft shadows, well-balanced and realistic illumination, high level of detail, coherent colors, elegant premium aesthetic.`,
    `Garment displayed on invisible mannequin or laid flat, showing full shape and silhouette.`,
    `Clean, modern, cinematic style. No deformed elements, no text, no logos overlay, no unrealistic proportions, no visual noise, no unnecessary elements.`,
    `Square format, centered composition.`,
  ].join(' ');
}

function extractUrl(output: unknown): string | null {
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  if (output && typeof output === 'object' && 'url' in (output as any)) {
    const u = (output as any).url;
    return typeof u === 'function' ? u() : u;
  }
  return null;
}

export async function generateProductImage(item: ClothingItem): Promise<string | null> {
  const replicate = getClient();
  const prompt = buildProductPrompt(item);

  const output = await replicate.run('black-forest-labs/flux-schnell', {
    input: {
      prompt,
      aspect_ratio: '1:1',
      num_outputs: 1,
      output_format: 'webp',
      output_quality: 90,
    },
  });

  const tempUrl = extractUrl(output);
  if (!tempUrl) return null;

  const permanentUrl = await uploadImageFromUrl(
    tempUrl,
    `product/${item.id}.webp`,
  );

  return permanentUrl;
}

export async function createProductPrediction(item: ClothingItem): Promise<string | null> {
  const replicate = getClient();
  const prompt = buildProductPrompt(item);

  const prediction = await replicate.predictions.create({
    model: 'black-forest-labs/flux-schnell',
    input: {
      prompt,
      aspect_ratio: '1:1',
      num_outputs: 1,
      output_format: 'webp',
      output_quality: 90,
    },
  });

  return prediction.id;
}

export async function waitForProductPrediction(
  predictionId: string,
  itemId: string,
  timeoutMs: number = 60_000,
): Promise<string | null> {
  const replicate = getClient();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const p = await replicate.predictions.get(predictionId);
    if (p.status === 'succeeded') {
      const tempUrl = extractUrl(p.output);
      if (!tempUrl) return null;
      return uploadImageFromUrl(tempUrl, `product/${itemId}.webp`);
    }
    if (p.status === 'failed' || p.status === 'canceled') {
      throw new Error(`Prediction ${p.status}: ${p.error}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Prediction timed out');
}
