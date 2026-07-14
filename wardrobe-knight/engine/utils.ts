import type { EventTag } from '../types/agenda.js';
import type { DailyContext } from '../types/context.js';
import type { FormalityLevel, LayerCategory, PaletteColor, WardrobeItem } from '../types/wardrobe.js';

const FORMALITY_SCALE: Record<FormalityLevel, number> = {
  casual: 0,
  smart: 1,
  formal: 2,
};

const EVENT_TAG_TO_FORMALITY: Record<EventTag, FormalityLevel> = {
  casual: 'casual',
  travel: 'casual',
  work: 'smart',
  formal: 'formal',
};

const DAY_TYPE_CONTEXT: Record<DailyContext['agenda']['dayType'], WardrobeItem['contexts'][number]> = {
  office: 'office',
  casual: 'casual',
  travel: 'travel',
  mixed: 'casual',
};

const NEUTRAL_COLORS: PaletteColor[] = ['white', 'black', 'navy', 'gray', 'beige', 'brown', 'olive'];

export function getRequiredFormality(context: DailyContext): FormalityLevel {
  const agendaLevel = EVENT_TAG_TO_FORMALITY[context.agenda.highestFormality];

  if (context.agenda.meetingsCount === 0 && agendaLevel === 'smart') {
    return 'casual';
  }

  return agendaLevel;
}

export function getFormalityDistance(a: FormalityLevel, b: FormalityLevel): number {
  return Math.abs(FORMALITY_SCALE[a] - FORMALITY_SCALE[b]);
}

export function getDayContextTag(context: DailyContext): WardrobeItem['contexts'][number] {
  return DAY_TYPE_CONTEXT[context.agenda.dayType];
}

/**
 * The temperature the outfit has to survive.
 *
 * You dress once, in the morning, for the whole day — so the day's high is what
 * matters, not the reading at 8am. Judging on the current temperature is how a
 * 23°C morning with a 34°C afternoon got a hooded sweatshirt.
 */
export function dayTemperature(context: DailyContext): number {
  return context.weather.tempMax ?? context.weather.temperature;
}

/** How far the day swings — drives whether to carry a layer for the cool hours */
export function temperatureRange(context: DailyContext): number {
  const { tempMin, tempMax } = context.weather;
  if (tempMin === undefined || tempMax === undefined) return 0;
  return tempMax - tempMin;
}

export function isColdDay(context: DailyContext): boolean {
  return dayTemperature(context) < 18 || context.weather.feelsLike < 16;
}

export function isHotDay(context: DailyContext): boolean {
  return dayTemperature(context) > 24;
}

/** Shorts weather. The owner wants these first when it is genuinely warm. */
export function isShortsWeather(context: DailyContext): boolean {
  return dayTemperature(context) >= 26 && !isRainyDay(context);
}

export function isRainyDay(context: DailyContext): boolean {
  return context.weather.rainProbability > 30 || context.weather.condition === 'rain' || context.weather.condition === 'storm';
}

export function isWindyDay(context: DailyContext): boolean {
  return context.weather.wind > 20;
}

export function needsOuterwear(context: DailyContext): boolean {
  return isColdDay(context) || isRainyDay(context) || isWindyDay(context);
}

export function getTemperatureSwing(context: DailyContext): number {
  const range = temperatureRange(context);
  if (range > 0) return range;
  return Math.abs(context.weather.temperature - context.weather.feelsLike);
}

export function isNeutralColor(color: PaletteColor): boolean {
  return NEUTRAL_COLORS.includes(color);
}

export function categoryMatchesLayer(item: WardrobeItem, layer: LayerCategory): boolean {
  return item.category === layer || item.layer === layer;
}
