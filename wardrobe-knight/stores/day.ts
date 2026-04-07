/**
 * Day Store — Zustand
 *
 * Manages the daily context: weather + agenda.
 * Rebuilt on every app open.
 *
 * State:
 *   - weather: WeatherData | null
 *   - agenda: AgendaSummary | null
 *   - context: DailyContext | null
 *
 * Actions:
 *   - buildContext()  → fetches weather + calendar, builds DailyContext
 *   - overrideFormality(level) → manual day type override, rebuilds context
 */

// TODO: create(set, get) → DayStore
