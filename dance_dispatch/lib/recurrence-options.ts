export interface RecurrenceOptions {
  frequency: 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number; // 0 = Sunday ... 6 = Saturday
  dayOfMonth?: number; // 1-31
  endType: 'instances' | 'duration';
  instances?: number; // 2-52
  durationMonths?: number; // 1-12
}

const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const MAX_RECURRENCE_INSTANCES = 52;
export const MAX_RECURRENCE_MONTHS = 12;

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function addMonthsToDate(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
}

/** Builds the RRULE for EventSeries.rrule (floating local time, no DTSTART). */
export function buildSeriesRrule(startDate: string, options: RecurrenceOptions): string {
  const parts: string[] = [];

  if (options.frequency === 'monthly') {
    parts.push('FREQ=MONTHLY');
    parts.push(`BYMONTHDAY=${clampInt(options.dayOfMonth, 1, 31, Number(startDate.slice(8, 10)))}`);
  } else {
    parts.push('FREQ=WEEKLY');
    if (options.frequency === 'biweekly') parts.push('INTERVAL=2');
    const day = clampInt(options.dayOfWeek, 0, 6, new Date(`${startDate}T00:00:00Z`).getUTCDay());
    parts.push(`BYDAY=${RRULE_DAYS[day]}`);
  }

  if (options.endType === 'duration') {
    const months = clampInt(options.durationMonths, 1, MAX_RECURRENCE_MONTHS, 1);
    parts.push(`UNTIL=${addMonthsToDate(startDate, months).replace(/-/g, '')}T235959`);
  } else {
    parts.push(`COUNT=${clampInt(options.instances, 2, MAX_RECURRENCE_INSTANCES, 2)}`);
  }

  return parts.join(';');
}

export function getRecurrenceSummary(options: RecurrenceOptions): string {
  let when: string;
  if (options.frequency === 'monthly') {
    when = `Monthly on day ${options.dayOfMonth ?? 1}`;
  } else {
    const day = DAY_NAMES[clampInt(options.dayOfWeek, 0, 6, 5)];
    when = options.frequency === 'biweekly' ? `Every other ${day}` : `Every ${day}`;
  }

  if (options.endType === 'duration') {
    const months = clampInt(options.durationMonths, 1, MAX_RECURRENCE_MONTHS, 1);
    return `${when} for ${months} month${months === 1 ? '' : 's'}`;
  }
  const count = clampInt(options.instances, 2, MAX_RECURRENCE_INSTANCES, 2);
  return `${when}, ${count} times`;
}
