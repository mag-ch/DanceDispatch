import test from 'node:test';
import assert from 'node:assert/strict';

test('normalizeGoogleCalendarDateTime keeps Eastern wall time for persistence', () => {
  const normalizeGoogleCalendarDateTime = (input) => {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    const dateOnlyMatch = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) return `${dateOnlyMatch[1]}T00:00:00`;

    const naiveDateTimeMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/.exec(trimmed);
    const hasTimezoneSuffix = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed);
    if (naiveDateTimeMatch && !hasTimezoneSuffix) {
      const datePart = naiveDateTimeMatch[1];
      const hhmm = naiveDateTimeMatch[2];
      const seconds = naiveDateTimeMatch[3] ?? '00';
      return `${datePart}T${hhmm}:${seconds}`;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(parsed);

      const byType = new Map(parts.map((part) => [part.type, part.value]));
      const datePart = `${byType.get('year') ?? ''}-${byType.get('month') ?? ''}-${byType.get('day') ?? ''}`;
      const timePart = `${byType.get('hour') ?? ''}:${byType.get('minute') ?? ''}:${byType.get('second') ?? ''}`;
      if (datePart !== '--' && timePart !== '::') {
        return `${datePart}T${timePart}`;
      }
    }

    const fallback = new Date(`${trimmed}T00:00:00`);
    if (!Number.isNaN(fallback.getTime())) {
      const year = fallback.getFullYear();
      const month = String(fallback.getMonth() + 1).padStart(2, '0');
      const day = String(fallback.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}T00:00:00`;
    }

    return null;
  };

  assert.equal(normalizeGoogleCalendarDateTime('2024-10-11T22:00:00-04:00'), '2024-10-11T22:00:00');
  assert.equal(normalizeGoogleCalendarDateTime('2024-10-11T22:00:00Z'), '2024-10-11T18:00:00');
  assert.equal(normalizeGoogleCalendarDateTime('2024-10-11'), '2024-10-11T00:00:00');
});
