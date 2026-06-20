import type { Request, Response } from 'express';
import Replicate from 'replicate';
import * as sheets from '../services/sheets.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default async function handler(_req: Request, res: Response): Promise<void> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const items = await sheets.getAll();

  // Items that have a photo but no clean version yet (tryonUrl column reused for clean photo)
  const pending = items.filter((i) => i.imageUrl && !i.tryonUrl);

  if (pending.length === 0) {
    res.status(200).json({ ok: true, message: 'All items already processed', total: items.length });
    return;
  }

  const BATCH = 3;
  const batch = pending.slice(0, BATCH);
  const results: { id: string; status: string; cleanUrl?: string }[] = [];

  // Create all predictions
  const predictions: { predId: string; itemId: string }[] = [];

  for (const item of batch) {
    try {
      const prediction = await replicate.predictions.create({
        version: 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003',
        input: { image: item.imageUrl },
      });
      predictions.push({ predId: prediction.id, itemId: item.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg.includes('429')) {
        // Wait and retry once
        await sleep(12000);
        try {
          const prediction = await replicate.predictions.create({
            version: 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003',
            input: { image: item.imageUrl },
          });
          predictions.push({ predId: prediction.id, itemId: item.id });
        } catch {
          results.push({ id: item.id, status: `error: ${msg.slice(0, 80)}` });
        }
      } else {
        results.push({ id: item.id, status: `error: ${msg.slice(0, 80)}` });
      }
    }
  }

  // Poll all predictions in parallel
  const pollResults = await Promise.allSettled(
    predictions.map(async (p) => {
      const start = Date.now();
      while (Date.now() - start < 60_000) {
        const pred = await replicate.predictions.get(p.predId);
        if (pred.status === 'succeeded') {
          const output = pred.output;
          const url = typeof output === 'string' ? output : Array.isArray(output) ? output[0] : null;
          return { itemId: p.itemId, cleanUrl: url };
        }
        if (pred.status === 'failed' || pred.status === 'canceled') {
          throw new Error(`${pred.status}: ${pred.error}`);
        }
        await sleep(2000);
      }
      throw new Error('timeout');
    }),
  );

  for (const r of pollResults) {
    if (r.status === 'fulfilled' && r.value.cleanUrl) {
      // Save clean photo URL in tryonUrl column (we'll use it for display + try-on later)
      await sheets.update(r.value.itemId, { tryonUrl: r.value.cleanUrl } as any);
      results.push({ id: r.value.itemId, status: 'ok', cleanUrl: r.value.cleanUrl });
    } else if (r.status === 'rejected') {
      results.push({ id: 'unknown', status: `error: ${r.reason?.message?.slice(0, 80) ?? 'failed'}` });
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const remaining = pending.length - batch.length;
  res.status(200).json({
    ok: true,
    processed: ok,
    errors: results.filter((r) => r.status.startsWith('error')).length,
    remaining: remaining > 0 ? `${remaining} left — call again` : 0,
    results,
  });
}
