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

const ANALYSIS_PROMPT = `You are a fashion product photographer's assistant. Analyze this garment photo in extreme detail to help recreate it as a professional product image.

Describe EVERY visual detail you can see:

1. **Type & silhouette**: Exact garment type (low-top sneaker, chelsea boot, slim chino, etc.), overall shape, height (ankle/mid/high for shoes), profile (chunky/slim/flat)
2. **Material & texture**: Exact material (suede, smooth leather, canvas, denim, knit, nylon, mesh, etc.), visible texture (grainy, smooth, brushed, matte, glossy, pebbled)
3. **Color**: Precise color (not just "black" — dark navy, charcoal, faded black, off-white, cream, etc.), any color variations or gradients
4. **Construction details**: Visible stitching (contrast thread?), seams, panels, overlays, perforations, embossing, quilting
5. **Hardware & accents**: Laces (color, thickness, flat/round), eyelets (metal color), zippers, buckles, buttons, logos (placement, subtle/prominent)
6. **Sole** (for shoes): Color, thickness, shape (flat, wedge, chunky platform), material (rubber, leather, gum)
7. **Brand identification**: If brand is visible, mention the brand name and any specific model characteristics
8. **Distinctive features**: Anything that makes this piece unique — contrast elements, unusual details, aging/patina

Write a single dense paragraph describing EXACTLY what this garment looks like. Be extremely specific about proportions, materials, and colors. This description will be used to generate a product photo, so accuracy is critical — every wrong detail means the generated image won't match the real item.`;

async function analyzeGarmentPhoto(imageUrl: string): Promise<string | null> {
  const anthropic = getAnthropic();

  const response = await fetch(imageUrl);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const mediaType = contentType.startsWith('image/') ? contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' : 'image/jpeg';

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: ANALYSIS_PROMPT },
      ],
    }],
  });

  const textBlock = msg.content.find((b) => b.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : null;
}

function buildProductPrompt(item: ClothingItem, visionDescription?: string | null): string {
  if (visionDescription) {
    return [
      `Professional high-quality product photograph based on this exact description: ${visionDescription}`,
      `Reproduce this garment EXACTLY as described — correct material, color, shape, details, and proportions.`,
      `Clean white studio background, e-commerce catalog style, studio lighting with soft shadows.`,
      `Show the garment from a 3/4 angle, displaying its full shape and key details.`,
      `Photorealistic, sharp focus, high detail. No deformed elements, no added text, no unrealistic proportions.`,
      `Square format, centered composition.`,
    ].join(' ');
  }

  const garmentType = item.sousCategorie
    ? `${item.categorie} ${item.sousCategorie}`
    : item.categorie;
  const brand = item.marque ? ` by ${item.marque}` : '';
  const model = item.modele ? ` (${item.modele})` : '';
  const color = item.couleur || 'neutral';
  const material = item.matiere ? `, ${item.matiere}` : '';
  const fit = item.coupe ? `, ${item.coupe} fit` : '';

  return [
    `Professional high-quality product photograph of a ${color} ${garmentType}${brand}${model}${material}${fit}.`,
    `Clean white studio background, e-commerce catalog style.`,
    `Studio lighting with soft shadows, photorealistic, high detail.`,
    `Show full shape and silhouette from a 3/4 angle.`,
    `No deformed elements, no text, no unrealistic proportions.`,
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
  let visionDescription: string | null = null;
  if (item.imageUrl) {
    try {
      visionDescription = await analyzeGarmentPhoto(item.imageUrl);
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
      visionDescription = await analyzeGarmentPhoto(item.imageUrl);
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
