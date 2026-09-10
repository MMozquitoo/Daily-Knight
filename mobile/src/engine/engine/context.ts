/**
 * Context Builder
 *
 * Combines weather data, agenda summary, and user preferences
 * into a single DailyContext object for the engine.
 */

import type { AgendaSummary } from '../types/agenda';
import type { DailyContext } from '../types/context';
import type { FormalityLevel } from '../types/wardrobe';
import type { DayWeather } from '../types/weather';

export function buildDailyContext(
  weather: DayWeather,
  agenda: AgendaSummary,
  stylePreference: FormalityLevel | 'mixed' = 'mixed',
  location = 'Paris',
  date = new Date().toISOString().slice(0, 10),
): DailyContext {
  return {
    date,
    location,
    weather,
    agenda,
    userStylePreference: stylePreference,
  };
}
