/**
 * Context Builder
 *
 * Combines weather data, agenda summary, and user preferences
 * into a single DailyContext object.
 *
 * This is the first step of the decision pipeline:
 *   context.ts → filter.ts → scorer.ts → assembler.ts → validator.ts → carry.ts → why.ts
 *
 * Pure function. No side effects. No API calls.
 * Data fetching happens in services/ — this module only structures the input.
 */

import type { AgendaSummary } from '@/types/agenda';
import type { DailyContext } from '@/types/context';
import type { UserProfile } from '@/types/user';
import type { WeatherData } from '@/types/weather';

export function buildDailyContext(
  weather: WeatherData,
  agenda: AgendaSummary,
  userProfile: UserProfile,
  date = new Date().toISOString().slice(0, 10),
): DailyContext {
  return {
    date,
    location: userProfile.location,
    weather,
    agenda,
    userStylePreference: userProfile.stylePreference,
  };
}
