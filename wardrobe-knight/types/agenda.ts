/**
 * Agenda types
 *
 * Represents calendar data from Google Calendar API v3.
 * Focused on what affects clothing decisions.
 */

/** Formality tag applied to a calendar event based on keywords */
export type EventTag = 'formal' | 'work' | 'casual' | 'travel';

/** A simplified calendar event */
export interface AgendaEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  tag: EventTag;
  /** Google Calendar's location field — where the day actually happens */
  location?: string;
}

/** Summary of the day's agenda — input to the decision engine */
export interface AgendaSummary {
  events: AgendaEvent[];
  meetingsCount: number;
  highestFormality: EventTag;
  dayType: 'office' | 'casual' | 'travel' | 'mixed';
  /**
   * Where to dress for. If the day includes a trip, the weather that matters is
   * the destination's, not the one outside the bedroom window.
   */
  destination?: string;
}
