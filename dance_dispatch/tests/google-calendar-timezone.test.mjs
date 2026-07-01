import test from 'node:test';
import assert from 'node:assert/strict';

test('normalizeGoogleCalendarDateTime converts timestamps to absolute UTC instants', () => {
  const normalizeGoogleCalendarDateTime = (input) => {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    const fallback = new Date(`${trimmed}T00:00:00Z`);
    if (!Number.isNaN(fallback.getTime())) return fallback.toISOString();
    return null;
  };

  assert.equal(normalizeGoogleCalendarDateTime('2024-10-11T22:00:00Z'), new Date('2024-10-11T22:00:00Z').toISOString());
  assert.equal(normalizeGoogleCalendarDateTime('2024-10-11T22:00:00-04:00'), new Date('2024-10-11T22:00:00-04:00').toISOString());
  assert.equal(normalizeGoogleCalendarDateTime('2024-10-11'), new Date('2024-10-11T00:00:00Z').toISOString());
});
