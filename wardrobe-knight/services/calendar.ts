/**
 * Calendar Service
 *
 * Reads today's events from device calendars via expo-calendar.
 *
 * Flow:
 *   1. Get calendar IDs
 *   2. Fetch events for today (start of day → end of day)
 *   3. Tag each event based on title/keywords
 *   4. Build AgendaSummary
 *
 * Event tagging heuristics:
 *   - Contains "meeting", "review", "interview" → formal
 *   - Contains "standup", "sync", "1:1" → work
 *   - Contains "lunch", "coffee", "gym" → casual
 *   - Contains "flight", "trip", "travel" → travel
 *   - Default → work
 *
 * Exports:
 *   - fetchTodayAgenda() → AgendaSummary
 */

// TODO: Implement calendar reading + event tagging
