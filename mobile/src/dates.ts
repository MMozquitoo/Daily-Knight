// French day/date label for the "Hoy" header, derived from the outfit's own
// date instead of being hand-typed at the call site (which drifts from
// reality the moment the fixture — or later, the real backend — moves on).

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** "2026-08-18" -> "Mardi 18 août" */
export function formatDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayName = DAYS[date.getUTCDay()];
  const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  return `${capitalized} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}
