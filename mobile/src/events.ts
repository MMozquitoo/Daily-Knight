// Eventos de la pantalla Hoy — Contrato de Pantallas v0.2.
// Un TodayEvents es inyectable: en producción apunta a analytics real,
// en tests se reemplaza por un mock para verificar el flujo completo.

import type { GarmentLayer, ImageTier } from './types';

export interface TodayEvents {
  viewed(date: string): void;
  accepted(date: string): void;
  rejected(date: string): void;
  swapped(date: string, layer: GarmentLayer): void;
  worn(date: string): void;
  imageFallbackUsed(itemId: string, tier: ImageTier): void;
}

export function createConsoleEvents(): TodayEvents {
  return {
    viewed: (date) => console.log('[event] viewed', date),
    accepted: (date) => console.log('[event] accepted', date),
    rejected: (date) => console.log('[event] rejected', date),
    swapped: (date, layer) => console.log('[event] swapped', date, layer),
    worn: (date) => console.log('[event] worn', date),
    imageFallbackUsed: (itemId, tier) => console.log('[event] image_fallback_used', itemId, tier),
  };
}
