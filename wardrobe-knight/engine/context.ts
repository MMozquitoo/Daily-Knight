/**
 * Context Builder
 *
 * Combines weather data, agenda summary, and user preferences
 * into a single DailyContext object for the engine.
 */

import type { AgendaSummary } from '../types/agenda.js';
import type { DailyContext } from '../types/context.js';
import type { FormalityLevel } from '../types/wardrobe.js';
import type { WeatherData } from '../types/weather.js';

export function buildDailyContext(
  weather: WeatherData,
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
