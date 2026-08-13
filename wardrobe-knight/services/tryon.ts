import Replicate from 'replicate';
import { categoryFromSheet } from '../types/wardrobe.js';
import type { ClothingItem } from '../types/wardrobe.js';
import { uploadImageFromUrl, findBlob } from './blob.js';

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

/** Generate a single try-on (blocking — waits for result, persisted to Blob) */
export async function generateTryOn(
  item: ClothingItem,
  baseImageUrl?: string,
): Promise<string | null> {
  if (!item.imageUrl) return null;
  const replicate = getClient();
  const output = await replicate.run(`cuuupid/idm-vton:${MODEL_VERSION}`, {
    input: buildInput(item, baseImageUrl),
  });
  const tempUrl = extractUrl(output);
  if (!tempUrl) return null;
  return uploadImageFromUrl(tempUrl, `tryon/${item.id}.png`);
}

/** Run one IDM-VTON pass and persist to a specific Blob path. */
async function runTryonToPath(
  item: ClothingItem,
  humanImg: string | undefined,
  outPath: string,
): Promise<string | null> {
  if (!item.imageUrl) return null;
  const replicate = getClient();
  const output = await replicate.run(`cuuupid/idm-vton:${MODEL_VERSION}`, {
    input: buildInput(item, humanImg),
  });
  const tempUrl = extractUrl(output);
  if (!tempUrl) return null;
  return uploadImageFromUrl(tempUrl, outPath);
}

/**
 * Whether a top renders cleanly in IDM-VTON.
 *
 * The model handles closed, single-layer garments (tees, polos, crew sweaters,
 * pull-over hoodies) well, but mangles open/layered pieces — an open shirt over a
 * tee comes out with a floating collar. We only try-on the tops that look good.
 */
export function isTryonFriendlyTop(item: ClothingItem): boolean {
  const cat = item.categorie.toLowerCase();
  const sub = item.sousCategorie.toLowerCase();
  const s = `${cat} ${sub}`;
  if (/t-?shirt|polo/.test(s)) return true;               // single-layer, always clean
  if (/sweater|pull|maille|knit/.test(cat) || /col rond|crew|col roulé/.test(sub)) {
    return !/cardigan/.test(sub);                         // cardigans are open
  }
  if (/hoodie|sweat/.test(cat)) return !/zip/.test(sub);   // zip hoodies get worn open
  return false;                                            // chemises, overshirts, etc.
}

/**
 * ONE image of the user wearing the whole outfit — the deliverable of the daily
 * message. IDM-VTON first: it warps the garment onto the base photo instead of
 * redrawing the scene, so it never drifts off Adrien's actual face the way Nano
 * Banana occasionally does — including on full nano-banana shoe days, which used
 * to be the biggest source of "that's not me" complaints. Only usable when the top
 * is try-on friendly (see isTryonFriendlyTop); shoes can't go through IDM-VTON at
 * all (no shoe category in that model), so they're added as a second, localised
 * Nano Banana pass on top of the already-correct IDM-VTON body — editing in just
 * the shoes drifts far less than generating the whole scene from the base photo.
 * Nano Banana alone is the fallback for open shirts/overshirts, or if either
 * IDM-VTON step fails.
 */
export async function generateFullLook(
  top: ClothingItem,
  bottom: ClothingItem,
  shoes?: ClothingItem,
): Promise<string | null> {
  if (!process.env.REPLICATE_API_TOKEN || !process.env.TRYON_BASE_IMAGE) return null;
  if (!top.imageUrl || !bottom.imageUrl) return null;

  const path = `tryon/full-${top.id}-${bottom.id}${shoes?.imageUrl ? `-${shoes.id}` : ''}.png`;
  // Instant when pre-generated — the nightly cron warms this.
  const cached = await findBlob(path).catch(() => null);
  if (cached) return cached;

  if (isTryonFriendlyTop(top)) {
    try {
      const body = await generateIdmVtonFullLook(top, bottom, shoes ? `${path}.body.png` : path);
      if (body) {
        if (!shoes) return body;
        try {
          const withShoes = await addShoesNanoBanana(body, shoes, path);
          if (withShoes) return withShoes;
        } catch (err) {
          console.error('[TRYON ADD-SHOES]', err);
        }
        // Shoes step failed — an identity-correct barefoot body beats risking a
        // full nano-banana regeneration. Re-save under the outfit's own cache key.
        return uploadImageFromUrl(body, path);
      }
    } catch (err) {
      console.error('[TRYON IDM-VTON]', err);
    }
  }

  try {
    return await generateLookNanoBanana(top, bottom, shoes, path);
  } catch (err) {
    console.error('[TRYON NANO-BANANA]', err);
    return null;
  }
}

async function generateLookNanoBanana(
  top: ClothingItem,
  bottom: ClothingItem,
  shoes: ClothingItem | undefined,
  outPath: string,
): Promise<string | null> {
  const replicate = getClient();
  const images = [process.env.TRYON_BASE_IMAGE!, top.imageUrl!, bottom.imageUrl!];
  const garments = [
    `as the top: ${buildGarmentDescription(top)}`,
    `as the bottoms: ${buildGarmentDescription(bottom)}`,
  ];
  if (shoes?.imageUrl) {
    images.push(shoes.imageUrl);
    garments.push(`as the shoes: ${buildGarmentDescription(shoes)}`);
  }
  const prompt =
    `Dress the man from the first photo in the garments shown in the following photos — ` +
    `${garments.join('; ')}. Keep his face, hair, body, pose and the background of the ` +
    `first photo exactly as they are. The clothes must keep their true colours, patterns ` +
    `and fit. Full-body, photorealistic.`;

  const output = await replicate.run('google/nano-banana', {
    input: { prompt, image_input: images, output_format: 'png' },
  });
  const tempUrl = extractUrl(output);
  if (!tempUrl) return null;
  return uploadImageFromUrl(String(tempUrl), outPath);
}

/**
 * Add shoes to an already-dressed (IDM-VTON) body via a localised Nano Banana
 * edit — a small, targeted change drifts far less than regenerating the whole
 * scene from the base photo the way generateLookNanoBanana does.
 */
async function addShoesNanoBanana(
  bodyImageUrl: string,
  shoes: ClothingItem,
  outPath: string,
): Promise<string | null> {
  const replicate = getClient();
  const prompt =
    `This man is currently barefoot. Put the exact shoes shown in the second photo on ` +
    `his feet — as the shoes: ${buildGarmentDescription(shoes)}. Keep his face, hair, ` +
    `body, pose, his current top and trousers, and the background exactly as they are ` +
    `in the first photo — only add the shoes onto his feet. Photorealistic, full body, ` +
    `nothing else changes.`;

  const output = await replicate.run('google/nano-banana', {
    input: { prompt, image_input: [bodyImageUrl, shoes.imageUrl!], output_format: 'png' },
  });
  const tempUrl = extractUrl(output);
  if (!tempUrl) return null;
  return uploadImageFromUrl(String(tempUrl), outPath);
}

/**
 * Compose a full-look try-on via two IDM-VTON passes: the bottom on the base
 * photo, then the top over that. Bottom first, then the top over it — if we did
 * the top first, a strongly coloured top bled its colour into the trousers on the
 * second (lower-body) pass. Setting the trousers first and finishing with the
 * upper body keeps both colours true.
 */
async function generateIdmVtonFullLook(
  top: ClothingItem,
  bottom: ClothingItem,
  outPath: string,
): Promise<string | null> {
  const step1 = await runTryonToPath(bottom, undefined, `${outPath}.bottom-step.png`);
  if (!step1) return null;
  return runTryonToPath(top, step1, outPath);
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

/** Poll a prediction until complete, persist to Blob, return permanent URL */
export async function waitForPrediction(
  predictionId: string,
  timeoutMs: number = 120_000,
  itemId?: string,
): Promise<string | null> {
  const replicate = getClient();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const p = await replicate.predictions.get(predictionId);
    if (p.status === 'succeeded') {
      const tempUrl = extractUrl(p.output);
      if (!tempUrl) return null;
      const filename = itemId ? `tryon/${itemId}.png` : `tryon/${predictionId}.png`;
      return uploadImageFromUrl(tempUrl, filename);
    }
    if (p.status === 'failed' || p.status === 'canceled') throw new Error(`Prediction ${p.status}: ${p.error}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Prediction timed out');
}
