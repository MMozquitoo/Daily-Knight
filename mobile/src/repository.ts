// Fase A -> Fase C: TodayScreen no debe saber si su outfit viene de un
// fixture fijo o de un backend real. App.tsx elige la implementación;
// la pantalla solo conoce esta interfaz.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClothingItem } from './engine/types/wardrobe';
import type { CarryItem, OutfitRecommendation } from './engine/types/outfit';
import type { AgendaSummary as EngineAgendaSummary } from './engine/types/agenda';
import type { DayWeather } from './engine/types/weather';
import type { DailyContext } from './engine/types/context';
import { buildDailyContext } from './engine/engine/context';
import { generateOutfit, regenerateOutfit } from './engine/engine/index';
import { toWardrobeItems } from './engine/types/adapter';
import { fetchWeather } from './services/weather';
import { buildStubAgenda } from './data/agenda';
import {
  fetchCooldownMap,
  fetchFeedbackScores,
  fetchPlannedOutfit,
  fetchProfile,
  fetchStyleRules,
  fetchWardrobeItems,
  recordWornToday,
  updatePlannedOutfitStatus,
  upsertPlannedOutfit,
  type PlannedOutfitRow,
} from './data/wardrobeApi';
import type { AgendaSummary, Garment, GarmentLayer, TodayOutfit, WeatherSummary } from './types';

export interface TodayRepository {
  getToday(): Promise<TodayOutfit>;
}

export function createFixtureRepository(fixture: TodayOutfit): TodayRepository {
  return {
    async getToday() {
      return fixture;
    },
  };
}

export interface SupabaseTodayRepository extends TodayRepository {
  acceptToday(date: string): Promise<void>;
  regenerateToday(): Promise<TodayOutfit>;
}

const CARRY_LABELS: Record<CarryItem, string> = {
  umbrella: 'parapluie',
  'light-layer': 'petite couche',
  bag: 'sac',
  sunglasses: 'lunettes de soleil',
};

function toCarryLabel(carry: string[]): string | undefined {
  if (carry.length === 0) return undefined;
  return carry.map((c) => CARRY_LABELS[c as CarryItem] ?? c).join(', ');
}

function toGarment(item: ClothingItem, layer: GarmentLayer): Garment {
  return {
    id: item.id,
    layer,
    category: item.sousCategorie || item.categorie,
    brand: item.marque || undefined,
    color: item.couleur,
    assets: {
      clean: item.tryonUrl || undefined,
      product: item.productUrl || undefined,
      raw: item.imageUrl || undefined,
    },
  };
}

function toWeatherSummary(weather: DayWeather): WeatherSummary {
  return {
    range: `${weather.tempMin}–${weather.tempMax}°C`,
    condition: weather.condition,
    rainChancePct: weather.rainProbability,
    windKmh: weather.wind,
  };
}

function toAgendaSummary(agenda: EngineAgendaSummary): AgendaSummary {
  return { eventCount: agenda.events.length, formality: agenda.dayType };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fase B: the engine runs client-side (see the Fase B plan) — this repository
 * fetches the signed-in user's wardrobe/rules/history from Supabase (RLS
 * scopes every read to `owner_id = auth.uid()`), runs the ported
 * generateOutfit()/regenerateOutfit(), and caches the day's pick in
 * `planned_outfits` so repeated getToday() reads are stable.
 */
export function createSupabaseTodayRepository(supabase: SupabaseClient, ownerId: string): SupabaseTodayRepository {
  async function loadInputs() {
    const [clothingItems, styleRules, cooldown, feedback, profile] = await Promise.all([
      fetchWardrobeItems(supabase),
      fetchStyleRules(supabase),
      fetchCooldownMap(supabase),
      fetchFeedbackScores(supabase),
      fetchProfile(supabase, ownerId),
    ]);
    const weather = await fetchWeather(profile.latitude, profile.longitude);
    return { clothingItems, styleRules, cooldown, feedback, weather };
  }

  function toTodayOutfit(
    recommendation: OutfitRecommendation,
    itemsById: Map<string, ClothingItem>,
    context: DailyContext,
    weather: DayWeather,
    agenda: EngineAgendaSummary,
  ): TodayOutfit {
    const get = (id: string) => {
      const item = itemsById.get(id);
      if (!item) throw new Error(`Pièce introuvable dans l'armoire : ${id}`);
      return item;
    };

    return {
      date: context.date,
      why: recommendation.why,
      weather: toWeatherSummary(weather),
      agenda: toAgendaSummary(agenda),
      top: toGarment(get(recommendation.wear.top), 'top'),
      bottom: toGarment(get(recommendation.wear.bottom), 'bottom'),
      shoes: toGarment(get(recommendation.wear.shoes), 'shoes'),
      outerwear: recommendation.wear.outerwear ? toGarment(get(recommendation.wear.outerwear), 'outerwear') : undefined,
      carry: toCarryLabel(recommendation.carry),
    };
  }

  async function generate(excludeItemIds: string[]): Promise<TodayOutfit> {
    const { clothingItems, styleRules, cooldown, feedback, weather } = await loadInputs();
    const itemsById = new Map(clothingItems.map((item) => [item.id, item] as const));
    const agenda = buildStubAgenda();
    const context = buildDailyContext(weather, agenda, 'mixed', 'Paris', todayIso());
    const wardrobeItems = toWardrobeItems(clothingItems);

    const recommendation = excludeItemIds.length
      ? regenerateOutfit(wardrobeItems, context, excludeItemIds, cooldown, feedback, styleRules)
      : generateOutfit(wardrobeItems, context, cooldown, feedback, styleRules);

    const outfit = toTodayOutfit(recommendation, itemsById, context, weather, agenda);

    await upsertPlannedOutfit(supabase, ownerId, {
      date: outfit.date,
      top_item_id: recommendation.wear.top,
      bottom_item_id: recommendation.wear.bottom,
      shoes_item_id: recommendation.wear.shoes,
      outerwear_item_id: recommendation.wear.outerwear ?? null,
      carry: recommendation.carry,
      why: outfit.why,
      weather: outfit.weather,
      agenda: outfit.agenda,
      status: 'proposed',
    });

    return outfit;
  }

  function fromRow(row: PlannedOutfitRow, itemsById: Map<string, ClothingItem>): TodayOutfit {
    const get = (id: string) => {
      const item = itemsById.get(id);
      if (!item) throw new Error(`Pièce introuvable dans l'armoire : ${id}`);
      return item;
    };
    return {
      date: row.date,
      why: row.why,
      weather: row.weather as WeatherSummary,
      agenda: row.agenda as AgendaSummary,
      top: toGarment(get(row.top_item_id), 'top'),
      bottom: toGarment(get(row.bottom_item_id), 'bottom'),
      shoes: toGarment(get(row.shoes_item_id), 'shoes'),
      outerwear: row.outerwear_item_id ? toGarment(get(row.outerwear_item_id), 'outerwear') : undefined,
      carry: toCarryLabel(row.carry),
    };
  }

  return {
    async getToday() {
      const date = todayIso();
      const existing = await fetchPlannedOutfit(supabase, date);
      if (existing) {
        const clothingItems = await fetchWardrobeItems(supabase);
        const itemsById = new Map(clothingItems.map((item) => [item.id, item] as const));
        return fromRow(existing, itemsById);
      }
      return generate([]);
    },

    async acceptToday(date: string) {
      await updatePlannedOutfitStatus(supabase, date, 'accepted');
      const existing = await fetchPlannedOutfit(supabase, date);
      if (!existing) return;
      const itemIds = [existing.top_item_id, existing.bottom_item_id, existing.shoes_item_id, existing.outerwear_item_id].filter(
        (id): id is string => !!id,
      );
      await recordWornToday(supabase, ownerId, date, itemIds);
    },

    async regenerateToday() {
      const date = todayIso();
      const existing = await fetchPlannedOutfit(supabase, date);
      const excludeItemIds = existing
        ? [existing.top_item_id, existing.bottom_item_id, existing.shoes_item_id, existing.outerwear_item_id].filter(
            (id): id is string => !!id,
          )
        : [];
      return generate(excludeItemIds);
    },
  };
}
