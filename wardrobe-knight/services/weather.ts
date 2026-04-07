/**
 * Weather Service — Open-Meteo (free, no API key)
 */

import type { WeatherCondition, WeatherData } from '@/types/weather';

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

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code',
    timezone: 'auto',
    forecast_days: '1',
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);

  const data = await res.json();
  const current = data.current;

  return {
    temperature: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    rainProbability: current.precipitation_probability ?? 0,
    condition: weatherCodeToCondition(current.weather_code),
    wind: Math.round(current.wind_speed_10m),
  };
}

/** Get user's location via browser geolocation API */
export function getUserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      // Default to Paris
      resolve({ lat: 48.85, lon: 2.35 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve({ lat: 48.85, lon: 2.35 }), // fallback to Paris
      { timeout: 5000 }
    );
  });
}
