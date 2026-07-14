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
