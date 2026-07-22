/**
 * Endpoint guards.
 *
 * Every route under /api that spends money (Replicate), sends the user Slack
 * messages, or writes the sheet was reachable by any anonymous caller. These two
 * guards close that: a shared secret for the money/write endpoints, and Vercel's
 * own cron signal for the scheduled routes.
 */

import type { Request, Response } from 'express';

/**
 * Require a shared secret. Used on the Replicate-spend endpoints so a stranger —
 * or a link-preview crawler hitting a plain GET — can't burn credits.
 *
 * Accepts the secret as `Authorization: Bearer <secret>` or `?key=<secret>`.
 * Returns true when the caller is authorised; otherwise it has already written a
 * 401/500 and the handler must stop.
 */
export function requireSecret(req: Request, res: Response): boolean {
  const expected = process.env.API_SECRET;
  if (!expected) {
    // Fail closed: with no secret set, nobody gets in. A missing secret must never
    // silently make the endpoint public again.
    res.status(500).json({ error: 'API_SECRET not configured' });
    return false;
  }

  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const provided = bearer || (req.query.key as string | undefined) || '';

  if (provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

/**
 * Allow only Vercel's scheduler (or a call carrying a shared secret, for manual
 * runs).
 *
 * The primary check is Vercel's documented mechanism: when a `CRON_SECRET` env
 * var exists, Vercel sends `Authorization: Bearer ${CRON_SECRET}` on every
 * scheduled invocation. We rely on that rather than the `x-vercel-cron` header —
 * that header turned out not to reach the function reliably here (the guard was
 * 401-ing real scheduled runs, which silently killed the daily outfit for a
 * week). `x-vercel-cron` is kept only as a best-effort fallback.
 *
 * `API_SECRET` is also accepted so a human can trigger a run by hand.
 */
export function requireCron(req: Request, res: Response): boolean {
  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && bearer === cronSecret) return true;

  const apiSecret = process.env.API_SECRET;
  if (apiSecret && bearer === apiSecret) return true;

  // Best-effort fallback for platforms that do set the header.
  if (req.headers['x-vercel-cron']) return true;

  res.status(401).json({ error: 'Unauthorized' });
  return false;
}
