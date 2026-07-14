/**
 * Calendar dates in the user's timezone — Europe/Paris — in one place.
 *
 * The worn-log was keyed with new Date().toISOString().slice(0,10), which is UTC.
 * Anchoring to the machine's "local" time doesn't fix it either: Vercel's servers
 * run in UTC, so `new Date().getDate()` there is still the UTC date. The app is for
 * France, so the only correct anchor is Europe/Paris explicitly — that gives the
 * same answer on a UTC server and on a laptop in any timezone. Between Paris
 * midnight and the UTC offset (up to +02:00 in summer) UTC is already "tomorrow",
 * which is exactly when the worn-log landed on the wrong day and the cooldown went
 * off by one.
 */

const TZ = 'Europe/Paris';

// en-CA formats as YYYY-MM-DD, which is the shape the sheet stores
const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });

/** A Date as YYYY-MM-DD in Europe/Paris */
export function localDateStr(d: Date = new Date()): string {
  return FMT.format(d);
}

/** Today, in Europe/Paris */
export function todayStr(): string {
  return localDateStr();
}

/** Whole days from a YYYY-MM-DD date string to today, computed on the calendar dates */
export function daysAgo(dateStr: string, today: string = todayStr()): number {
  // Compare the calendar dates directly (parse as UTC midnight so no offset skews
  // the subtraction) — both strings are already Paris dates, so this is exact.
  const a = Date.parse(`${dateStr}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
