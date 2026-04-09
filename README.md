# Wardrobe Knight

A minimalist mobile app that tells you what to wear every day. No browsing, no AI — just one clear outfit recommendation based on your weather, calendar, and wardrobe.

> Open, understand the day, show one clear answer.

## What It Does

1. **Reads your day** — weather forecast + calendar events
2. **Scores your wardrobe** — deterministic rule engine filters and ranks every item
3. **Shows one outfit** — what to wear, what to carry, and why

The user never browses outfits. The choice is already made.

## Screenshots

| Home | Wardrobe | Weather |
|------|----------|---------|
| Knight avatar wearing the recommended outfit | Clothing library with category tabs | Forecast data that affects clothing |

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Expo (SDK 54) + Expo Router |
| Language | TypeScript (strict) |
| Storage | expo-sqlite |
| State | Zustand (planned) |
| Avatar | react-native-svg — layered 2D knight |
| Weather | Open-Meteo (free, no API key) |
| Calendar | expo-calendar (native device access) |
| Styling | Nativewind / Tailwind (planned) |

## Project Structure

```
wardrobe-knight/
├── app/            # Expo Router screens
├── components/     # UI components + knight avatar
├── engine/         # Deterministic outfit decision logic
├── stores/         # Zustand state management
├── db/             # SQLite + Drizzle schema
├── services/       # Weather, calendar, location, color detection
├── types/          # Shared TypeScript interfaces
├── constants/      # Palette, templates, scoring weights
└── assets/         # Fonts, SVGs
```

## Decision Engine

The engine is pure TypeScript with no UI dependencies:

1. **Filter** — remove unavailable items, weather mismatches, formality mismatches
2. **Score** — rank items by weather fit (40%), formality (30%), context (20%), style preference (10%)
3. **Assemble** — pick the top-scoring item per layer (top, bottom, shoes, outerwear)
4. **Validate** — check outfit-level rules (color harmony, formality consistency)
5. **Carry** — umbrella if rain > 30%, light layer if temp swing > 8°C, bag if formal day
6. **Explain** — generate a one-sentence "why" from templates

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)

### Install & Run

```bash
cd wardrobe-knight
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `w` for web.

## Design Principles

- **One action per screen** — understandable in < 3 seconds
- **No backend** — all data is local-first
- **Rule-based, not AI** — deterministic, explainable, fast
- **Modular avatar** — template shapes + color fills = infinite combinations without new illustrations
- **Minimal UI** — high whitespace, muted neutrals, one accent color

## License

MIT
