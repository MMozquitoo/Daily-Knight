/**
 * Dress for where you'll actually be.
 *
 * If the calendar says the day is spent in Nice, the weather that matters is
 * Nice's — not the one outside the bedroom window in Paris. Until now the bot
 * always asked Open-Meteo about USER_LATITUDE/USER_LONGITUDE and never looked at
 * the event location, so a trip south got a Paris wardrobe.
 */

import type { AgendaSummary } from '../types/agenda.js';
import type { DayWeather } from '../types/weather.js';
import { fetchWeather, geocodeBest, getUserLocation } from './weather.js';

export interface DayPlace {
  name: string;
  weather: DayWeather;
  /** True when the calendar sent us somewhere other than home */
  travelling: boolean;
}

/**
 * A calendar location is free text: "Nice, France", "12 rue Foo, 06000 Nice",
 * "Gare de Lyon". Try the parts from the most specific end backwards and let the
 * geocoder reject what it can't place — it only answers with populated places, so
 * "France" simply fails and we move on to "Nice".
 */
function candidates(location: string): string[] {
  const parts = location
    .split(',')
    .map((part) => part.replace(/\b\d{4,6}\b/g, '').trim())
    .filter(Boolean);

  // Last part first: "12 rue Foo, 06000 Nice" → "Nice" before the street
  return [...parts.reverse(), location.trim()].filter((v, i, all) => all.indexOf(v) === i);
}

export async function resolveDayPlace(agenda: AgendaSummary): Promise<DayPlace> {
  const home = getUserLocation();

  if (agenda.destination) {
    try {
      // Ask about every part of the location at once and let the ranking decide;
      // going part by part meant "Nice, France" resolved to a village named France
      const geo = await geocodeBest(candidates(agenda.destination), agenda.destination);
      if (geo) {
        const weather = await fetchWeather(geo.lat, geo.lon);
        return { name: geo.name, weather, travelling: true };
      }
    } catch {
      // Geocoding failed — dressing for home beats crashing the morning cron
    }
  }

  const weather = await fetchWeather(home.lat, home.lon);
  return { name: 'Paris', weather, travelling: false };
}
