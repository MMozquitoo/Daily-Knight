/**
 * Agenda types
 *
 * Represents calendar data read from the device via expo-calendar.
 * Focused on what affects clothing decisions, not full event management.
 */

/** Tag applied to a calendar event based on its content */
export type EventTag = 'formal' | 'work' | 'casual' | 'travel';

/** A simplified calendar event */
export interface AgendaEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  tag: EventTag;
}

/** Summary of the day's agenda — input to the decision engine */
export interface AgendaSummary {
  events: AgendaEvent[];
  meetingsCount: number;
  highestFormality: EventTag;
  dayType: 'office' | 'casual' | 'travel' | 'mixed';
}
