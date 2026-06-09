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

/** Extended weather with daily range (for carry logic) */
export interface DayWeather extends WeatherData {
  tempMax: number;
  tempMin: number;
}

/** Simplified weather conditions */
export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'fog';
