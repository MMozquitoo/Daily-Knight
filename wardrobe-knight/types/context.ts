/**
 * Daily Context type
 *
 * The unified input to the decision engine.
 * Built from weather + agenda + user preferences.
 */

import type { WeatherData } from './weather.js';
import type { AgendaSummary } from './agenda.js';
import type { FormalityLevel } from './wardrobe.js';

export interface DailyContext {
  date: string;
  location: string;
  weather: WeatherData;
  agenda: AgendaSummary;
  userStylePreference: FormalityLevel | 'mixed';
}
