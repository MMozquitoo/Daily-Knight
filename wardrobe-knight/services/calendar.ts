/**
 * Calendar Service — Google Calendar API v3
 *
 * Reads today's events and classifies formality level.
 */

import { google } from 'googleapis';
import type { AgendaEvent, AgendaSummary, EventTag } from '../types/agenda.js';
import { getGoogleServiceAccount } from './env.js';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: getGoogleServiceAccount(),
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
}

/** Keyword-based formality classification */
const FORMALITY_KEYWORDS: { tag: EventTag; words: string[] }[] = [
  {
    tag: 'formal',
    words: ['entretien', 'client', 'présentation', 'board', 'direction', 'interview', 'presentation', 'comité'],
  },
  {
    tag: 'work',
    words: ['réunion', 'meeting', 'call', 'sync', 'revue', 'review', 'demo', '1:1', 'standup', 'sprint', 'point'],
  },
  {
    tag: 'travel',
    words: ['vol', 'flight', 'voyage', 'trip', 'travel', 'aéroport', 'airport', 'train', 'gare'],
  },
  {
    tag: 'casual',
    words: ['déjeuner', 'lunch', 'café', 'coffee', 'gym', 'perso', 'anniversaire', 'birthday', 'networking', 'afterwork'],
  },
];

function classifyEvent(title: string): EventTag {
  const lower = title.toLowerCase();
  for (const { tag, words } of FORMALITY_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return tag;
  }
  return 'work'; // default
}

const TAG_PRIORITY: Record<EventTag, number> = {
  casual: 0,
  travel: 1,
  work: 2,
  formal: 3,
};

function highestTag(tags: EventTag[]): EventTag {
  if (tags.length === 0) return 'casual';
  return tags.reduce((max, tag) => (TAG_PRIORITY[tag] > TAG_PRIORITY[max] ? tag : max));
}

function deriveDayType(events: AgendaEvent[]): AgendaSummary['dayType'] {
  if (events.length === 0) return 'casual';
  const tags = events.map((e) => e.tag);
  if (tags.includes('travel')) return 'travel';
  const hasFormal = tags.includes('formal') || tags.includes('work');
  const hasCasual = tags.includes('casual');
  if (hasFormal && hasCasual) return 'mixed';
  if (hasFormal) return 'office';
  return 'casual';
}

/** Build AgendaSummary from a list of events */
/**
 * Where the day happens.
 *
 * A trip to Nice is a different wardrobe than a day in Paris, and the calendar is
 * the only thing that knows. A travel-tagged event's location wins; failing that,
 * any event with a location at all.
 */
function deriveDestination(events: AgendaEvent[]): string | undefined {
  const travel = events.find((e) => e.tag === 'travel' && e.location);
  if (travel?.location) return travel.location;

  const located = events.find((e) => e.location);
  return located?.location;
}

function buildSummary(events: AgendaEvent[]): AgendaSummary {
  return {
    events,
    meetingsCount: events.length,
    highestFormality: highestTag(events.map((e) => e.tag)),
    dayType: deriveDayType(events),
    destination: deriveDestination(events),
  };
}

/** Fetch today's events from Google Calendar */
export async function fetchTodayAgenda(): Promise<AgendaSummary> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';
  const calendar = google.calendar({ version: 'v3', auth: getAuth() });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events: AgendaEvent[] = (res.data.items ?? [])
    .filter((e) => e.summary && e.start?.dateTime)
    .map((e) => ({
      id: e.id ?? '',
      title: e.summary ?? '',
      startTime: e.start?.dateTime ?? '',
      endTime: e.end?.dateTime ?? '',
      tag: classifyEvent(e.summary ?? ''),
      location: e.location ?? undefined,
    }));

  return buildSummary(events);
}

/** Fetch a week of events, grouped by date (YYYY-MM-DD → AgendaSummary) */
export async function fetchWeekAgenda(days: number = 7): Promise<Map<string, AgendaSummary>> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';
  const calendar = google.calendar({ version: 'v3', auth: getAuth() });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfRange = new Date(startOfDay.getTime() + days * 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfRange.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const byDate = new Map<string, AgendaEvent[]>();
  for (let i = 0; i < days; i++) {
    const d = new Date(startOfDay.getTime() + i * 24 * 60 * 60 * 1000);
    byDate.set(d.toISOString().slice(0, 10), []);
  }

  for (const e of res.data.items ?? []) {
    if (!e.summary || !e.start?.dateTime) continue;
    const date = e.start.dateTime.slice(0, 10);
    const events = byDate.get(date);
    if (events) {
      events.push({
        id: e.id ?? '',
        title: e.summary ?? '',
        startTime: e.start.dateTime ?? '',
        endTime: e.end?.dateTime ?? '',
        tag: classifyEvent(e.summary ?? ''),
      });
    }
  }

  const result = new Map<string, AgendaSummary>();
  for (const [date, events] of byDate) {
    result.set(date, buildSummary(events));
  }
  return result;
}

export interface TripInfo {
  destination: string;
  startDate: string;
  endDate: string;
  days: number;
  events: AgendaEvent[];
}

/** Detect upcoming trips from calendar events within the next N days */
export async function detectTrips(daysAhead: number = 14): Promise<TripInfo[]> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';
  const calendar = google.calendar({ version: 'v3', auth: getAuth() });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfRange = new Date(startOfDay.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfRange.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const travelWords = ['vol', 'flight', 'voyage', 'trip', 'travel', 'train', 'avion', 'aéroport', 'airport', 'gare', 'déplacement'];
  const travelEvents: AgendaEvent[] = [];

  for (const e of res.data.items ?? []) {
    if (!e.summary) continue;
    const lower = e.summary.toLowerCase();
    if (travelWords.some((w) => lower.includes(w)) || e.eventType === 'outOfOffice') {
      const startTime = e.start?.dateTime || e.start?.date || '';
      const endTime = e.end?.dateTime || e.end?.date || '';
      travelEvents.push({
        id: e.id ?? '',
        title: e.summary ?? '',
        startTime,
        endTime,
        tag: 'travel',
      });
    }
  }

  if (travelEvents.length === 0) return [];

  // Extract destination from event titles (look for city names after common prepositions)
  const destPattern = /(?:à|a|vers|pour|to|->|→|–|@)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)*)/;
  const trips: TripInfo[] = [];

  for (const event of travelEvents) {
    const match = event.title.match(destPattern);
    const destination = match?.[1] ?? '';
    if (!destination) continue;

    const startDate = event.startTime.slice(0, 10);
    const endDate = event.endTime.slice(0, 10);
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    // Find all events during the trip period
    const tripEvents = (res.data.items ?? [])
      .filter((e) => {
        const eStart = (e.start?.dateTime || e.start?.date || '').slice(0, 10);
        return eStart >= startDate && eStart <= endDate && e.summary;
      })
      .map((e) => ({
        id: e.id ?? '',
        title: e.summary ?? '',
        startTime: e.start?.dateTime || e.start?.date || '',
        endTime: e.end?.dateTime || e.end?.date || '',
        tag: classifyEvent(e.summary ?? ''),
      }));

    trips.push({ destination, startDate, endDate, days, events: tripEvents });
  }

  return trips;
}

/** Format agenda for Slack display */
export function formatAgendaSlack(agenda: AgendaSummary): string {
  if (agenda.events.length === 0) {
    return '_Aucun événement aujourd\'hui_ — journée libre :palm_tree:';
  }

  const lines = agenda.events.map((e) => {
    const time = new Date(e.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const tagEmoji: Record<EventTag, string> = {
      formal: ':necktie:',
      work: ':briefcase:',
      casual: ':coffee:',
      travel: ':airplane:',
    };
    return `${tagEmoji[e.tag]} ${time} — ${e.title} _(${e.tag})_`;
  });

  lines.push(`\n*Formalité du jour :* ${agenda.highestFormality} · *Type :* ${agenda.dayType}`);
  return lines.join('\n');
}
