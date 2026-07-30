/**
 * Adrien's style profile — read-only fetch from the "Mage Stylist — Mon profil
 * de style" Google Doc (Profil de style / Direction de style / Charte
 * vestimentaire — see docs/adrien-style-profile-prompt.md for how it gets filled).
 *
 * GOOGLE_STYLE_DOC_ID is optional: until Adrien fills the doc, callers should
 * treat a missing/empty result as "no style profile yet" and reason from
 * general knowledge instead of failing.
 */

import { google } from 'googleapis';
import { getGoogleServiceAccount, getStyleDocId } from './env.js';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: getGoogleServiceAccount(),
    scopes: ['https://www.googleapis.com/auth/documents.readonly'],
  });
}

function extractText(doc: { body?: { content?: unknown[] } }): string {
  const content = doc.body?.content ?? [];
  let text = '';
  for (const el of content as any[]) {
    for (const run of el.paragraph?.elements ?? []) {
      if (run.textRun?.content) text += run.textRun.content;
    }
  }
  return text.trim();
}

/** Fetch the style profile doc as plain text, or undefined if unset/unreadable. */
export async function getStyleProfileText(): Promise<string | undefined> {
  const docId = getStyleDocId();
  if (!docId) return undefined;

  try {
    const docs = google.docs({ version: 'v1', auth: getAuth() });
    const res = await docs.documents.get({ documentId: docId });
    const text = extractText(res.data as any);
    return text || undefined;
  } catch {
    // Doc not shared with the service account yet, or a transient API error —
    // photo analysis should degrade gracefully, not fail the whole upload.
    return undefined;
  }
}
