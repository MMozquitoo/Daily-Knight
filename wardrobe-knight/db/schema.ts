/**
 * Database Schema — Drizzle ORM + expo-sqlite
 *
 * Tables:
 *
 *   users
 *     - id (text, primary key)
 *     - location (text)
 *     - units (text: 'metric' | 'imperial')
 *     - style_preference (text: 'casual' | 'smart' | 'formal' | 'mixed')
 *     - permission_location (integer: 0 | 1)
 *     - permission_calendar (integer: 0 | 1)
 *     - permission_camera (integer: 0 | 1)
 *     - onboarding_complete (integer: 0 | 1)
 *
 *   wardrobe_items
 *     - id (text, primary key)
 *     - user_id (text, foreign key → users.id)
 *     - name (text)
 *     - type (text)
 *     - category (text)
 *     - template_id (text)
 *     - color (text)
 *     - formality (text)
 *     - contexts (text, JSON array)
 *     - min_temp (integer)
 *     - max_temp (integer)
 *     - rain_ok (integer: 0 | 1)
 *     - wind_ok (integer: 0 | 1)
 *     - availability (text: 'available' | 'unavailable')
 *     - layer (text)
 *     - created_at (text, ISO date)
 *
 *   weather_cache
 *     - date (text, primary key)
 *     - location (text)
 *     - data (text, JSON blob)
 *     - fetched_at (text, ISO datetime)
 *
 * Naming: snake_case for columns, matches SQL convention.
 * TypeScript interfaces use camelCase — mapping happens in stores.
 */

// TODO: Define Drizzle table schemas
