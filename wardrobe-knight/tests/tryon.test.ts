import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { extractUrl } from '../services/tryon.js';
import { fullLookCachePath, renderFullLook, type FullLookServices } from '../services/tryon-full-look.js';
import { cropForShoes, IDENTITY_PROFILE, mergeShoes, normalizeReference, preserveIdentity } from '../services/tryon-identity.js';
import type { ClothingItem } from '../types/wardrobe.js';

const route = await readFile(new URL('../api/base-photo.ts', import.meta.url), 'utf8');
const source = Buffer.from(route.match(/const IMG = '([^']+)'/)![1], 'base64');
const reference = await normalizeReference(source);
const { width, height, shoeEditTop } = IDENTITY_PROFILE;
const solid = (background: string, w: number = width, h: number = height) =>
  sharp({ create: { width: w, height: h, channels: 3, background } }).png().toBuffer();
const pixels = (image: Buffer, region: sharp.Region) => sharp(image).extract(region).removeAlpha().raw().toBuffer();

function garment(id: string, categorie: string, imageUrl = `https://wardrobe.test/${id}`): ClothingItem {
  return {
    id, categorie, imageUrl, sousCategorie: '', marque: '', modele: '', couleur: 'Noir',
    palette: 'neutre', matiere: 'coton', coupe: 'regular', niveau: 'casual',
    saison: 'toutes', formalite: 1, impact: 1, polyvalence: 3, etat: 'bon',
  };
}
const top = garment('TS-01', 't-shirt');
const bottom = garment('PA-01', 'pants');
const shoes = garment('SO-01', 'shoes');

test('reference replacement requires recalibration instead of protecting the wrong area', async () => {
  await assert.rejects(normalizeReference(await solid('white')), /TRYON_REFERENCE_CHANGED/);
});

test('diffusion cannot alter a single pixel of the original face, hair or glasses', async () => {
  const generated = await solid('red');
  const locked = await preserveIdentity(reference, generated);
  const head = { left: 335, top: 55, width: 120, height: 120 };
  const face = { left: 364, top: 120, width: 60, height: 80 };
  assert.ok((await pixels(locked, head)).equals(await pixels(reference, head)), 'hair and glasses changed');
  assert.ok((await pixels(locked, face)).equals(await pixels(reference, face)), 'face and beard changed');
  const shirt = { left: 300, top: 260, width: 180, height: 200 };
  assert.ok((await pixels(locked, shirt)).equals(await pixels(generated, shirt)));
});

test('a reframed generated person is rejected rather than stretched under the original head', async () => {
  await assert.rejects(preserveIdentity(reference, await solid('red', 1024, 1024)), /TRYON_FRAMING_CHANGED/);
});

test('shoe model cannot modify the head, torso or upper legs, even if it redraws the whole input', async () => {
  const crop = await cropForShoes(reference);
  const meta = await sharp(crop).metadata();
  assert.equal(meta.width, 768);
  assert.equal(meta.height, 512);
  const result = await mergeShoes(reference, await solid('blue', 768, 512));
  const untouched = { left: 0, top: 0, width, height: shoeEditTop };
  assert.ok((await pixels(result, untouched)).equals(await pixels(reference, untouched)));
});

test('shoe model returning a portrait instead of the landscape crop is rejected', async () => {
  await assert.rejects(mergeShoes(reference, await solid('blue', 832, 1248)), /TRYON_FRAMING_CHANGED/);
});

test('cache invalidates when source bytes or garment descriptions change at the same URLs/IDs', () => {
  const garments = [{ item: top, bytes: Buffer.from('original garment') }];
  const original = fullLookCachePath(source, garments);
  assert.equal(original, fullLookCachePath(source, garments));
  assert.notEqual(original, fullLookCachePath(Buffer.from('new person'), garments));
  assert.notEqual(original, fullLookCachePath(source, [{ item: top, bytes: Buffer.from('new garment') }]));
  assert.notEqual(original, fullLookCachePath(source, [{ ...garments[0], item: { ...top, couleur: 'rouge' } }]));
  assert.notEqual(original, fullLookCachePath(source, [...garments, { item: shoes, bytes: Buffer.from('shoes') }]));
  assert.ok(original.startsWith('tryon/identity-locked-v1/'));
});

async function harness() {
  const photos = new Map<string, Buffer>([
    ['https://reference.test', source],
    [top.imageUrl!, await solid('red')], [bottom.imageUrl!, await solid('black')], [shoes.imageUrl!, await solid('brown')],
  ]);
  const cache = new Map<string, string>();
  const calls: { model: string; input: Record<string, unknown> }[] = [];
  const services: FullLookServices = {
    checkDeadline() {},
    readImage: async url => { const image = photos.get(url); assert.ok(image, url); return image; },
    cached: async path => cache.get(path) ?? null,
    save: async (bytes, path) => {
      const url = `https://cache.test/${path}`;
      photos.set(url, bytes); cache.set(path, url); return url;
    },
    run: async (model, input) => {
      calls.push({ model, input });
      return model === 'google/nano-banana' ? solid('blue', 768, 512) : solid('red');
    },
  };
  return { services, photos, cache, calls };
}

test('complete pipeline protects identity, isolates shoes, caches only the completed outfit and reuses it', async () => {
  const { services, photos, calls } = await harness();
  const url = await renderFullLook('https://reference.test', top, bottom, shoes, services);
  assert.ok(url);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].input.category, 'lower_body');
  assert.equal(calls[1].input.category, 'upper_body');
  assert.equal(calls[0].input.crop, false);
  assert.equal(calls[2].input.aspect_ratio, '3:2');
  const shoeInput = (calls[2].input.image_input as string[])[0];
  const inputMeta = await sharp(Buffer.from(shoeInput.split(',')[1], 'base64')).metadata();
  assert.equal(inputMeta.height, 512, 'the shoe model never receives the face');
  const head = { left: 360, top: 70, width: 65, height: 130 };
  assert.ok((await pixels(photos.get(url)!, head)).equals(await pixels(reference, head)));
  assert.equal(await renderFullLook('https://reference.test', top, bottom, shoes, services), url);
  assert.equal(calls.length, 3, 'cache hit must not create any more paid predictions');
});

test('failed shoes never cache a barefoot final look; retry resumes the saved body', async () => {
  const { services, cache, calls } = await harness();
  const originalRun = services.run;
  services.run = async (model, input) => {
    if (model === 'google/nano-banana') throw new Error('shoe provider unavailable');
    return originalRun(model, input);
  };
  await assert.rejects(renderFullLook('https://reference.test', top, bottom, shoes, services), /shoe provider/);
  assert.equal([...cache.keys()].some(path => path.endsWith('/final.png')), false);
  assert.equal(calls.length, 2);
  services.run = originalRun;
  assert.ok(await renderFullLook('https://reference.test', top, bottom, shoes, services));
  assert.equal(calls.length, 3, 'retry should only generate shoes');
});

test('unsupported tops, missing shoe photos and changed identity do not launch paid work', async () => {
  const { services, photos, calls } = await harness();
  assert.equal(await renderFullLook('https://reference.test', garment('CA-01', 'shirt'), bottom, shoes, services), null);
  assert.equal(await renderFullLook('https://reference.test', top, bottom, { ...shoes, imageUrl: undefined }, services), null);
  photos.set('https://reference.test', await solid('white'));
  await assert.rejects(renderFullLook('https://reference.test', top, bottom, shoes, services), /REFERENCE_CHANGED/);
  assert.equal(calls.length, 0);
});

test('an IDM failure cannot switch to an unconstrained whole-person generator', async () => {
  const { services, calls } = await harness();
  services.run = async (model, input) => { calls.push({ model, input }); throw new Error('IDM unavailable'); };
  await assert.rejects(renderFullLook('https://reference.test', top, bottom, shoes, services), /IDM unavailable/);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].model.startsWith('cuuupid/idm-vton:'));
});

test('expired render stops before creating another prediction or storing a final look', async () => {
  const { services, calls, cache } = await harness();
  services.checkDeadline = () => { throw new Error('deadline'); };
  await assert.rejects(renderFullLook('https://reference.test', top, bottom, shoes, services), /deadline/);
  assert.equal(calls.length, 0);
  assert.equal(cache.size, 0);
});

test('Replicate output handles strings, URLs, and arrays of FileOutput', () => {
  const url = 'https://replicate.delivery/output.png';
  assert.equal(extractUrl(url), url);
  assert.equal(extractUrl([url]), url);
  assert.equal(extractUrl([{ url: () => new URL(url) }]), url);
  assert.equal(extractUrl({ url }), url);
  assert.equal(extractUrl([]), null);
  assert.equal(extractUrl({ url: null }), null);
});
