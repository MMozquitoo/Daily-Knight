/**
 * Daily Context type
 *
 * The unified input to the decision engine.
 * Built from weather + agenda + user preferences.
 * See architecture doc Section 5: "Daily Context"
 */

import { WeatherData } from './weather';
import { AgendaSummary } from './agenda';
import { FormalityLevel } from './wardrobe';

export interface DailyContext {
  date: string;
  location: string;
  weather: WeatherData;
  agenda: AgendaSummary;
  userStylePreference: FormalityLevel | 'mixed';
}
