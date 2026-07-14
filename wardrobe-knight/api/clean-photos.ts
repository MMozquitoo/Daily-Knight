import type { Request, Response } from 'express';
import { requireSecret } from './_auth.js';
import Replicate from 'replicate';
import * as sheets from '../services/sheets.js';
import { uploadImageFromUrl } from '../services/blob.js';

// Hobby caps at 60s (vercel.json pins api/** to 60); 300 was killed mid-write.
export const config = { runtime: 'nodejs', maxDuration: 60 };

const CLEAN_MODEL = 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003';
const TIME_BUDGET_MS = 50_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!requireSecret(req, res)) return;
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const items = await sheets.getAll();

  // Items that have a photo but no clean version yet (tryonUrl column reused for clean photo)
  const pending = items.filter((i) => i.imageUrl && !i.tryonUrl);

  if (pending.length === 0) {
    res.status(200).json({ ok: true, message: 'All items already processed', total: items.length });
    return;
  }

  const results: { id: string; status: string; cleanUrl?: string }[] = [];
  const startTime = Date.now();

  // One at a time: create → poll → upload to Blob → persist, before the next. The
  // old code created all three then polled, so a 60s kill kept the paid prediction
  // and lost the result. Per-item persistence saves whatever finishes in the window.
  for (const item of pending) {
    if (Date.now() - startTime > TIME_BUDGET_MS) break;

    try {
      const prediction = await replicate.predictions.create({
        version: CLEAN_MODEL,
        input: { image: item.imageUrl },
      });

      let cleanUrl: string | null = null;
      const pollStart = Date.now();
      while (Date.now() - pollStart < 40_000) {
        const pred = await replicate.predictions.get(prediction.id);
        if (pred.status === 'succeeded') {
          const output = pred.output;
          cleanUrl = typeof output === 'string' ? output : Array.isArray(output) ? output[0] : null;
          break;
        }
        if (pred.status === 'failed' || pred.status === 'canceled') {
          throw new Error(`${pred.status}: ${pred.error}`);
        }
        await sleep(2000);
      }

      if (cleanUrl) {
        const permanentUrl = await uploadImageFromUrl(cleanUrl, `clean/${item.id}.png`);
        await sheets.update(item.id, { tryonUrl: permanentUrl } as any);
        results.push({ id: item.id, status: 'ok', cleanUrl: permanentUrl });
      } else {
        results.push({ id: item.id, status: 'skipped' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg.includes('402')) {
        results.push({ id: item.id, status: 'no credit' });
        break;
      }
      results.push({ id: item.id, status: `error: ${msg.slice(0, 80)}` });
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const remaining = pending.length - results.filter((r) => r.status === 'ok' || r.status === 'skipped').length;
  res.status(200).json({
    ok: true,
    processed: ok,
    errors: results.filter((r) => r.status.startsWith('error') || r.status === 'no credit').length,
    remaining: Math.max(0, remaining),
    results,
  });
}
