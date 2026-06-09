/**
 * Weather Service — Open-Meteo (free, no API key)
 *
 * Adapted for Node.js — uses env vars for location instead of browser geolocation.
 */

import type { WeatherCondition, WeatherData, DayWeather } from '../types/weather.js';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

function weatherCodeToCondition(code: number): WeatherCondition {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 49) return 'fog';
  if (code <= 69) return 'rain';
  if (code <= 79) return 'snow';
  if (code <= 99) return 'storm';
  return 'cloudy';
}

export async function fetchWeather(lat: number, lon: number): Promise<DayWeather> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '1',
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);

  const data = await res.json();
  const current = data.current;
  const daily = data.daily;

  return {
    temperature: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    rainProbability: current.precipitation_probability ?? daily.precipitation_probability_max?.[0] ?? 0,
    condition: weatherCodeToCondition(current.weather_code),
    wind: Math.round(current.wind_speed_10m),
    tempMax: Math.round(daily.temperature_2m_max[0]),
    tempMin: Math.round(daily.temperature_2m_min[0]),
  };
}

/** Get location from environment variables */
export function getUserLocation(): { lat: number; lon: number } {
  return {
    lat: parseFloat(process.env.USER_LATITUDE ?? '48.8566'),
    lon: parseFloat(process.env.USER_LONGITUDE ?? '2.3522'),
  };
}

/** Format weather for Slack display */
export function formatWeatherSlack(w: DayWeather): string {
  const conditionEmoji: Record<WeatherCondition, string> = {
    clear: ':sunny:',
    cloudy: ':cloud:',
    rain: ':rain_cloud:',
    snow: ':snowflake:',
    storm: ':zap:',
    fog: ':fog:',
  };
  const emoji = conditionEmoji[w.condition] ?? ':cloud:';
  return [
    `${emoji} *${w.temperature}°C* (ressenti ${w.feelsLike}°C)`,
    `Plage : ${w.tempMin}°C – ${w.tempMax}°C`,
    `Pluie : ${w.rainProbability}% · Vent : ${w.wind} km/h`,
  ].join('\n');
}
