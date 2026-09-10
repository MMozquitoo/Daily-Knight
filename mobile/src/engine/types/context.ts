/**
 * Daily Context type
 *
 * The unified input to the decision engine.
 * Built from weather + agenda + user preferences.
 */

import type { DayWeather } from './weather';
import type { AgendaSummary } from './agenda';
import type { FormalityLevel } from './wardrobe';

export interface DailyContext {
  date: string;
  location: string;
  weather: DayWeather;
  agenda: AgendaSummary;
  userStylePreference: FormalityLevel | 'mixed';
}
