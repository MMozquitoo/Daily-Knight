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

export async function fetchWeatherForecast(lat: number, lon: number, days: number = 7): Promise<DayWeather[]> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,wind_speed_10m_max',
    timezone: 'auto',
    forecast_days: days.toString(),
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);

  const data = await res.json();
  const daily = data.daily;

  // Open-Meteo caps forecast_days at 16 and can return short arrays; only build
  // days that actually have a max AND min, so a missing entry never becomes NaN
  // in the plan.
  const available = Math.min(days, daily?.time?.length ?? 0);

  return Array.from({ length: available }, (_, i) => i)
    .filter((i) => daily.temperature_2m_max[i] != null && daily.temperature_2m_min[i] != null)
    .map((i) => ({
      temperature: Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
      feelsLike: Math.round((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2),
      rainProbability: daily.precipitation_probability_max[i] ?? 0,
      condition: weatherCodeToCondition(daily.weather_code[i]),
      wind: Math.round(daily.wind_speed_10m_max[i] ?? 0),
      tempMax: Math.round(daily.temperature_2m_max[i]),
      tempMin: Math.round(daily.temperature_2m_min[i]),
      date: daily.time[i],
    }));
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

/** Geocode a city name using Open-Meteo (free, no key) */
interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  population?: number;
  feature_code?: string;
}

/**
 * Resolve a place name to coordinates.
 *
 * Two traps, both of which sent the bot to the wrong weather:
 *
 *  - "France" resolves to the country centroid (feature_code PCLI), a field in
 *    the Massif Central. Only a populated place (PPL*) is an answer.
 *  - "France" ALSO resolves to a village called France in Mozambique, which *is*
 *    a populated place. Taking the first PPL hit put a July trip to Nice into
 *    southern-hemisphere winter. So results are ranked, not taken in order:
 *    a hit whose country is named in the query wins, then the biggest town.
 */
async function search(query: string): Promise<GeoResult[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=fr`,
  );
  if (!res.ok) return [];

  const data = await res.json();
  return (data.results ?? []).filter((r: GeoResult) => r.feature_code?.startsWith('PPL'));
}

export async function geocodeCity(
  query: string,
  context = '',
): Promise<{ lat: number; lon: number; name: string } | null> {
  return geocodeBest([query], context || query);
}

/**
 * Resolve a free-text location by asking about every part of it and ranking all
 * the answers together.
 *
 * Trying the parts one at a time and taking the first hit is what broke: for
 * "Nice, France", asking about "France" first returns a real village called
 * France, so the bot never got as far as Nice. Ranking globally lets Nice — a
 * city of 340,000 in the country the query names — beat the hamlet.
 */
export async function geocodeBest(
  queries: string[],
  context = '',
): Promise<{ lat: number; lon: number; name: string } | null> {
  const results = (await Promise.all(queries.map(search))).flat();
  if (results.length === 0) return null;

  const haystack = context.toLowerCase();
  const rank = (place: GeoResult): number => {
    const countryNamed = place.country && haystack.includes(place.country.toLowerCase()) ? 1_000_000 : 0;
    const named = haystack.includes(place.name.toLowerCase()) ? 500_000 : 0;
    return countryNamed + named + (place.population ?? 0);
  };

  const best = results.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  return { lat: best.latitude, lon: best.longitude, name: best.name };
}

/** Get location from environment variables (defaults to Paris) */
export function getUserLocation(): { lat: number; lon: number } {
  // A malformed USER_LATITUDE would parseFloat to NaN and send Open-Meteo a broken
  // coordinate; fall back to Paris rather than propagate NaN.
  const num = (value: string | undefined, fallback: number): number => {
    const parsed = parseFloat(value ?? '');
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    lat: num(process.env.USER_LATITUDE, 48.8566),
    lon: num(process.env.USER_LONGITUDE, 2.3522),
  };
}

export interface MonthlyClimate {
  month: number; // 1-12
  label: string; // "septembre"
  avgTempMin: number;
  avgTempMax: number;
  rainyDaysPct: number; // % of days with meaningful precipitation
}

const FRENCH_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * Open-Meteo's forecast API caps at 16 days — no help for a multi-month
 * projection. There's no seasonal-forecast API either that's free/keyless, so
 * this uses last year's actual weather for the same calendar months as a
 * normals proxy (historical archive API, same provider, no key).
 */
export async function fetchMonthlyClimateNormals(
  lat: number,
  lon: number,
  months: number[], // 1-12, e.g. [9, 10, 11, 12]
  referenceYear: number,
): Promise<MonthlyClimate[]> {
  const start = `${referenceYear}-${months[0].toString().padStart(2, '0')}-01`;
  const lastMonth = months[months.length - 1];
  const endMonthLastDay = new Date(Date.UTC(referenceYear, lastMonth, 0)).getUTCDate();
  const end = `${referenceYear}-${lastMonth.toString().padStart(2, '0')}-${endMonthLastDay}`;

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    start_date: start,
    end_date: end,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'auto',
  });

  const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
  if (!res.ok) throw new Error(`Climate archive API error: ${res.status}`);

  const data = await res.json();
  const daily = data.daily;
  const days: number = daily?.time?.length ?? 0;

  return months.map((month) => {
    const idx = Array.from({ length: days }, (_, i) => i)
      .filter((i) => Number(daily.time[i].slice(5, 7)) === month);

    const tempMins = idx.map((i) => daily.temperature_2m_min[i]).filter((v) => v != null);
    const tempMaxs = idx.map((i) => daily.temperature_2m_max[i]).filter((v) => v != null);
    const rain = idx.map((i) => daily.precipitation_sum[i]).filter((v) => v != null);

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const rainyDays = rain.filter((v) => v >= 1).length;

    return {
      month,
      label: FRENCH_MONTHS[month - 1],
      avgTempMin: Math.round(avg(tempMins)),
      avgTempMax: Math.round(avg(tempMaxs)),
      rainyDaysPct: rain.length ? Math.round((rainyDays / rain.length) * 100) : 0,
    };
  });
}

const CONDITION_EMOJI: Record<WeatherCondition, string> = {
  clear: ':sunny:',
  cloudy: ':cloud:',
  rain: ':rain_cloud:',
  snow: ':snowflake:',
  storm: ':zap:',
  fog: ':fog:',
};

/** Format weather for Slack display (full version, for /meteo) */
export function formatWeatherSlack(w: DayWeather): string {
  const emoji = CONDITION_EMOJI[w.condition] ?? ':cloud:';
  return [
    `${emoji} *${w.temperature}°C* (ressenti ${w.feelsLike}°C)`,
    `Plage : ${w.tempMin}°C – ${w.tempMax}°C`,
    `Pluie : ${w.rainProbability}% · Vent : ${w.wind} km/h`,
  ].join('\n');
}

/**
 * One-line weather for the daily outfit message. Adrien's ask: no Plage, no
 * Pluie, no Vent — the outfit already accounts for them; he just wants the day's
 * temperature at a glance.
 */
export function formatWeatherOneLine(w: DayWeather): string {
  const emoji = CONDITION_EMOJI[w.condition] ?? ':cloud:';
  const max = w.tempMax !== undefined ? ` · max ${w.tempMax}°C` : '';
  return `${emoji} *${w.temperature}°C* (ressenti ${w.feelsLike}°C)${max}`;
}
