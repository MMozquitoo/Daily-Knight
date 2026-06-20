import { google } from 'googleapis';
import { generateOutfit } from '../engine/index.js';
import { buildDailyContext } from '../engine/context.js';
import { toWardrobeItems } from '../types/adapter.js';
import * as sheets from './sheets.js';
import { fetchWeatherForecast, getUserLocation } from './weather.js';
import { fetchWeekAgenda } from './calendar.js';
import { generateTryOn } from './tryon.js';
import { getGoogleServiceAccount, getRequiredEnv } from './env.js';
import type { DayWeather } from '../types/weather.js';
import type { AgendaSummary } from '../types/agenda.js';
import type { OutfitRecommendation } from '../types/outfit.js';

const PLAN_SHEET = 'Planification';
const PLAN_RANGE = `${PLAN_SHEET}!A:K`;

export interface PlannedOutfit {
  date: string;
  dayName: string;
  weatherSummary: string;
  agendaSummary: string;
  top: string;
  bottom: string;
  shoes: string;
  outerwear: string;
  carry: string;
  why: string;
  tryonUrl: string;
}

function getSheets() {
  return google.sheets({
    version: 'v4',
    auth: new google.auth.GoogleAuth({
      credentials: getGoogleServiceAccount(),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }),
  });
}

async function ensurePlanSheet(): Promise<void> {
  const sheetsApi = getSheets();
  try {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: getRequiredEnv('GOOGLE_SHEET_ID'),
      requestBody: {
        requests: [{ addSheet: { properties: { title: PLAN_SHEET } } }],
      },
    });
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: getRequiredEnv('GOOGLE_SHEET_ID'),
      range: `${PLAN_SHEET}!A1:K1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['Date', 'Jour', 'Météo', 'Agenda', 'Top', 'Bottom', 'Shoes', 'Outerwear', 'Carry', 'Why', 'TryonURL']],
      },
    });
  } catch (err: any) {
    if (err?.message?.includes('already exists')) return;
    throw err;
  }
}

function dayName(dateStr: string): string {
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

function weatherSummary(w: DayWeather): string {
  return `${w.tempMin}–${w.tempMax}°C, ${w.condition}, pluie ${w.rainProbability}%, vent ${w.wind}km/h`;
}

function agendaSummary(a: AgendaSummary): string {
  if (a.meetingsCount === 0) return 'libre';
  return `${a.meetingsCount} événement(s), ${a.dayType}, formalité: ${a.highestFormality}`;
}

export async function planWeek(days: number = 7, withTryOn: boolean = false): Promise<PlannedOutfit[]> {
  await ensurePlanSheet();

  const loc = getUserLocation();
  const [forecasts, weekAgenda, items, wornHistory] = await Promise.all([
    fetchWeatherForecast(loc.lat, loc.lon, days),
    fetchWeekAgenda(days),
    sheets.getAll(),
    sheets.getWornRecently(days + 7),
  ]);

  const wardrobeItems = toWardrobeItems(items);

  // Track which day (index) each item was last used
  const itemLastUsedDay = new Map<string, number>();

  // Existing worn history (before the plan starts)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const entry of wornHistory) {
    const entryDate = new Date(entry.date + 'T00:00:00');
    const daysDiff = Math.round((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
    for (const id of [entry.top, entry.bottom, entry.shoes, entry.outerwear]) {
      if (!id) continue;
      // Store as negative day index: -daysDiff means "worn daysDiff days before day 0"
      const existing = itemLastUsedDay.get(id);
      if (existing === undefined || -daysDiff > existing) {
        itemLastUsedDay.set(id, -daysDiff);
      }
    }
  }

  const planned: PlannedOutfit[] = [];

  for (let i = 0; i < days; i++) {
    const forecast = forecasts[i];
    const dateStr = forecast.date ?? new Date(today.getTime() + i * 86400000).toISOString().slice(0, 10);
    const agenda = weekAgenda.get(dateStr) ?? {
      events: [], meetingsCount: 0, highestFormality: 'casual' as const, dayType: 'casual' as const,
    };

    // Build cooldown map relative to current planning day
    const dayCooldown = new Map<string, number>();
    for (const [id, lastDay] of itemLastUsedDay) {
      const distance = i - lastDay; // days since last worn relative to planning day i
      dayCooldown.set(id, distance);
    }

    const context = buildDailyContext(forecast, agenda);
    let recommendation: OutfitRecommendation;

    try {
      recommendation = generateOutfit(wardrobeItems, context, dayCooldown);
    } catch {
      planned.push({
        date: dateStr, dayName: dayName(dateStr),
        weatherSummary: weatherSummary(forecast), agendaSummary: agendaSummary(agenda),
        top: '', bottom: '', shoes: '', outerwear: '',
        carry: '', why: 'Pas assez de vêtements disponibles', tryonUrl: '',
      });
      continue;
    }

    // Mark used items with current day index
    for (const id of [recommendation.wear.top, recommendation.wear.bottom, recommendation.wear.shoes, recommendation.wear.outerwear]) {
      if (id) itemLastUsedDay.set(id, i);
    }

    // Generate try-on for the top item if requested
    let tryonUrl = '';
    if (withTryOn && recommendation.wear.top) {
      const topItem = items.find((it) => it.id === recommendation.wear.top);
      if (topItem?.imageUrl) {
        try {
          tryonUrl = (await generateTryOn(topItem)) ?? '';
        } catch { /* skip */ }
      }
    }

    planned.push({
      date: dateStr,
      dayName: dayName(dateStr),
      weatherSummary: weatherSummary(forecast),
      agendaSummary: agendaSummary(agenda),
      top: recommendation.wear.top ?? '',
      bottom: recommendation.wear.bottom ?? '',
      shoes: recommendation.wear.shoes ?? '',
      outerwear: recommendation.wear.outerwear ?? '',
      carry: recommendation.carry.join(', '),
      why: recommendation.why,
      tryonUrl,
    });
  }

  // Write to sheet (clear old plan first)
  const sheetsApi = getSheets();
  const spreadsheetId = getRequiredEnv('GOOGLE_SHEET_ID');

  await sheetsApi.spreadsheets.values.clear({
    spreadsheetId,
    range: `${PLAN_SHEET}!A2:K100`,
  });

  if (planned.length > 0) {
    const rows = planned.map((p) => [
      p.date, p.dayName, p.weatherSummary, p.agendaSummary,
      p.top, p.bottom, p.shoes, p.outerwear,
      p.carry, p.why, p.tryonUrl,
    ]);
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: `${PLAN_SHEET}!A2:K${rows.length + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
  }

  return planned;
}

/** Get the pre-planned outfit for a specific date */
export async function getPlannedOutfit(date: string): Promise<PlannedOutfit | null> {
  await ensurePlanSheet();
  const sheetsApi = getSheets();
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: getRequiredEnv('GOOGLE_SHEET_ID'),
    range: PLAN_RANGE,
  });

  const rows = res.data.values ?? [];
  const row = rows.find((r, i) => i > 0 && r[0] === date);
  if (!row) return null;

  return {
    date: row[0] ?? '',
    dayName: row[1] ?? '',
    weatherSummary: row[2] ?? '',
    agendaSummary: row[3] ?? '',
    top: row[4] ?? '',
    bottom: row[5] ?? '',
    shoes: row[6] ?? '',
    outerwear: row[7] ?? '',
    carry: row[8] ?? '',
    why: row[9] ?? '',
    tryonUrl: row[10] ?? '',
  };
}
