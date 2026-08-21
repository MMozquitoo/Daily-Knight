import dotenv from 'dotenv';

dotenv.config();
// .env.local overrides .env — same convention as Next.js, for local one-off
// switches (e.g. CURRENT_TRIP_ORIGIN) without editing the shared .env file.
dotenv.config({ path: '.env.local', override: true });

await import('./bot/index.js');
