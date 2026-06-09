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

export function isColdDay(context: DailyContext): boolean {
  return context.weather.temperature < 18 || context.weather.feelsLike < 16;
}

export function isHotDay(context: DailyContext): boolean {
  return context.weather.temperature > 24;
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
  return Math.abs(context.weather.temperature - context.weather.feelsLike);
}

export function isNeutralColor(color: PaletteColor): boolean {
  return NEUTRAL_COLORS.includes(color);
}

export function categoryMatchesLayer(item: WardrobeItem, layer: LayerCategory): boolean {
  return item.category === layer || item.layer === layer;
}
