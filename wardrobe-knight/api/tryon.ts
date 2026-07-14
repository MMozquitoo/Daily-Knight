import type { Request, Response } from 'express';
import { requireSecret } from './_auth.js';
import * as sheets from '../services/sheets.js';
import { createTryOnPrediction, waitForPrediction } from '../services/tryon.js';

// Hobby caps functions at 60s and vercel.json pins api/** to 60 — declaring 300
// was a lie that got the handler killed mid-write, orphaning paid predictions.
export const config = { runtime: 'nodejs', maxDuration: 60 };

/** Stop creating new paid work with enough margin to persist what's in flight */
const TIME_BUDGET_MS = 50_000;

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

  // One item at a time: create → wait → persist, before moving on. The old code
  // created all 12 up front then polled, so a 60s kill kept the money (predictions
  // made) but lost the result (never written), and the next call re-created them.
  // Persisting per item means whatever finishes in the window is saved for good.
  const results: { id: string; status: string; tryonUrl?: string }[] = [];
  const startTime = Date.now();

  for (const item of pending) {
    if (Date.now() - startTime > TIME_BUDGET_MS) break;

    try {
      const predId = await createWithRetry(item);
      if (!predId) {
        results.push({ id: item.id, status: 'skipped' });
        continue;
      }
      const tryonUrl = await waitForPrediction(predId, 40_000, item.id);
      if (tryonUrl) {
        await sheets.update(item.id, { tryonUrl } as any);
        results.push({ id: item.id, status: 'ok', tryonUrl });
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
