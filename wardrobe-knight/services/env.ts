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
  const credentials = JSON.parse(raw) as GoogleServiceAccount;

  if (typeof credentials.private_key === 'string') {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return credentials;
}
