import type { Request, Response } from 'express';
import * as sheets from '../services/sheets.js';
import { generateTryOn } from '../services/tryon.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

const DELAY_MS = 12_000; // 5 req/min to respect Replicate rate limits
const BATCH_SIZE = 20; // max per call (~4 min with delays)

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default async function handler(req: Request, res: Response): Promise<void> {
  const items = await sheets.getAll();
  const pending = items.filter((i) => i.imageUrl && !i.tryonUrl);

  if (pending.length === 0) {
    res.status(200).json({ ok: true, message: 'All items already have try-on images', total: items.length });
    return;
  }

  const batch = pending.slice(0, BATCH_SIZE);
  const results: { id: string; status: string; tryonUrl?: string }[] = [];

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    try {
      const tryonUrl = await generateTryOn(item);
      if (tryonUrl) {
        await sheets.update(item.id, { tryonUrl } as any);
        results.push({ id: item.id, status: 'ok', tryonUrl });
      } else {
        results.push({ id: item.id, status: 'skipped' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg.includes('402')) {
        results.push({ id: item.id, status: 'error: no credit — add payment at replicate.com/account/billing' });
        break;
      }
      results.push({ id: item.id, status: `error: ${msg}` });
    }

    // Rate limit pause (skip after last item)
    if (i < batch.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const remaining = pending.length - batch.length;
  res.status(200).json({
    ok: true,
    processed: results.filter((r) => r.status === 'ok').length,
    errors: results.filter((r) => r.status.startsWith('error')).length,
    remaining: remaining > 0 ? `${remaining} items left — call this endpoint again` : 0,
    results,
  });
}
