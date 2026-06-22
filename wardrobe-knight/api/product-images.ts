import type { Request, Response } from 'express';
import * as sheets from '../services/sheets.js';
import { createProductPrediction, waitForProductPrediction } from '../services/product-image.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function createWithRetry(
  item: Parameters<typeof createProductPrediction>[0],
  maxRetries = 3,
): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await createProductPrediction(item);
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

export default async function handler(_req: Request, res: Response): Promise<void> {
  const items = await sheets.getAll();
  const pending = items.filter((i) => !i.productUrl);

  if (pending.length === 0) {
    res.status(200).json({ ok: true, message: 'All items already have product images', total: items.length });
    return;
  }

  const BATCH = 12;
  const batch = pending.slice(0, BATCH);
  const predictions: { predId: string; itemId: string }[] = [];
  const results: { id: string; status: string; productUrl?: string }[] = [];
  const startTime = Date.now();

  for (const item of batch) {
    if (Date.now() - startTime > 200_000) break;

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

  const pollResults = await Promise.allSettled(
    predictions.map(async (p) => {
      const productUrl = await waitForProductPrediction(p.predId, p.itemId, 60_000);
      return { itemId: p.itemId, productUrl };
    }),
  );

  for (const r of pollResults) {
    if (r.status === 'fulfilled' && r.value.productUrl) {
      await sheets.update(r.value.itemId, { productUrl: r.value.productUrl } as any);
      results.push({ id: r.value.itemId, status: 'ok', productUrl: r.value.productUrl });
    } else if (r.status === 'fulfilled') {
      results.push({ id: r.value.itemId, status: 'skipped' });
    } else {
      results.push({ id: 'unknown', status: `error: ${r.reason?.message?.slice(0, 80) ?? 'failed'}` });
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const remaining = pending.length - batch.length + (batch.length - ok);
  res.status(200).json({
    ok: true,
    processed: ok,
    errors: results.filter((r) => r.status.startsWith('error') || r.status === 'no credit').length,
    remaining,
    results,
  });
}
