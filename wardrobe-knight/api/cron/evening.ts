import type { Request, Response } from 'express';
import { requireCron } from '../_auth.js';
import { WebClient } from '@slack/web-api';
import { detectTrips } from '../../services/calendar.js';
import { geocodeCity, fetchWeatherForecast } from '../../services/weather.js';
import { planWeek } from '../../services/planner.js';
import * as sheets from '../../services/sheets.js';
import type { ClothingItem } from '../../types/wardrobe.js';
import { categoryFromSheet } from '../../types/wardrobe.js';

export const config = { runtime: 'nodejs', maxDuration: 60 };

const SLACK_USER_ID = process.env.SLACK_USER_ID ?? '';
const LAUNDRY_INTERVAL_DAYS = 3;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function itemLabel(item: ClothingItem): string {
  return `${item.id} ${item.categorie} ${item.sousCategorie} ${item.couleur}${item.marque ? ` (${item.marque})` : ''}`;
}

async function buildPackingList(
  items: ClothingItem[],
  tripDays: number,
  weather: { tempMin: number; tempMax: number; rainProbability: number; condition: string }[],
  formalEvents: boolean,
): Promise<string> {
  const avgTemp = weather.reduce((s, w) => s + (w.tempMin + w.tempMax) / 2, 0) / weather.length;
  const maxRain = Math.max(...weather.map((w) => w.rainProbability));
  const hasRain = maxRain > 30;

  const tops = items.filter((i) => categoryFromSheet(i.categorie) === 'top');
  const bottoms = items.filter((i) => categoryFromSheet(i.categorie) === 'bottom');
  const shoes = items.filter((i) => categoryFromSheet(i.categorie) === 'shoes');
  const outerwear = items.filter((i) => categoryFromSheet(i.categorie) === 'outerwear');

  // Pick items based on trip context
  const formalityFilter = formalEvents
    ? (i: ClothingItem) => i.formalite >= 3
    : (i: ClothingItem) => i.formalite <= 3;

  const tempFilter = (i: ClothingItem) => {
    const saison = i.saison.toLowerCase();
    if (avgTemp > 25) return !saison.includes('hiver');
    if (avgTemp < 10) return !saison.includes('été');
    return true;
  };

  const filter = (list: ClothingItem[]) => {
    const filtered = list.filter((i) => formalityFilter(i) && tempFilter(i));
    return filtered.length > 0 ? filtered : list;
  };

  const topCount = Math.min(tripDays + 1, filter(tops).length);
  const bottomCount = Math.min(Math.ceil(tripDays / 2) + 1, filter(bottoms).length);
  const shoeCount = Math.min(2, filter(shoes).length);

  const selectedTops = filter(tops).slice(0, topCount);
  const selectedBottoms = filter(bottoms).slice(0, bottomCount);
  const selectedShoes = filter(shoes).slice(0, shoeCount);

  const lines: string[] = [];
  lines.push(`*Hauts (${selectedTops.length}) :*`);
  selectedTops.forEach((i) => lines.push(`  • ${itemLabel(i)}`));

  lines.push(`*Bas (${selectedBottoms.length}) :*`);
  selectedBottoms.forEach((i) => lines.push(`  • ${itemLabel(i)}`));

  lines.push(`*Chaussures (${selectedShoes.length}) :*`);
  selectedShoes.forEach((i) => lines.push(`  • ${itemLabel(i)}`));

  if (hasRain || avgTemp < 15) {
    const outerPick = filter(outerwear).slice(0, 1);
    if (outerPick.length > 0) {
      lines.push(`*Outerwear :*`);
      outerPick.forEach((i) => lines.push(`  • ${itemLabel(i)}`));
    }
  }

  const extras: string[] = [];
  if (hasRain) extras.push(':umbrella_with_rain_drops: Parapluie');
  if (avgTemp > 28) extras.push(':dark_sunglasses: Lunettes de soleil');
  if (extras.length > 0) {
    lines.push(`*Accessoires :*`);
    extras.forEach((e) => lines.push(`  • ${e}`));
  }

  return lines.join('\n');
}

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!requireCron(req, res)) return;
  if (!SLACK_USER_ID || !process.env.SLACK_BOT_TOKEN) {
    res.status(500).json({ error: 'SLACK_USER_ID or SLACK_BOT_TOKEN not configured' });
    return;
  }

  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  const messages: string[] = [];

  try {
    // --- 1. TRAVEL ALERT: detect trips starting tomorrow or in 2 days ---
    const trips = await detectTrips(3);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const dayAfterStr = new Date(tomorrow.getTime() + 86400000).toISOString().slice(0, 10);

    for (const trip of trips) {
      if (trip.startDate !== tomorrowStr && trip.startDate !== dayAfterStr) continue;

      const geo = await geocodeCity(trip.destination);
      if (!geo) continue;

      const forecast = await fetchWeatherForecast(geo.lat, geo.lon, trip.days);
      const items = await sheets.getAll();
      const hasFormal = trip.events.some((e) => e.tag === 'formal' || e.tag === 'work');

      const weatherLines = forecast.map((w) =>
        `${w.date}: ${w.tempMin}–${w.tempMax}°C, ${w.condition}, pluie ${w.rainProbability}%`
      );

      const packingList = await buildPackingList(
        items,
        trip.days,
        forecast.map((w) => ({ tempMin: w.tempMin, tempMax: w.tempMax, rainProbability: w.rainProbability, condition: w.condition })),
        hasFormal,
      );

      const daysLabel = trip.startDate === tomorrowStr ? 'demain' : 'après-demain';
      const msg = `:airplane: *Voyage à ${geo.name} ${daysLabel} !*\n`
        + `${trip.days} jour(s) · ${trip.startDate} → ${trip.endDate}\n\n`
        + `:partly_sunny: *Météo à ${geo.name} :*\n${weatherLines.join('\n')}\n\n`
        + `:luggage: *Quoi emporter :*\n${packingList}`;

      messages.push(msg);
    }

    // --- 2. LAUNDRY REMINDER: check every N days ---
    const wornHistory = await sheets.getWornRecently(LAUNDRY_INTERVAL_DAYS);
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);

    if (dayOfYear % LAUNDRY_INTERVAL_DAYS === 0 && wornHistory.length > 0) {
      const dirtyIds = new Set<string>();
      for (const entry of wornHistory) {
        for (const id of [entry.top, entry.bottom, entry.shoes, entry.outerwear]) {
          if (id) dirtyIds.add(id);
        }
      }

      if (dirtyIds.size > 0) {
        const allItems = await sheets.getAll();
        const dirtyItems = allItems.filter((i) => dirtyIds.has(i.id));
        const dirtyList = dirtyItems.map((i) => `  • ${itemLabel(i)}`).join('\n');

        messages.push(
          `:soap: *Rappel lessive !*\n`
          + `${dirtyIds.size} vêtement(s) porté(s) ces ${LAUNDRY_INTERVAL_DAYS} derniers jours :\n`
          + dirtyList
          + `\n\n_Pense à lancer une machine :washing_machine:_`
        );
      }
    }

    // Send all messages
    for (const msg of messages) {
      await slack.chat.postMessage({ channel: SLACK_USER_ID, text: msg });
    }

    res.status(200).json({ ok: true, messagesSent: messages.length });
  } catch (err) {
    console.error('[CRON EVENING]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown' });
  }
}
