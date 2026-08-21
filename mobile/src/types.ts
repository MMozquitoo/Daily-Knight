// Tipos del vertical slice de Hoy.
// Ver: Contrato de Pantallas v0.2, sección "Hoy".

export type ImageTier = 'clean' | 'product' | 'raw' | 'placeholder';

export interface GarmentAssets {
  clean?: string;
  product?: string;
  raw?: string;
}

export type GarmentLayer = 'top' | 'bottom' | 'shoes' | 'outerwear';

export interface Garment {
  id: string;
  layer: GarmentLayer;
  category: string;
  brand?: string;
  color: string;
  assets: GarmentAssets;
}

export interface WeatherSummary {
  range: string; // "19–27°C"
  condition: string; // "cloudy"
  rainChancePct: number;
  windKmh: number;
}

export interface AgendaSummary {
  eventCount: number;
  formality: string; // "casual" | "work" | ...
}

export interface TodayOutfit {
  date: string; // ISO 'YYYY-MM-DD'
  why: string;
  weather: WeatherSummary;
  agenda: AgendaSummary;
  top: Garment;
  bottom: Garment;
  shoes: Garment;
  outerwear?: Garment;
  carry?: string;
}

export type TodayStatus = 'loading' | 'ready' | 'accepted' | 'error';

// Resuelve la cadena clean -> product -> raw -> placeholder.
// El resultado visual es idéntico sin importar el tier — el tier
// solo se usa para telemetría (image_fallback_used), nunca para UI.
export function resolveGarmentImage(assets: GarmentAssets): { uri?: string; tier: ImageTier } {
  if (assets.clean) return { uri: assets.clean, tier: 'clean' };
  if (assets.product) return { uri: assets.product, tier: 'product' };
  if (assets.raw) return { uri: assets.raw, tier: 'raw' };
  return { tier: 'placeholder' };
}
