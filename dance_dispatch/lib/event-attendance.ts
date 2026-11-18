// Event timestamps are stored as Eastern wall-clock values, not UTC instants.
export function isPastStoredEvent(start: string | null, end: string | null, now = new Date()): boolean {
  const value = end || start;
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (!match) throw new Error('Event has an invalid end time');
  const [, year, month, day, hour, minute, second] = match;
  const wallTime = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const eventDate = new Date(wallTime);
  if (eventDate.getUTCFullYear() !== Number(year) || eventDate.getUTCMonth() !== Number(month) - 1 ||
      eventDate.getUTCDate() !== Number(day) || eventDate.getUTCHours() !== Number(hour) ||
      eventDate.getUTCMinutes() !== Number(minute) || eventDate.getUTCSeconds() !== Number(second)) {
    throw new Error('Event has an invalid end time');
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const currentWallTime = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'), now.getMilliseconds());
  return wallTime < currentWallTime;
}
