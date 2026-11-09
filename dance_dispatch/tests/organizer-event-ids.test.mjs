import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrganizerEventIds } from '../lib/organizer-event-ids.ts';

function client(tables, calls) {
  return {
    from(table) {
      calls.push(table);
      let rows = tables[table] ?? [];
      const query = {
        select() { return this; },
        eq(key, value) { rows = rows.filter((row) => String(row[key]) === String(value)); return this; },
        in(key, values) { rows = rows.filter((row) => values.includes(row[key])); return this; },
        order(key) { rows = [...rows].sort((a, b) => a[key] - b[key]); return this; },
        async range(start, end) { return { data: rows.slice(start, end + 1), error: null }; },
        async maybeSingle() { return { data: rows[0] ?? null, error: null }; },
      };
      return query;
    },
  };
}

test('resolves current organizer links and series occurrences once, including multiple pages', async () => {
  const calls = [];
  const tables = {
    Hosts: [{ id: 1, host_type: 'Organizer' }],
    event_hosts: [...Array.from({ length: 501 }, (_, i) => ({ host_id: 1, event_id: i + 1 })), { host_id: 2, event_id: 900 }],
    EventSeries: [{ id: 10, host_id: 1 }],
    Events: [{ id: 1, series_id: 10 }, { id: 700, series_id: 10 }, { id: 800, series_id: 11 }],
  };
  const result = await getOrganizerEventIds(client(tables, calls), '1');
  assert.equal(result.length, 502);
  assert.equal(result.filter((id) => id === 1).length, 1);
  assert.equal(result.includes(700), true);
  assert.equal(result.includes(800), false);
  assert.equal(result.includes(900), false);
  assert.equal(calls.filter((name) => name === 'event_hosts').length, 2);
});

test('non-organizers and missing hosts have no party review events', async () => {
  const calls = [];
  const db = client({ Hosts: [{ id: 2, host_type: 'DJ' }] }, calls);
  assert.deepEqual(await getOrganizerEventIds(db, '2'), []);
  assert.deepEqual(await getOrganizerEventIds(db, '3'), []);
  assert.deepEqual(calls, ['Hosts', 'Hosts']);
});

test('database errors are propagated', async () => {
  const failure = new Error('query failed');
  const db = { from: () => ({ select() { return this; }, eq() { return this; }, async maybeSingle() { return { error: failure }; } }) };
  await assert.rejects(getOrganizerEventIds(db, '1'), failure);
});
