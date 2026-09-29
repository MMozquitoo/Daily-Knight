import { createHash } from 'node:crypto';
import sharp from 'sharp';

/** Calibrated to /api/base-photo, NOT assets/base-photo.jpg (which has no face). */
export const IDENTITY_PROFILE = {
  version: 'adrien-head-v1',
  referenceSha256: 'aa09842dbf7b7bbe378a381f787f06d3ec327cedefe24f676be71107d38375fb',
  width: 768,
  height: 1024,
  // Background + entire head, tapering at the neck to leave collars editable.
  protectedPolygon: '0,0 768,0 768,180 454,180 432,202 424,210 370,210 360,202 337,180 0,180',
  neckFadeStart: 202,
  neckFadeEnd: 210,
  shoeCropTop: 512,
  shoeEditTop: 870,
  shoeBlendPixels: 24,
} as const;

export function digest(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function normalizeReference(bytes: Buffer): Promise<Buffer> {
  // A mask for a different photo could leave the real face exposed. Require a
  // deliberate recalibration when replacing the reference, even at the same URL.
  if (digest(bytes) !== IDENTITY_PROFILE.referenceSha256) {
    throw new Error('TRYON_REFERENCE_CHANGED: recalibrate tryon-identity.ts before rendering');
  }
  return sharp(bytes).rotate().removeAlpha().toColourspace('srgb').png().toBuffer();
}

async function alignedImage(bytes: Buffer, width: number, height: number): Promise<Buffer> {
  const meta = await sharp(bytes).metadata();
  if (!meta.width || !meta.height || Math.abs((meta.width / meta.height) / (width / height) - 1) > 0.02) {
    throw new Error('TRYON_FRAMING_CHANGED: refusing to stretch or crop a generated person');
  }
  return sharp(bytes).resize(width, height, { fit: 'fill' }).removeAlpha().toColourspace('srgb').png().toBuffer();
}

/** Copy the original head pixels after EVERY diffusion pass, before caching. */
export async function preserveIdentity(reference: Buffer, generated: Buffer): Promise<Buffer> {
  const { width, height, protectedPolygon, neckFadeStart, neckFadeEnd } = IDENTITY_PROFILE;
  const aligned = await alignedImage(generated, width, height);
  // Fade only the neck seam, below the face. Hair, eyes, glasses and beard stay
  // opaque; copying the old T-shirt collar would leave a visible cutout.
  const mask = Buffer.from(`<svg width="${width}" height="${height}"><defs>
    <linearGradient id="neck" x1="0" y1="${neckFadeStart}" x2="0" y2="${neckFadeEnd}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/>
    </linearGradient></defs><polygon points="${protectedPolygon}" fill="url(#neck)"/></svg>`);
  const head = await sharp(reference).ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return sharp(aligned).composite([{ input: head }]).png().toBuffer();
}

/** Nano Banana sees only the lower half, and can only contribute shoe pixels. */
export async function cropForShoes(body: Buffer): Promise<Buffer> {
  const { width, height, shoeCropTop } = IDENTITY_PROFILE;
  return sharp(body).extract({ left: 0, top: shoeCropTop, width, height: height - shoeCropTop }).png().toBuffer();
}

export async function mergeShoes(body: Buffer, generatedCrop: Buffer): Promise<Buffer> {
  const { width, height, shoeCropTop, shoeEditTop, shoeBlendPixels } = IDENTITY_PROFILE;
  const aligned = await alignedImage(generatedCrop, width, height - shoeCropTop);
  const region = await sharp(aligned).extract({
    left: 0, top: shoeEditTop - shoeCropTop, width, height: height - shoeEditTop,
  }).png().toBuffer();
  const mask = Buffer.from(`<svg width="${width}" height="${height - shoeEditTop}"><defs>
    <linearGradient id="seam" x1="0" y1="0" x2="0" y2="${shoeBlendPixels}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="white"/>
    </linearGradient></defs><rect width="100%" height="100%" fill="url(#seam)"/></svg>`);
  const shoes = await sharp(region).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return sharp(body).composite([{ input: shoes, top: shoeEditTop, left: 0 }]).png().toBuffer();
}
