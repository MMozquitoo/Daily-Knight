/**
 * Signed image-proxy URLs.
 *
 * /api/images fetches a private files.slack.com URL using the bot token. It has to
 * stay publicly reachable — Slack's own renderer fetches it with no auth to show
 * the image in a message — so a shared secret can't guard it. Instead the bot
 * signs each proxy URL with an HMAC, and the endpoint serves only URLs it can
 * verify it minted. A leaked link still works (it's the same file), but nobody can
 * forge a link to an arbitrary OTHER private file.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

function key(): string {
  // Deliberately the Slack signing secret ALONE, not API_SECRET. This key signs
  // URLs that get persisted in the sheet, so it must stay stable — keying it off
  // API_SECRET would silently invalidate every stored image link the day someone
  // sets or rotates that variable.
  return process.env.SLACK_SIGNING_SECRET || '';
}

export function signFileUrl(fileUrl: string): string {
  return createHmac('sha256', key()).update(fileUrl).digest('hex');
}

export function verifyFileUrl(fileUrl: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = signFileUrl(fileUrl);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
