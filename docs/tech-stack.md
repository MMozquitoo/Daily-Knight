# Wardrobe Knight — Tech Stack

> MVP-oriented. Local-first. No backend. Ship fast.

---

## Decision Summary

| Layer              | Choice                          | Why                                                  |
|--------------------|---------------------------------|------------------------------------------------------|
| Framework          | Expo (SDK 52+)                  | Fastest path to iOS + Android from one codebase      |
| Language           | TypeScript (strict)             | Catches data shape bugs early, critical for the engine |
| Navigation         | Expo Router                     | File-based routing, zero config, built into Expo     |
| Storage            | expo-sqlite + Drizzle ORM       | Local-first relational DB, typed queries, no backend |
| State              | Zustand                         | Minimal boilerplate, works perfectly with sync logic  |
| Avatar Rendering   | react-native-svg               | Layered vector composition, dynamic color fills       |
| Weather API        | Open-Meteo                      | Free, no API key required, covers all needed fields   |
| Calendar           | expo-calendar                   | Native calendar read access, no third-party service   |
| Camera / Image     | expo-image-picker               | Photo capture + gallery import for clothing add flow  |
| Color Detection    | Local pixel sampling            | Average dominant color from center crop, no cloud API |
| Styling            | Nativewind (Tailwind)           | Rapid UI build, consistent design tokens              |
| Animations         | react-native-reanimated         | Subtle outfit fade transitions, nothing more          |

---

## Frontend Stack

### Expo (SDK 52+) with Expo Router

Expo eliminates native build configuration. Expo Router gives file-based routing that maps cleanly to the screen structure in the architecture doc.

**Why not bare React Native:** The architecture requires `expo-calendar`, `expo-location`, `expo-image-picker`, and `expo-sqlite`. All are first-party Expo modules. Going bare adds config overhead with zero benefit.

**Why not Flutter/Swift/Kotlin:** Single codebase, TypeScript ecosystem, faster iteration. The app has no performance-critical native rendering — SVG layering and a rule engine are well within RN's capability.

### TypeScript — Strict Mode

The decision engine operates on structured data (wardrobe items, contexts, scores). Type safety prevents silent bugs in scoring logic. Every data structure from the architecture doc becomes an interface.

```ts
// Exact mirror of architecture doc Section 5
interface WardrobeItem {
  id: string;
  name: string;
  type: ClothingType;
  category: LayerCategory;
  templateId: string;
  color: PaletteColor;
  formality: FormalityLevel;
  contexts: UsageContext[];
  weatherSuitability: WeatherRange;
  availability: 'available' | 'unavailable';
  layer: LayerSlot;
}
```

---

## Backend

**None.**

The architecture specifies:
- Decision engine is deterministic and local
- Wardrobe data is user-local
- Weather comes from a public API
- Calendar comes from the device

There is no user-to-user interaction, no shared state, no authentication. A backend would add latency and complexity for zero value in v1.

If server sync is needed later (scalability section 7 of architecture), add Expo SecureStore for auth tokens and a lightweight sync endpoint. The local-first architecture won't need to change.

---

## Storage — expo-sqlite + Drizzle ORM

### Why SQLite

The wardrobe is relational data: items belong to categories, have formality levels, link to templates, and get filtered/scored by multiple dimensions. This is what SQL is built for.

### Why Drizzle

- Typed schema that matches TypeScript interfaces
- Lightweight (no heavy ORM abstraction)
- Works with expo-sqlite directly
- Migrations built in

### Schema Design

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   users      │     │  wardrobe_items   │     │  templates    │
├─────────────┤     ├──────────────────┤     ├──────────────┤
│ id           │     │ id                │     │ templateId    │
│ location     │────│ userId            │     │ layer         │
│ units        │     │ templateId       │────│ shape         │
│ stylePref    │     │ name              │     │ colors[]      │
│ permissions  │     │ type              │     └──────────────┘
└─────────────┘     │ category          │
                     │ color             │     ┌──────────────┐
                     │ formality         │     │ weather_cache │
                     │ contexts[]        │     ├──────────────┤
                     │ minTemp           │     │ date          │
                     │ maxTemp           │     │ location      │
                     │ rainOk            │     │ data (JSON)   │
                     │ windOk            │     │ fetchedAt     │
                     │ availability      │     └──────────────┘
                     │ layer             │
                     │ createdAt         │
                     └──────────────────┘
```

Templates are seeded as static data (bundled JSON or initial migration). Weather cache has a TTL — refetch if older than 30 minutes.

---

## State Management — Zustand

### Why Zustand

- No providers, no context wrappers, no boilerplate
- Stores are plain functions — easy to test
- Perfect for the app's state shape: one user, one daily context, one active recommendation

### Store Structure

```ts
// Three focused stores, not one monolith

// 1. Daily context — rebuilt on app open
useDayStore: {
  weather: WeatherData | null;
  agenda: AgendaSummary | null;
  context: DailyContext | null;
  buildContext: () => Promise<void>;
}

// 2. Recommendation — output of the engine
useOutfitStore: {
  recommendation: OutfitRecommendation | null;
  generate: (context: DailyContext, wardrobe: WardrobeItem[]) => void;
  regenerate: () => void;
  swapLayer: (layer: LayerSlot) => void;
}

// 3. Wardrobe — persistent, synced to SQLite
useWardrobeStore: {
  items: WardrobeItem[];
  load: () => Promise<void>;
  addItem: (item: NewWardrobeItem) => Promise<void>;
  updateItem: (id: string, changes: Partial<WardrobeItem>) => Promise<void>;
  toggleAvailability: (id: string) => Promise<void>;
}
```

Zustand stores call SQLite through Drizzle for persistence. The UI reads from Zustand. This keeps rendering fast and storage reliable.

---

## APIs

### Weather — Open-Meteo

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=48.85
  &longitude=2.35
  &current=temperature_2m,apparent_temperature,precipitation_probability,
           wind_speed_10m,weather_code
  &hourly=temperature_2m,precipitation_probability
  &timezone=auto
  &forecast_days=1
```

- Free, no API key
- Returns temperature, feels-like, rain probability, wind, condition codes
- Hourly data enables morning/afternoon/evening breakdown for weather screen
- Cache locally, refetch every 30 minutes

**Why not OpenWeatherMap:** Requires API key management, has rate limits on free tier, adds signup friction for contributors.

### Calendar — expo-calendar

```ts
import * as Calendar from 'expo-calendar';

const events = await Calendar.getEventsAsync(
  calendarIds,
  startOfDay,
  endOfDay
);
```

- Reads native device calendars directly
- No third-party service, no OAuth
- Returns event titles and times — enough to derive formality tags and meeting count
- The app parses events into the `AgendaSummary` shape from the architecture doc

### Location — expo-location

```ts
import * as Location from 'expo-location';

const { coords } = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.Low,  // city-level is enough
});
```

- Low accuracy is sufficient — we need city, not street
- Coordinates feed directly into Open-Meteo query
- Reverse geocode for display name on Home screen

### Camera + Color Detection — expo-image-picker + local processing

```ts
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
```

- Capture photo or pick from gallery
- Crop center region (where the clothing item is)
- Sample pixels to extract dominant color
- Map to nearest palette color (quantize to the controlled color set)

No cloud vision API needed. The architecture explicitly requires template + color, not image recognition.

---

## Color Detection — Local Implementation

```ts
// Simplified approach for MVP
// 1. Resize image to small (50x50) to reduce computation
// 2. Sample center 60% pixels (avoids background)
// 3. Average RGB values
// 4. Map to nearest color in controlled palette

const PALETTE: Record<PaletteColor, [number, number, number]> = {
  white:  [255, 255, 255],
  black:  [30,  30,  30 ],
  navy:   [0,   0,   128],
  gray:   [140, 140, 140],
  beige:  [210, 190, 160],
  brown:  [120, 80,  40 ],
  olive:  [85,  107, 47 ],
  red:    [180, 40,  40 ],
  blue:   [70,  130, 200],
  green:  [60,  120, 60 ],
};

function nearestPaletteColor(r: number, g: number, b: number): PaletteColor {
  let closest: PaletteColor = 'gray';
  let minDist = Infinity;
  for (const [name, [pr, pg, pb]] of Object.entries(PALETTE)) {
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < minDist) {
      minDist = dist;
      closest = name as PaletteColor;
    }
  }
  return closest;
}
```

User always confirms. The detection is a convenience, not a requirement for accuracy.

---

## Knight Avatar Rendering — react-native-svg

Each clothing template is an SVG component that accepts a `fill` color prop.

```tsx
// Conceptual structure
<Svg viewBox="0 0 200 400">
  <KnightBase />                              {/* z-0: always rendered */}
  <ShoeTemplate id={outfit.shoes.templateId}
                fill={outfit.shoes.color} />   {/* z-1 */}
  <BottomTemplate id={outfit.bottom.templateId}
                  fill={outfit.bottom.color} /> {/* z-2 */}
  <TopTemplate id={outfit.top.templateId}
               fill={outfit.top.color} />       {/* z-3 */}
  {outfit.outerwear && (
    <OuterwearTemplate id={outfit.outerwear.templateId}
                       fill={outfit.outerwear.color} /> {/* z-4 */}
  )}
  {outfit.accessories?.map(acc => (
    <AccessoryTemplate key={acc.id} id={acc.templateId}
                       fill={acc.color} />      {/* z-5 */}
  ))}
</Svg>
```

SVG templates are static assets. Color is applied at render time. This matches the architecture requirement: infinite combinations without new illustrations.

---

## Folder Structure

```
wardrobe-knight/
├── app/                          # Expo Router — file-based routes
│   ├── _layout.tsx               # Root layout + bottom nav
│   ├── index.tsx                 # Home screen (default route)
│   ├── weather.tsx               # Weather screen
│   ├── agenda.tsx                # Agenda screen
│   ├── wardrobe/
│   │   ├── _layout.tsx           # Wardrobe tab layout
│   │   ├── index.tsx             # Wardrobe list
│   │   ├── [id].tsx              # Clothing detail
│   │   └── add.tsx               # Add clothing flow
│   ├── onboarding/
│   │   ├── welcome.tsx
│   │   ├── permissions.tsx
│   │   ├── style.tsx
│   │   └── first-items.tsx
│   └── settings.tsx
│
├── components/                   # Reusable UI (Section 4 of arch doc)
│   ├── ui/
│   │   ├── TopBar.tsx
│   │   ├── ContextChip.tsx
│   │   ├── PrimaryButton.tsx
│   │   ├── SegmentedFilter.tsx
│   │   ├── BottomNav.tsx
│   │   ├── ItemCard.tsx
│   │   └── PermissionCard.tsx
│   ├── home/
│   │   ├── RecommendationBlock.tsx
│   │   ├── CarryBlock.tsx
│   │   ├── WhyBlock.tsx
│   │   └── SwapActionRow.tsx
│   └── avatar/
│       ├── KnightAvatar.tsx      # Main avatar compositor
│       ├── KnightBase.tsx        # Base silhouette (z-0)
│       └── templates/            # SVG clothing templates
│           ├── tops/
│           ├── bottoms/
│           ├── shoes/
│           ├── outerwear/
│           └── accessories/
│
├── engine/                       # Decision logic (Section 6 of arch doc)
│   ├── context.ts                # Build DailyContext from weather + agenda
│   ├── filter.ts                 # Step 1: constraint filtering
│   ├── scorer.ts                 # Step 2: item scoring
│   ├── assembler.ts              # Step 3: outfit assembly
│   ├── validator.ts              # Step 4: combination validation
│   ├── carry.ts                  # Step 5: carry recommendation
│   ├── why.ts                    # Step 6: explanation templates
│   └── index.ts                  # Public API: generateOutfit()
│
├── stores/                       # Zustand stores
│   ├── day.ts
│   ├── outfit.ts
│   └── wardrobe.ts
│
├── db/                           # SQLite + Drizzle
│   ├── schema.ts                 # Table definitions
│   ├── migrations/
│   └── client.ts                 # DB connection
│
├── services/                     # External data fetching
│   ├── weather.ts                # Open-Meteo client
│   ├── calendar.ts               # expo-calendar wrapper
│   ├── location.ts               # expo-location wrapper
│   └── color.ts                  # Dominant color detection
│
├── types/                        # Shared TypeScript interfaces
│   ├── wardrobe.ts               # WardrobeItem, ClothingType, etc.
│   ├── weather.ts                # WeatherData, WeatherRange
│   ├── agenda.ts                 # AgendaSummary, EventTag
│   ├── context.ts                # DailyContext
│   ├── outfit.ts                 # OutfitRecommendation
│   └── template.ts               # TemplateDefinition
│
├── constants/                    # Static data
│   ├── palette.ts                # Color palette definitions
│   ├── templates.ts              # Template registry
│   ├── scoring.ts                # Weight constants + thresholds
│   └── why-templates.ts          # Explanation sentence templates
│
├── assets/                       # Static files
│   ├── fonts/
│   └── svg/                      # Raw SVG template sources
│
├── app.json                      # Expo config
├── tsconfig.json
├── drizzle.config.ts
└── package.json
```

### Why This Structure

| Directory    | Maps to                          | Rationale                                      |
|-------------|----------------------------------|------------------------------------------------|
| `app/`      | Screens (Section 2)              | Expo Router requires this structure             |
| `components/` | Component System (Section 4)   | Grouped by domain, not by type                  |
| `engine/`   | Decision Logic (Section 6)       | Isolated from UI — pure functions, fully testable |
| `stores/`   | Runtime state                    | Thin layer between engine output and UI          |
| `db/`       | Data Layer                       | Schema mirrors Section 5 data structures         |
| `services/` | Data Sync module                 | Each external dependency is isolated             |
| `types/`    | Data Structure (Section 5)       | Single source of truth for all interfaces        |
| `constants/` | Engine configuration            | Tunable without changing logic                   |

The `engine/` directory is the most important architectural boundary. It imports nothing from React, nothing from Expo, nothing from the UI layer. It takes typed inputs, returns typed outputs. This means:

- Unit testable with plain Jest (no React testing overhead)
- Portable if the rendering framework changes
- Readable as a standalone decision specification

---

## Package List

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-sqlite": "~15.0.0",
    "expo-calendar": "~13.0.0",
    "expo-location": "~18.0.0",
    "expo-image-picker": "~16.0.0",
    "expo-image-manipulator": "~13.0.0",
    "react-native-svg": "~15.0.0",
    "react-native-reanimated": "~3.16.0",
    "zustand": "~5.0.0",
    "drizzle-orm": "~0.36.0",
    "nativewind": "~4.0.0",
    "tailwindcss": "~3.4.0"
  },
  "devDependencies": {
    "typescript": "~5.6.0",
    "drizzle-kit": "~0.28.0",
    "jest": "~29.0.0",
    "@types/react": "~18.3.0"
  }
}
```

**13 runtime dependencies.** No state management library bloat, no backend SDK, no analytics, no crash reporting — those are post-MVP concerns.

---

## What This Stack Does NOT Include (Intentionally)

| Omitted             | Why                                                          |
|---------------------|--------------------------------------------------------------|
| Backend / API       | No shared state, no auth, no user-to-user features           |
| Firebase / Supabase | Adds complexity for data that's purely local                  |
| Redux               | Overkill for 3 small stores                                   |
| Storybook           | Component count is small enough to develop in-app             |
| Analytics           | Post-MVP — add Expo Analytics when user testing begins        |
| Push notifications  | Architecture doesn't spec them; morning reminder is v2        |
| i18n                | English first; add expo-localization when expanding            |
| Testing library     | Jest is enough for engine unit tests in MVP                    |
