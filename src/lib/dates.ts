// All dates use the device's local time zone. A "date key" is YYYY-MM-DD in local time.

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a date key into a local Date at midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Add calendar months, keeping the day of month of `anchorDay` and clamping
 * to the end of shorter months (e.g. 31 Jan + 1 month → 28/29 Feb).
 */
export function addMonthsKey(key: string, months: number, anchorDay?: number): string {
  const d = fromDateKey(key);
  const day = anchorDay ?? d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const clamped = Math.min(day, daysInMonth(target.getFullYear(), target.getMonth()));
  return toDateKey(new Date(target.getFullYear(), target.getMonth(), clamped));
}

/** Monday = 0 … Sunday = 6 */
export function weekdayMondayFirst(key: string): number {
  return (fromDateKey(key).getDay() + 6) % 7;
}

export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function monthShort(key: string): string {
  return MONTHS[fromDateKey(key).getMonth()];
}

/** "11 Nov" */
export function formatShort(key: string): string {
  const d = fromDateKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Wednesday, 11 Nov 2026" */
export function formatLong(key: string): string {
  const d = fromDateKey(key);
  return `${WEEKDAYS[weekdayMondayFirst(key)]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
