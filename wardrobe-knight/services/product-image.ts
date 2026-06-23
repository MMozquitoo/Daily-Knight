import Replicate from 'replicate';
import Anthropic from '@anthropic-ai/sdk';
import { uploadImageFromUrl } from './blob.js';
import type { ClothingItem } from '../types/wardrobe.js';

let replicateClient: Replicate | null = null;
let anthropicClient: Anthropic | null = null;

function getReplicate(): Replicate {
  if (!replicateClient) {
    replicateClient = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }
  return replicateClient;
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function buildAnalysisPrompt(item: ClothingItem): string {
  const context = [
    item.marque && `Brand: ${item.marque}`,
    item.modele && `Model: ${item.modele}`,
    item.categorie && `Category: ${item.categorie}`,
    item.sousCategorie && `Subcategory: ${item.sousCategorie}`,
    item.couleur && `Color declared: ${item.couleur}`,
    item.matiere && `Material declared: ${item.matiere}`,
    item.coupe && `Fit: ${item.coupe}`,
  ].filter(Boolean).join(', ');

  return `You are an expert fashion product analyst. Your job is to produce the MOST ACCURATE, EXHAUSTIVE description of this garment so that a text-to-image AI can reproduce it as a faithful product photo.

KNOWN METADATA: ${context}

CRITICAL RULES:
- If you recognize the BRAND and MODEL, name them explicitly (e.g. "Axel Arigato Clean 90 sneaker", "Seagale Action Merino polo"). The image generator knows real brands and will produce much more accurate results.
- NEVER generalize. Say "dark navy brushed suede" not "dark material". Say "slim flat white cotton laces" not "white laces". Say "thin flat vulcanized rubber sole, same navy color as upper" not "flat sole".
- Describe the EXACT silhouette proportions: is the toe round, squared, pointed? Is the shoe narrow or wide? Is the collar padded or thin? Is a jacket cropped or hip-length?
- For shoes: describe the sole separately (thickness in mm if possible, color, material, whether it contrasts or matches), the upper construction panel by panel, the tongue, the heel tab.
- For tops: describe collar type, sleeve length, button count, placket style, hem shape, any prints/patterns in detail.
- For bottoms: describe waistband, rise, leg taper, hem, pocket style.
- Mention EVERYTHING: contrast stitching, metal hardware color (gold/silver/gunmetal), logo placement and size, perforations, textures, lining visible at collar, patina or wear marks.
- If the photo is at a bad angle or dark, USE THE BRAND+MODEL METADATA to fill in what you know about that product's design. State when you're using brand knowledge vs what's visible.

Write ONE dense paragraph of 150-300 words. Every word must add visual information. No filler phrases like "this is a" or "featuring a". Start directly with the garment description.`;
}

async function analyzeGarmentPhoto(imageUrl: string, item: ClothingItem): Promise<string | null> {
  const anthropic = getAnthropic();

  const response = await fetch(imageUrl);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1000) return null;
  const base64 = buffer.toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const mediaType = contentType.startsWith('image/')
    ? contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    : 'image/jpeg';

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: buildAnalysisPrompt(item) },
      ],
    }],
  });

  const textBlock = msg.content.find((b) => b.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : null;
}

function buildProductPrompt(item: ClothingItem, visionDescription?: string | null): string {
  const brandModel = [item.marque, item.modele].filter(Boolean).join(' ');

  if (visionDescription) {
    return [
      `Professional e-commerce product photograph of ${brandModel ? `a ${brandModel}` : 'this garment'}:`,
      visionDescription,
      `PHOTOGRAPHY REQUIREMENTS: Shot on clean pure white (#FFFFFF) seamless studio background.`,
      `3/4 front angle showing the full garment shape, proportions, and key details.`,
      `Soft diffused studio lighting from upper-left, subtle ground shadow, no harsh reflections.`,
      `Photorealistic rendering, tack-sharp focus, natural material textures clearly visible.`,
      `The garment must match the description EXACTLY — correct material (suede must look like suede, not leather), correct color shade, correct proportions and silhouette.`,
      `No mannequin, no model, no hanger — garment floating or placed naturally.`,
      `No watermarks, no text overlays, no brand logos added to the image.`,
    ].join(' ');
  }

  const garmentType = item.sousCategorie
    ? `${item.categorie} ${item.sousCategorie}`
    : item.categorie;
  const brand = item.marque ? ` ${item.marque}` : '';
  const model = item.modele ? ` ${item.modele}` : '';
  const color = item.couleur || 'neutral';
  const material = item.matiere || '';
  const fit = item.coupe ? `, ${item.coupe} fit` : '';

  return [
    `Professional e-commerce product photograph of a${brand}${model} ${color} ${material} ${garmentType}${fit}.`,
    `Clean pure white (#FFFFFF) seamless studio background, 3/4 front angle.`,
    `Soft diffused studio lighting, subtle ground shadow, photorealistic, tack-sharp focus.`,
    `Natural material textures clearly visible. No mannequin, no model, no hanger.`,
    `No watermarks, no text overlays, no brand logos added.`,
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
  let visionDescription: string | null = null;
  if (item.imageUrl) {
    try {
      visionDescription = await analyzeGarmentPhoto(item.imageUrl, item);
    } catch { /* fall back to metadata-only prompt */ }
  }

  const replicate = getReplicate();
  const prompt = buildProductPrompt(item, visionDescription);

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

  return uploadImageFromUrl(tempUrl, `product/${item.id}.webp`);
}

export async function createProductPrediction(item: ClothingItem): Promise<string | null> {
  let visionDescription: string | null = null;
  if (item.imageUrl) {
    try {
      visionDescription = await analyzeGarmentPhoto(item.imageUrl, item);
    } catch { /* fall back to metadata-only prompt */ }
  }

  const replicate = getReplicate();
  const prompt = buildProductPrompt(item, visionDescription);

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
  const replicate = getReplicate();
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
