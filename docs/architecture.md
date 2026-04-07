# Wardrobe Knight — Application Architecture

> Open, understand the day, show one clear answer.
> The user should never feel they are browsing outfits.
> They should feel the choice has already been made.

---

## 1. App Architecture

### Product Structure

| Module           | Purpose                                          |
|------------------|--------------------------------------------------|
| Home             | Today's recommendation                           |
| Weather          | Forecast and weather impact on clothing           |
| Agenda           | Calendar context for the day                      |
| Wardrobe         | Clothing library and item management              |
| Setup            | Onboarding, permissions, style preference         |
| Outfit Engine    | Deterministic rule/scoring service                |
| Avatar Renderer  | Layered 2D knight assembly                        |
| Data Sync        | Weather API, calendar import, local wardrobe storage |

### System Layers

```
┌─────────────────────────────────────────────┐
│  PRESENTATION                               │
│  Native mobile UI                           │
│  Fast-loading, low-animation,               │
│  one dominant action per screen             │
├─────────────────────────────────────────────┤
│  DOMAIN                                     │
│  Context Builder → Rule Engine →            │
│  Outfit Selector → Carry Selector           │
├─────────────────────────────────────────────┤
│  DATA                                       │
│  Local DB (wardrobe/items/preferences)      │
│  Cached weather · Calendar summary          │
│  Permission states                          │
└─────────────────────────────────────────────┘
```

### Core Runtime Flow

```
1. App opens
2. Fetch cached weather + calendar summary
3. Build day context
4. Score wardrobe items
5. Select best outfit set
6. Render knight with layers
7. Show Wear, Carry, Why
```

---

## 2. Screen-by-Screen Breakdown

### A. Splash / Launch

- **Purpose:** Instant entry, no decisions
- **Content:** App mark. Short loading state only if needed.
- **Behavior:**
  - If setup incomplete → route to onboarding
  - If setup complete → route directly to Home

### B. Onboarding 1: Welcome

- One message: *"Wardrobe Knight helps you decide what to wear."*
- One primary action: **Continue**

### C. Onboarding 2: Permissions

- Permission cards:
  - **Weather** — location access
  - **Calendar** — agenda context
  - **Camera** — add clothes faster
- One primary action: **Allow access**
- Secondary text-only option: *Set up later*

### D. Onboarding 3: Style Preference

- Choices: **Casual** · **Formal** · **Mixed**
- One primary action: **Save preference**

### E. Onboarding 4: Add First Items

- Prompt to add minimum starter wardrobe:
  - Top
  - Bottom
  - Shoes
  - Outerwear *(optional)*
- One primary action: **Add clothing**

### F. Home

```
┌──────────────────────────────┐
│  Mon, Apr 7 · Paris          │
│                              │
│  [14°C] [Rain 40%] [2 mtgs] │
│                              │
│         ┌──────┐             │
│         │KNIGHT│             │
│         │AVATAR│             │
│         └──────┘             │
│                              │
│  WEAR                        │
│  · Navy Oxford Shirt         │
│  · Dark Chinos               │
│  · Brown Derbies             │
│  · Light Blazer              │
│                              │
│  CARRY                       │
│  · Umbrella                  │
│                              │
│  WHY                         │
│  Cool weather and a formal   │
│  meeting favor a smart       │
│  layered outfit.             │
│                              │
│  [ Change outfit ]           │
│                              │
│  Swap top · Swap shoes       │
│                              │
├──────────────────────────────┤
│  Weather · Agenda · Wardrobe │
└──────────────────────────────┘
```

- **Top:** Date, Location
- **Context chips:** Temperature, Rain %, Meeting count
- **Center:** Large knight avatar wearing selected outfit
- **Wear:** Top, Bottom, Shoes, Outerwear (if applicable)
- **Carry:** 0–3 carry items (umbrella, bag, layer, nothing)
- **Why:** One short sentence only
- **Primary button:** Change outfit
- **Secondary inline:** Swap top, Swap shoes
- **Bottom nav:** Weather · Agenda · Wardrobe

### G. Change Outfit — Modal / Sheet

- Opens from Home
- Options:
  - Regenerate full outfit
  - Swap top
  - Swap bottom
  - Swap shoes
  - Swap outerwear
- No deep configuration
- Immediate preview on knight

### H. Weather Screen

- **Purpose:** Show only what affects clothing choice
- **Content:**
  - Current temperature
  - Feels like
  - Rain probability
  - Wind speed
  - Morning / Afternoon / Evening summary
- **Bottom insight:** *"Light outerwear recommended until 16:00"*
- **Primary action:** Use for today
- No full meteorology UI

### I. Agenda Screen

- **Purpose:** Show day type, not full calendar management
- **Content:**
  - Today's events list
  - Event tags: Formal · Work · Casual · Travel
  - Day summary: *"Office day with 1 formal meeting"*
- **Primary action:** Adjust day context
- **Manual override:** Mark today casual / Mark today formal

### J. Wardrobe Screen

- **Segmented tabs:** All · Tops · Bottoms · Shoes · Outerwear · Accessories
- **Item card:**
  - Template icon
  - Color swatch
  - Name
  - Formality tag
  - Availability state
- **Primary action:** Add clothing

### K. Add Clothing Flow

```
1. Capture or import photo
2. Auto-detect dominant color
3. User confirms: type, formality, context, weather suitability
4. Generate template-based item
5. Save to wardrobe
```

### L. Clothing Detail Screen

- **Preview:** Template shape + color
- **Fields:** Type, Color, Formality, Suitable weather, Usage context, Availability
- **Primary action:** Save
- **Secondary:** Mark unavailable

### M. Settings

Minimal only:

- Units (metric / imperial)
- Location
- Calendar source
- Default style
- Permissions
- Palette preferences *(optional)*

---

## 3. User Flows

### First-Time Setup

```
Open app → Welcome → Grant permissions → Choose style → Add first items → Home
```

### Add Clothing

```
Tap "Add clothing" → Take photo / import → System detects color →
Confirm type → Confirm formality + contexts → Save → Item selectable by engine
```

### Daily Use

```
Open app → Home shows recommendation instantly → Read Wear / Carry / Why →
(If unsatisfied) Tap "Change outfit" → Regenerate or swap item → Updated knight shown
```

### Manual Override

```
Open Agenda or Home → Adjust context manually → Re-run selection → Updated outfit shown
```

---

## 4. Component System

### Core UI Components

| Component            | Purpose                              |
|----------------------|--------------------------------------|
| `TopBar`             | Date + Location                      |
| `ContextChip`        | Temp, Rain, Meetings, Formality      |
| `KnightAvatar`       | Base body + layer slots              |
| `RecommendationBlock` | Title + item rows                   |
| `CarryBlock`         | 0–3 carry items                      |
| `WhyBlock`           | Single concise explanation           |
| `PrimaryButton`      | One per screen                       |
| `ItemCard`           | Wardrobe item display                |
| `SwapActionRow`      | Inline swap actions                  |
| `PermissionCard`     | Onboarding permission request        |
| `SegmentedFilter`    | Wardrobe category tabs               |
| `BottomNav`          | Weather · Agenda · Wardrobe          |

### Knight Avatar Layer System

```
z-index (back to front):

5  accessories   ← hat, scarf, watch
4  outerwear     ← jacket, coat, blazer
3  top           ← shirt, t-shirt, sweater
2  bottom        ← pants, shorts, skirt
1  shoes         ← sneakers, boots, loafers
0  base          ← head/body silhouette (constant)
```

Each layer uses:
- `vector template id` — shape reference
- `color token` — from controlled palette
- `optional variant` — e.g., collar type

**Rendering rule:** Fixed z-index order. No custom illustration per item.

### Visual Style Rules

- Large central avatar
- High whitespace
- One accent color only
- Muted neutrals for UI chrome
- Clear typography contrast
- Motion limited to:
  - Subtle outfit fade on change
  - No decorative animation loops

---

## 5. Data Structure

### User

```json
{
  "id": "user_1",
  "location": "Paris",
  "units": "metric",
  "stylePreference": "mixed",
  "permissions": {
    "location": true,
    "calendar": true,
    "camera": true
  }
}
```

### Wardrobe Item

```json
{
  "id": "item_101",
  "name": "Navy Oxford Shirt",
  "type": "shirt",
  "category": "top",
  "templateId": "top_shirt_oxford",
  "color": "navy",
  "formality": "smart",
  "contexts": ["office", "casual"],
  "weatherSuitability": {
    "minTemp": 12,
    "maxTemp": 24,
    "rainOk": true,
    "windOk": true
  },
  "availability": "available",
  "layer": "top"
}
```

### Daily Context

```json
{
  "date": "2026-04-07",
  "location": "Paris",
  "weather": {
    "temperature": 14,
    "feelsLike": 12,
    "rainProbability": 40,
    "condition": "cloudy",
    "wind": 18
  },
  "agenda": {
    "meetingsCount": 2,
    "highestFormality": "formal",
    "dayType": "office"
  },
  "userStylePreference": "mixed"
}
```

### Outfit Recommendation

```json
{
  "wear": {
    "top": "item_101",
    "bottom": "item_202",
    "shoes": "item_305",
    "outerwear": "item_407",
    "accessories": ["item_502"]
  },
  "carry": ["umbrella"],
  "why": "Cool weather and a formal meeting favor a smart layered outfit."
}
```

### Template Definition

```json
{
  "templateId": "top_shirt_oxford",
  "layer": "top",
  "shape": "oxford_shirt",
  "supportedColors": ["white", "navy", "gray", "black", "beige"]
}
```

---

## 6. Decision Logic Model

### Approach

Deterministic. Rule-based filters first, scoring second, best valid combination wins.

### Step 1: Build Constraints (Filter)

Remove items that are:
- Unavailable
- Outside current temperature range
- Mismatched to required formality level
- Mismatched to day context (if strict)

### Step 2: Score Individual Items

| Factor                     | Weight |
|----------------------------|--------|
| Weather match              | 0–40   |
| Formality match            | 0–30   |
| Context match              | 0–20   |
| User style preference match | 0–10  |
| **Max score per item**     | **100** |

#### Scoring Rules

| Condition                     | Effect                                  |
|-------------------------------|------------------------------------------|
| `temperature < 18`            | Outerwear bonus                          |
| `temperature > 24`            | Penalize heavy layers                    |
| `rainProbability > 30`        | Boost water-safe shoes + outerwear       |
| `highestFormality == "formal"` | Heavily penalize casual items           |
| `dayType == "casual"`         | Allow broad scoring range                |
| `wind > 20`                   | Boost closed shoes + outerwear           |
| No meetings                   | Reduce formality threshold               |

#### Sample Score

```
Item: Navy Blazer
  +35  weather fit
  +30  formality fit
  +18  office context
  + 8  mixed style preference
  ───
  = 91
```

### Step 3: Assemble Outfit by Category

Pick highest-scoring valid item for each required layer:
- **top** (required)
- **bottom** (required)
- **shoes** (required)
- **outerwear** (if threshold met)
- **accessory** (if context requires)

### Step 4: Combination Validation

Check outfit-level rules:

| Rule                              | Purpose                        |
|-----------------------------------|--------------------------------|
| Formality consistency             | No formal top + athletic shoes |
| Color compatibility               | Prefer neutral harmony         |
| Weather coherence                 | No summer item on rain day     |
| Protection layer                  | At least one in cold/rain      |

### Step 5: Carry Recommendation

Pure rule-based:

| Condition                   | Carry item   |
|-----------------------------|-------------|
| `rainProbability > 30`      | Umbrella    |
| Temperature swing > 8°C     | Light layer |
| Formal office day           | Bag         |
| No condition triggered      | Nothing     |

### Step 6: Why Message Generation

Template-based short sentences:

- *"Rain later today, so a jacket and umbrella are recommended."*
- *"Your calendar is formal, so the outfit is slightly more structured."*
- *"Mild weather and no meetings allow a simpler casual combination."*

### Regeneration Logic

- Same rules, same context
- Exclude current chosen item/outfit from top rank
- Select next-best valid combination
- Preserve context consistency

### Swap Logic

- User taps "Swap top"
- Re-score only top items under current constraints
- Keep other selected layers fixed (unless invalidated)

---

## 7. Scalability Suggestions

These are **future expansions** — none should be built in v1.

| Feature                        | Impact                                    |
|--------------------------------|-------------------------------------------|
| Season profiles                | No architecture change needed              |
| Favorites / recently worn      | Light ranking modifier                     |
| Laundry / unavailable automation | Status lifecycle for items               |
| Multiple saved contexts        | Office day, travel day, weekend presets    |
| Expanded template library      | No rendering system change needed          |
| Server sync                    | Keep decision engine local for speed       |

---

## Design Principle

The app should behave like this: **open, understand the day, show one clear answer.**

The user should never feel they are browsing outfits. They should feel the choice has already been made.
