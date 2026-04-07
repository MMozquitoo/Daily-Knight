# Wardrobe Knight — Project Structure

> Every file has one job. Every directory has one concern.

---

## Directory Map

```
wardrobe-knight/
│
├── app/                              ROUTES (Expo Router)
│   ├── _layout.tsx                   Root layout — DB init, onboarding gate
│   ├── (tabs)/                       Bottom navigation group
│   │   ├── _layout.tsx               Tab bar: Weather | Home | Wardrobe
│   │   ├── index.tsx                 Home — daily recommendation
│   │   ├── weather.tsx               Weather — clothing-relevant forecast
│   │   └── wardrobe.tsx              Wardrobe — clothing library
│   ├── agenda.tsx                    Agenda — day context (not a tab)
│   ├── settings.tsx                  Settings — units, location, preferences
│   ├── onboarding/
│   │   ├── welcome.tsx               Step 1: welcome message
│   │   ├── permissions.tsx           Step 2: weather/calendar/camera access
│   │   ├── style.tsx                 Step 3: casual/formal/mixed
│   │   └── first-items.tsx           Step 4: add starter wardrobe
│   └── wardrobe/
│       ├── add.tsx                   Add clothing flow (camera + confirm)
│       └── [id].tsx                  Clothing detail/edit
│
├── components/                       UI COMPONENTS
│   ├── ui/                           Shared, reusable primitives
│   │   ├── TopBar.tsx                Date + location header
│   │   ├── ContextChip.tsx           Temp/rain/meetings pill
│   │   ├── PrimaryButton.tsx         Single primary action
│   │   ├── SegmentedFilter.tsx       Category tab selector
│   │   ├── BottomNav.tsx             Custom 3-item tab bar
│   │   ├── ItemCard.tsx              Wardrobe item in list
│   │   └── PermissionCard.tsx        Onboarding permission card
│   ├── home/                         Home-screen-specific components
│   │   ├── RecommendationBlock.tsx   "Wear" section
│   │   ├── CarryBlock.tsx            "Carry" section
│   │   ├── WhyBlock.tsx              "Why" explanation
│   │   └── SwapActionRow.tsx         Inline swap links
│   └── avatar/                       Knight rendering system
│       ├── KnightAvatar.tsx          Layer compositor (SVG)
│       ├── KnightBase.tsx            Base silhouette (z-0)
│       └── templates/                SVG clothing shapes
│           ├── tops/                 Shirts, t-shirts, sweaters
│           ├── bottoms/              Pants, jeans, shorts
│           ├── shoes/                Sneakers, boots, loafers
│           ├── outerwear/            Jackets, coats, blazers
│           └── accessories/          Hats, scarves, bags
│
├── engine/                           DECISION ENGINE (pure TypeScript)
│   ├── index.ts                      Public API: generateOutfit()
│   ├── context.ts                    Step 0: build DailyContext
│   ├── filter.ts                     Step 1: constraint filtering
│   ├── scorer.ts                     Step 2: item scoring (0–100)
│   ├── assembler.ts                  Step 3: pick best per layer
│   ├── validator.ts                  Step 4: combination rules
│   ├── carry.ts                      Step 5: carry recommendation
│   └── why.ts                        Step 6: explanation generation
│
├── stores/                           STATE MANAGEMENT (Zustand)
│   ├── day.ts                        Weather + agenda + daily context
│   ├── outfit.ts                     Current recommendation
│   ├── wardrobe.ts                   Clothing items (synced to SQLite)
│   └── user.ts                       Profile + onboarding state
│
├── db/                               LOCAL DATABASE (SQLite + Drizzle)
│   ├── client.ts                     Connection + initialization
│   ├── schema.ts                     Table definitions
│   └── migrations/                   Schema migration files
│
├── services/                         EXTERNAL DATA
│   ├── weather.ts                    Open-Meteo API client + cache
│   ├── calendar.ts                   expo-calendar reader + tagging
│   ├── location.ts                   expo-location + reverse geocode
│   └── color.ts                      Dominant color detection (local)
│
├── types/                            SHARED INTERFACES
│   ├── index.ts                      Barrel export
│   ├── wardrobe.ts                   WardrobeItem, ClothingType, etc.
│   ├── weather.ts                    WeatherData, HourlyForecast
│   ├── agenda.ts                     AgendaSummary, EventTag
│   ├── context.ts                    DailyContext
│   ├── outfit.ts                     OutfitRecommendation, CarryItem
│   ├── template.ts                   TemplateDefinition
│   └── user.ts                       UserProfile
│
├── constants/                        STATIC CONFIGURATION
│   ├── palette.ts                    Color definitions (RGB, hex, label)
│   ├── templates.ts                  SVG template registry
│   ├── scoring.ts                    Engine weights + thresholds
│   └── why-templates.ts              Explanation sentence templates
│
├── assets/
│   ├── fonts/                        Custom typefaces
│   └── svg/                          Raw SVG source files
│
├── app.json                          Expo config + permissions
├── tsconfig.json                     TypeScript strict + path aliases
├── index.ts                          Expo Router entry point
└── package.json
```

---

## Separation of Concerns

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  app/          Knows about: components, stores               │
│  (routes)      Does NOT know about: engine, db, services     │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  components/   Knows about: types, constants                 │
│  (UI)          Does NOT know about: engine, db, services     │
│                Receives data via props from screens           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  stores/       Knows about: engine, services, db, types      │
│  (state)       Does NOT know about: components, app/         │
│                Bridges UI and domain layers                   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  engine/       Knows about: types, constants                 │
│  (domain)      Does NOT know about: React, Expo, stores,     │
│                db, services, components, app/                 │
│                PURE TYPESCRIPT — zero external dependencies   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  services/     Knows about: types, db                        │
│  (I/O)         Does NOT know about: engine, stores, UI       │
│                Handles all external communication             │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  db/           Knows about: types                            │
│  (storage)     Does NOT know about: anything else             │
│                Pure data persistence                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Dependency Flow

```
app/ → stores/ → engine/   (for outfit generation)
                → services/ (for weather, calendar, location)
                → db/       (for persistence)

components/ → types/ + constants/ only (props in, UI out)

engine/ → types/ + constants/ only (data in, recommendation out)
```

No circular dependencies. No layer skipping.

---

## Naming Conventions

| What                | Convention          | Example                    |
|---------------------|---------------------|----------------------------|
| Route files         | kebab-case          | `first-items.tsx`          |
| Components          | PascalCase          | `KnightAvatar.tsx`         |
| Stores              | camelCase           | `wardrobe.ts` → `useWardrobeStore` |
| Engine modules      | camelCase           | `scorer.ts` → `scoreItems()` |
| Types/interfaces    | PascalCase          | `WardrobeItem`             |
| Type union literals | kebab-case          | `'light-layer'`            |
| Constants           | UPPER_SNAKE_CASE    | `WEATHER_WEIGHT`           |
| DB columns          | snake_case          | `template_id`              |
| DB tables           | snake_case plural   | `wardrobe_items`           |
| SVG templates       | kebab-case          | `oxford-shirt.svg`         |
| Directories         | kebab-case          | `why-templates.ts`         |

---

## File Count Summary

| Directory      | Files | Purpose                      |
|----------------|-------|------------------------------|
| `app/`         | 12    | Routes and layouts           |
| `components/`  | 13    | UI components                |
| `engine/`      | 8     | Decision logic               |
| `stores/`      | 4     | State management             |
| `db/`          | 2     | Database schema + client     |
| `services/`    | 4     | External data                |
| `types/`       | 8     | Type definitions             |
| `constants/`   | 4     | Static configuration         |
| **Total**      | **55**| Excluding config files       |

55 files. Each under 200 lines when implemented. No file does two things.
