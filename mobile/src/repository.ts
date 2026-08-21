// Fase A -> Fase C: TodayScreen no debe saber si su outfit viene de un
// fixture fijo o de un backend real. App.tsx elige la implementación;
// la pantalla solo conoce esta interfaz.

import type { TodayOutfit } from './types';

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
