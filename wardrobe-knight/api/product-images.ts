import type { Request, Response } from 'express';
import * as sheets from '../services/sheets.js';
import { createProductPrediction, waitForProductPrediction } from '../services/product-image.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function createWithRetry(
  item: Parameters<typeof createProductPrediction>[0],
  maxRetries = 2,
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

export default async function handler(req: Request, res: Response): Promise<void> {
  const items = await sheets.getAll();
  const regenerate = req.query.regenerate === 'true';
  const itemId = req.query.id as string | undefined;

  const offset = parseInt(req.query.offset as string) || 0;

  let pending: typeof items;
  if (itemId) {
    pending = items.filter((i) => i.id === itemId);
  } else if (regenerate) {
    pending = items.filter((i) => i.imageUrl);
  } else {
    pending = items.filter((i) => !i.productUrl);
  }

  if (pending.length === 0 || offset >= pending.length) {
    res.status(200).json({ ok: true, message: 'No items to process', total: items.length, remaining: 0 });
    return;
  }

  // Claude Vision (~8s) + FLUX create (~3s) + poll (~15s) ≈ 26s per item
  const limit = parseInt(req.query.limit as string) || 5;
  const BATCH = Math.min(limit, 10);
  const batch = pending.slice(offset, offset + BATCH);
  const results: { id: string; status: string; productUrl?: string }[] = [];
  const startTime = Date.now();

  for (const item of batch) {
    if (Date.now() - startTime > 260_000) break;

    try {
      const predId = await createWithRetry(item);
      if (!predId) {
        results.push({ id: item.id, status: 'skipped' });
        continue;
      }
      const productUrl = await waitForProductPrediction(predId, item.id, 30_000);
      if (productUrl) {
        await sheets.update(item.id, { productUrl } as any);
        results.push({ id: item.id, status: 'ok', productUrl });
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
  const nextOffset = offset + batch.length;
  const remaining = pending.length - nextOffset;
  res.status(200).json({
    ok: true,
    processed: ok,
    errors: results.filter((r) => r.status.startsWith('error') || r.status === 'no credit').length,
    remaining: Math.max(0, remaining),
    nextOffset,
    results,
  });
}
