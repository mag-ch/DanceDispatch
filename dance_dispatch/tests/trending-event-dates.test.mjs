import test from 'node:test';
import assert from 'node:assert/strict';
import { groupTrendingEvents } from '../lib/trending-event-dates.ts';

const items = (...dates) => dates.map((date) => ({ event: { startdate: date }, card: date }));
const dates = (group) => group.map((item) => item.card);

test('Saturday shows today, tomorrow, and all of next week before later events', () => {
  const result = groupTrendingEvents(
    items('2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-14', '2026-11-15', '2026-11-16'),
    new Date(2026, 10, 7, 12)
  );
  assert.deepEqual(dates(result.today), ['2026-11-07']);
  assert.deepEqual(dates(result.tomorrow), ['2026-11-08']);
  assert.deepEqual(dates(result.laterThisWeek), []);
  assert.deepEqual(dates(result.nextWeek), ['2026-11-09', '2026-11-14', '2026-11-15']);
  assert.deepEqual(dates(result.upcoming), ['2026-11-16']);
});

test('Sunday puts Monday under tomorrow and the rest of next week under next week', () => {
  const result = groupTrendingEvents(
    items('2026-11-08', '2026-11-09', '2026-11-10', '2026-11-15', '2026-11-16'),
    new Date(2026, 10, 8, 12)
  );
  assert.deepEqual(dates(result.today), ['2026-11-08']);
  assert.deepEqual(dates(result.tomorrow), ['2026-11-09']);
  assert.deepEqual(dates(result.nextWeek), ['2026-11-10', '2026-11-15']);
  assert.deepEqual(dates(result.upcoming), ['2026-11-16']);
});

test('weekdays retain the existing this-week and upcoming sections', () => {
  const result = groupTrendingEvents(
    items('2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'),
    new Date(2026, 10, 6, 12)
  );
  assert.deepEqual(dates(result.today), ['2026-11-06']);
  assert.deepEqual(dates(result.tomorrow), ['2026-11-07']);
  assert.deepEqual(dates(result.laterThisWeek), ['2026-11-08']);
  assert.deepEqual(dates(result.nextWeek), []);
  assert.deepEqual(dates(result.upcoming), ['2026-11-09']);
});
