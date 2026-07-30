type GoogleServiceAccount = {
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
};

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function getGoogleServiceAccount(): GoogleServiceAccount {
  const raw = getRequiredEnv('GOOGLE_SERVICE_ACCOUNT_JSON');

  let credentials: GoogleServiceAccount;
  try {
    credentials = JSON.parse(raw) as GoogleServiceAccount;
  } catch {
    // A raw JSON.parse SyntaxError ("Expected property name…") gives no clue which
    // variable is at fault — and a multi-line private_key that wasn't quoted is the
    // usual cause. Name it.
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON — check the value is single-line and the private_key newlines are escaped as \\n.',
    );
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.');
  }

  if (typeof credentials.private_key === 'string') {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return credentials;
}

/**
 * Where Adrien currently is, for tagging newly-added pieces.
 *
 * There's no calendar signal for a personal trip (only work events carry a
 * location — see services/destination.ts), so this is a manual switch: set
 * CURRENT_TRIP_ORIGIN while Adrien is away, unset it (or set it to "Paris")
 * once he's back.
 */
export function getCurrentOrigin(): string {
  return process.env.CURRENT_TRIP_ORIGIN?.trim() || 'Paris';
}

/** Google Doc ID for Adrien's style profile (Phase 3 — see docs/adrien-style-profile-prompt.md). */
export function getStyleDocId(): string | undefined {
  return process.env.GOOGLE_STYLE_DOC_ID?.trim() || undefined;
}
