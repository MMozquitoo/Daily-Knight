import type { Request, Response } from 'express';
import * as sheets from '../services/sheets.js';
import { generateTryOn } from '../services/tryon.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

export default async function handler(req: Request, res: Response): Promise<void> {
  const items = await sheets.getAll();
  const pending = items.filter((i) => i.imageUrl && !i.tryonUrl);

  if (pending.length === 0) {
    res.status(200).json({ ok: true, message: 'All items already have try-on images', total: items.length });
    return;
  }

  const results: { id: string; status: string; tryonUrl?: string }[] = [];

  for (const item of pending) {
    try {
      const tryonUrl = await generateTryOn(item);
      if (tryonUrl) {
        await sheets.update(item.id, { tryonUrl } as any);
        results.push({ id: item.id, status: 'ok', tryonUrl });
      } else {
        results.push({ id: item.id, status: 'skipped' });
      }
    } catch (err) {
      results.push({ id: item.id, status: `error: ${err instanceof Error ? err.message : 'unknown'}` });
    }
  }

  res.status(200).json({
    ok: true,
    processed: results.length,
    results,
  });
}
