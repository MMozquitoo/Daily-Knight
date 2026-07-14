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
 * Allow only Vercel's scheduler (or a call carrying the shared secret, for manual
 * runs). Vercel attaches `x-vercel-cron: 1` to scheduled invocations and this
 * header cannot be set by an external HTTP caller reaching the function.
 */
export function requireCron(req: Request, res: Response): boolean {
  if (req.headers['x-vercel-cron']) return true;

  // Manual trigger with the secret is fine; anonymous is not
  const expected = process.env.API_SECRET;
  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (expected && bearer === expected) return true;

  res.status(401).json({ error: 'Unauthorized' });
  return false;
}
