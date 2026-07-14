import type { Request, Response } from 'express';
import { requireSecret } from './_auth.js';
import * as sheets from '../services/sheets.js';
import { createTryOnPrediction, waitForPrediction } from '../services/tryon.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function createWithRetry(item: Parameters<typeof createTryOnPrediction>[0], maxRetries = 3): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await createTryOnPrediction(item);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('429') && attempt < maxRetries) {
        const match = msg.match(/retry_after.*?(\d+)/);
        const waitSec = match ? parseInt(match[1]) + 2 : 12;
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
  return null;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!requireSecret(req, res)) return;
  const items = await sheets.getAll();
  const pending = items.filter((i) => i.imageUrl && !i.tryonUrl);

  if (pending.length === 0) {
    res.status(200).json({ ok: true, message: 'All items already have try-on images', total: items.length });
    return;
  }

  // Process up to 12 items: create sequentially (rate limited), poll in parallel
  const BATCH = 12;
  const batch = pending.slice(0, BATCH);
  const predictions: { predId: string; itemId: string }[] = [];
  const results: { id: string; status: string; tryonUrl?: string }[] = [];
  const startTime = Date.now();

  // Phase 1: Create predictions one at a time with retry on 429
  for (const item of batch) {
    if (Date.now() - startTime > 200_000) break; // leave 100s for polling

    try {
      const predId = await createWithRetry(item);
      if (predId) {
        predictions.push({ predId, itemId: item.id });
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

  // Phase 2: Poll all predictions in parallel
  const pollResults = await Promise.allSettled(
    predictions.map(async (p) => {
      const tryonUrl = await waitForPrediction(p.predId, 90_000, p.itemId);
      return { itemId: p.itemId, tryonUrl };
    }),
  );

  for (const r of pollResults) {
    if (r.status === 'fulfilled' && r.value.tryonUrl) {
      await sheets.update(r.value.itemId, { tryonUrl: r.value.tryonUrl } as any);
      results.push({ id: r.value.itemId, status: 'ok', tryonUrl: r.value.tryonUrl });
    } else if (r.status === 'fulfilled') {
      results.push({ id: r.value.itemId, status: 'skipped' });
    } else {
      results.push({ id: 'unknown', status: `error: ${r.reason?.message?.slice(0, 80) ?? 'failed'}` });
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const remaining = pending.length - batch.length + (batch.length - ok - results.filter(r => r.status === 'skipped').length);
  res.status(200).json({
    ok: true,
    processed: ok,
    errors: results.filter((r) => r.status.startsWith('error') || r.status === 'no credit').length,
    remaining,
    results,
  });
}
