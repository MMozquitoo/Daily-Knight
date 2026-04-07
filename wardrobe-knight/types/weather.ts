/**
 * Weather types
 *
 * Represents weather data fetched from Open-Meteo API.
 * Only includes fields relevant to clothing decisions.
 */

/** Current weather snapshot */
export interface WeatherData {
  temperature: number;
  feelsLike: number;
  rainProbability: number;
  condition: WeatherCondition;
  wind: number;
}

/** Hourly forecast entry for time-of-day breakdowns */
export interface HourlyForecast {
  hour: number;
  temperature: number;
  rainProbability: number;
}

/** Simplified weather conditions */
export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'fog';

/** Full weather context for a day */
export interface DayWeather {
  current: WeatherData;
  hourly: HourlyForecast[];
  tempHigh: number;
  tempLow: number;
  fetchedAt: string;
}
