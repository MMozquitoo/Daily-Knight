import Replicate from 'replicate';
import { categoryFromSheet } from '../types/wardrobe.js';
import type { ClothingItem } from '../types/wardrobe.js';
import { uploadImageFromUrl, uploadImageBuffer, findBlob } from './blob.js';
import { setTimeout as delay } from 'node:timers/promises';
import { IDM_VERSION, renderFullLook } from './tryon-full-look.js';
export { isTryonFriendlyTop } from './tryon-full-look.js';

let client: Replicate | null = null;

function getClient(): Replicate {
  if (!client) {
    client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }
  return client;
}

const MODEL_VERSION = IDM_VERSION;

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

export function extractUrl(output: unknown): string | null {
  const value = Array.isArray(output) ? output[0] : output;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'url' in value) {
    const url = typeof value.url === 'function' ? value.url() : value.url;
    if (typeof url === 'string' || url instanceof URL) return String(url);
  }
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

/**
 * Daily look: identity pixels are restored after clothing edits; the shoe model
 * only receives a lower-body crop. No unconstrained whole-person fallback.
 */
export async function generateFullLook(
  top: ClothingItem,
  bottom: ClothingItem,
  shoes?: ClothingItem,
  options: { timeoutMs?: number } = {},
): Promise<string | null> {
  const referenceUrl = process.env.TRYON_BASE_IMAGE;
  if (!process.env.REPLICATE_API_TOKEN || !referenceUrl) return null;
  const signal = AbortSignal.timeout(Math.max(1, options.timeoutMs ?? 45_000));
  const replicate = getClient();

  async function readImage(url: string): Promise<Buffer> {
    signal.throwIfAborted();
    // The legacy reference endpoint used a year-long immutable cache at a
    // mutable URL. Revalidate it so changing the source invalidates the look.
    const source = new URL(url);
    if (url === referenceUrl) source.searchParams.set('identity', 'v1');
    const response = await fetch(source, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Try-on image fetch failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  try {
    return await renderFullLook(referenceUrl, top, bottom, shoes, {
      readImage,
      checkDeadline: () => signal.throwIfAborted(),
      cached: async (path) => { signal.throwIfAborted(); return findBlob(path, signal); },
      save: (bytes, path) => uploadImageBuffer(bytes, path, 'image/png', signal),
      run: async (model, input) => {
        signal.throwIfAborted();
        const [name, version] = model.split(':');
        // Create asynchronously to obtain the prediction ID immediately. A
        // Promise.race around run() used to leave paid predictions running.
        const prediction = await replicate.predictions.create({
          ...(version ? { version } : { model: name }), input, signal,
        });
        try {
          let current = prediction;
          while (current.status !== 'succeeded') {
            if (current.status === 'failed' || current.status === 'canceled') {
              throw new Error(`Try-on prediction ${current.status}: ${current.error}`);
            }
            await delay(1000, undefined, { signal });
            current = await replicate.predictions.get(prediction.id, { signal });
          }
          const url = extractUrl(current.output);
          if (!url) throw new Error('Try-on prediction returned no image');
          return await readImage(url);
        } catch (error) {
          if (signal.aborted) {
            await replicate.predictions.cancel(prediction.id, { signal: AbortSignal.timeout(3000) })
              .catch(() => console.warn('[TRYON CANCEL FAILED]', prediction.id));
          }
          throw error;
        }
      },
    });
  } catch (error) {
    console.error('[TRYON FULL LOOK]', signal.aborted ? 'Deadline exceeded; preview skipped' : error);
    return null;
  }
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
