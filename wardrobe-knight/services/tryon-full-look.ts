import type { ClothingItem } from '../types/wardrobe.js';
import { cropForShoes, digest, IDENTITY_PROFILE, mergeShoes, normalizeReference, preserveIdentity } from './tryon-identity.js';

export const IDM_VERSION = '3b032a70c29aef7b9c3222f2e40b71660201d8c288336475ba326f3ca278a3e1';
const PIPELINE_VERSION = 'identity-locked-v1';
const SHOE_MODEL = 'google/nano-banana';

export interface FullLookServices {
  readImage(url: string): Promise<Buffer>;
  run(model: string, input: Record<string, unknown>): Promise<Buffer>;
  cached(path: string): Promise<string | null>;
  save(bytes: Buffer, path: string): Promise<string>;
  checkDeadline(): void;
}

export function isTryonFriendlyTop(item: ClothingItem): boolean {
  const cat = item.categorie.toLowerCase();
  const sub = item.sousCategorie.toLowerCase();
  const s = `${cat} ${sub}`;
  if (/cardigan|zip|ouvert|open/.test(s)) return false;
  if (/t-?shirt|polo/.test(s)) return true;
  if (/sweater|pull|maille|knit/.test(cat) || /col rond|crew|col roulé/.test(sub)) return true;
  return /hoodie|sweat/.test(cat);
}

function description(item: ClothingItem): string {
  return [item.categorie, item.sousCategorie, item.couleur, item.matiere, item.marque, item.modele, item.coupe].filter(Boolean).join(' ');
}

function dataUri(bytes: Buffer): string {
  // Image inputs are decoded by the provider; source photographs can be JPEG,
  // PNG or WebP. Detect their media type rather than labelling all bytes PNG.
  const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
    : bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

/** Includes contents, not just URLs: photos can be replaced at the same URL. */
export function fullLookCachePath(reference: Buffer, garments: { item: ClothingItem; bytes: Buffer }[]): string {
  const key = digest(JSON.stringify({
    pipeline: PIPELINE_VERSION,
    identity: IDENTITY_PROFILE,
    models: [IDM_VERSION, SHOE_MODEL],
    reference: digest(reference),
    garments: garments.map(({ item, bytes }) => ({ id: item.id, description: description(item), image: digest(bytes) })),
  }));
  return `tryon/${PIPELINE_VERSION}/${key}`;
}

/**
 * No whole-person generative fallback. Unsupported garments or failed steps
 * produce no preview; the outfit recommendation still reaches Slack.
 */
export async function renderFullLook(
  referenceUrl: string,
  top: ClothingItem,
  bottom: ClothingItem,
  shoes: ClothingItem | undefined,
  services: FullLookServices,
): Promise<string | null> {
  if (!top.imageUrl || !bottom.imageUrl || (shoes && !shoes.imageUrl)) {
    console.warn('[TRYON SKIPPED] Missing garment photo');
    return null;
  }
  if (!isTryonFriendlyTop(top)) {
    console.warn('[TRYON SKIPPED] Unsupported layered/open top', top.id);
    return null;
  }

  services.checkDeadline();
  const source = await services.readImage(referenceUrl);
  const reference = await normalizeReference(source);
  const garments = await Promise.all([top, bottom, ...(shoes ? [shoes] : [])].map(async item => ({
    item, bytes: await services.readImage(item.imageUrl!),
  })));
  const root = fullLookCachePath(source, garments);
  const finalPath = `${root}/final.png`;
  const cached = await services.cached(finalPath);
  if (cached) return cached;

  async function idmPass(index: number, human: Buffer, path: string, category: string): Promise<Buffer> {
    services.checkDeadline();
    const previous = await services.cached(path);
    if (previous) return services.readImage(previous);
    const garment = garments[index];
    const generated = await services.run(`cuuupid/idm-vton:${IDM_VERSION}`, {
      human_img: dataUri(human), garm_img: dataUri(garment.bytes),
      garment_des: description(garment.item), category,
      crop: false, steps: 30, seed: 42,
    });
    const locked = await preserveIdentity(reference, generated);
    services.checkDeadline();
    await services.save(locked, path);
    return locked;
  }

  // Reuse successful stages after a timeout, without reusing legacy previews.
  // Bottom first prevents a strongly coloured top bleeding into the trousers.
  const lower = await idmPass(1, reference, `${root}/bottom.png`, 'lower_body');
  let body = await idmPass(0, lower, `${root}/body.png`, 'upper_body');

  if (shoes) {
    services.checkDeadline();
    const crop = await cropForShoes(body);
    const generated = await services.run(SHOE_MODEL, {
      prompt: `Edit this cropped lower-body photograph. Replace ONLY the footwear with the exact shoes in image 2: ${description(shoes)}. `
        + 'Keep the ankles, legs, trousers, background, scale and camera framing fixed. '
        + 'Do not extend the image or add an upper body, head or another person. Return the same crop and aspect ratio.',
      image_input: [dataUri(crop), dataUri(garments[2].bytes)],
      // match_input_image can follow the portrait garment reference instead of
      // our landscape crop. This calibrated lower-half crop is exactly 3:2.
      aspect_ratio: '3:2', output_format: 'png',
    });
    body = await mergeShoes(body, generated);
  }

  services.checkDeadline();
  // A failed shoe edit must never cache a barefoot body as a finished look.
  return services.save(body, finalPath);
}
