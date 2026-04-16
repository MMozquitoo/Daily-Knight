# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wardrobe Knight is a mobile app that recommends one outfit per day based on weather, calendar events, and the user's wardrobe. No browsing — the app opens and shows a single deterministic recommendation with a "why" explanation. The UI is in Spanish.

## Commands

All commands run from the `wardrobe-knight/` directory:

```bash
cd wardrobe-knight
npm install          # install dependencies
npx expo start       # start dev server (scan QR with Expo Go, or press w for web)
npx expo start --web # web only
```

No test runner, linter, or formatter is configured yet.

## Architecture

### Three-layer structure

1. **Presentation** (`app/`, `components/`) — Expo Router screens and React Native components
2. **Domain** (`engine/`) — Pure TypeScript outfit decision pipeline, zero React/Expo imports
3. **Data** (`db/`, `services/`, `stores/`, `state/`) — SQLite schema, external APIs, state management

### Decision Engine (`engine/`)

The core logic lives in `engine/` and follows a strict 6-step pipeline:

1. `filter.ts` — Remove unavailable items, weather/formality mismatches
2. `scorer.ts` — Rank items: weather (40%), formality (30%), context (20%), style (10%)
3. `assembler.ts` — Pick top-scoring item per layer (top, bottom, shoes, outerwear)
4. `validator.ts` — Check outfit-level rules (color harmony, formality consistency)
5. `carry.ts` — Rule-based carry items (umbrella if rain > 30%, etc.)
6. `why.ts` — Template-based explanation sentence

Public API in `engine/index.ts`: `generateOutfit()`, `regenerateOutfit()`, `swapLayer()`. The engine retries assembly when validation fails, excluding conflicting items progressively.

### Current State Management

The app currently uses a **React Context provider** (`state/AppState.tsx`) instead of the planned Zustand stores. It holds wardrobe items (initialized from `data/mockDecisionInput.ts`), cycles through predefined outfits, and fetches real weather via `services/weather.ts`. The Zustand stores in `stores/` exist as files but are not wired into the app yet.

The Drizzle schema (`db/schema.ts`) has column definitions documented but the actual Drizzle table declarations are not yet implemented (TODO).

### Routing

Expo Router with file-based routing:
- `app/(tabs)/` — Main tab screens: Home (`index.tsx`), Weather, Wardrobe
- `app/agenda.tsx`, `app/settings.tsx` — Presented as modals
- `app/onboarding/` — Welcome, permissions, style, first-items screens
- `app/wardrobe/` — `add.tsx` (add clothing flow), `[id].tsx` (item detail)

The bottom tab bar is hidden (`tabBarStyle: { display: 'none' }`); navigation uses a custom `BottomNav` component.

### Knight Avatar System (`components/avatar/`)

Layered SVG composition using `react-native-svg`:
- `KnightAvatar.tsx` / `CharacterAvatar.tsx` — Main compositor
- `BaseBodyLayer.tsx` — Base knight silhouette (z-0, always rendered)
- `templates/` — SVG clothing templates organized by category (tops, bottoms, shoes, outerwear, accessories)
- `templateRegistry.tsx` — Maps template IDs to SVG components
- `resolveVisual.ts` — Resolves wardrobe item to visual template + color

Each template accepts a `fill` color prop. Layers render in fixed z-index order (shoes → bottom → top → outerwear → accessories).

### Path Aliases

TypeScript path alias `@/*` maps to the `wardrobe-knight/` root (configured in `tsconfig.json`).

### External Services

- **Weather**: Open-Meteo API (free, no key) — `services/weather.ts` fetches current conditions + hourly forecast
- **Calendar**: `expo-calendar` for native device calendar read — `services/calendar.ts`
- **Location**: `expo-location` for coordinates — `services/location.ts`
- **Color Detection**: Local pixel sampling to map clothing photos to palette colors — `services/color.ts`
- **Palette**: Controlled set of 10 named colors defined in `constants/palette.ts`

### Deployment

Web export deployed to Vercel. Config in root `vercel.json` builds with `npx expo export --platform web` and outputs to `wardrobe-knight/dist`. SPA fallback routes all paths to `index.html`.

## Key Design Decisions

- **No backend** — All data is local-first (SQLite + device APIs). No auth, no sync.
- **Rule-based, not AI** — Deterministic scoring engine, fully explainable.
- **One action per screen** — User should feel the choice is already made.
- **Template-based avatar** — Shape templates + color fills = infinite combinations without new illustrations.
- **Scoring weights** in `constants/scoring.ts`, **explanation templates** in `constants/why-templates.ts` — tunable without changing logic.
