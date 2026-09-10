// No Google Calendar OAuth in Fase B (Codex's plan, 2026-08-21) — every day
// is treated as agenda-free until Calendar integration lands in a later
// phase. Isolated here so that integration point is a single function swap.

import type { AgendaSummary } from '../engine/types/agenda';

export function buildStubAgenda(): AgendaSummary {
  return {
    events: [],
    meetingsCount: 0,
    highestFormality: 'casual',
    dayType: 'casual',
  };
}
