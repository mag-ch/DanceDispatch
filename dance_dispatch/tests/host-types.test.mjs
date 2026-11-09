import test from 'node:test';
import assert from 'node:assert/strict';
import { HOST_TYPES, filterHostsByTypeAndGenres, normalizeHostType, parseHostGenres } from '../lib/host-types.ts';

test('host type choices include every supported type and normalize selections', () => {
  assert.deepEqual(HOST_TYPES, ['DJ', 'Promoter', 'Organizer', 'Teacher', 'Host', 'Judge']);
  assert.equal(normalizeHostType(' judge '), 'Judge');
  assert.equal(normalizeHostType('invalid'), null);
});

test('genres are split, trimmed and omit blank entries', () => {
  assert.deepEqual(parseHostGenres(' House, techno , , Disco '), ['House', 'techno', 'Disco']);
  assert.deepEqual(parseHostGenres('  '), []);
});

test('host recommendations filter by type and rank by genre similarity', () => {
  const hosts = [
    { name: 'Partial', host_type: 'DJ', genres: ['tech house'] },
    { name: 'Exact', host_type: 'DJ', genres: ['house'] },
    { name: 'Other type', host_type: 'Organizer', genres: ['house'] },
    { name: 'Other genre', host_type: 'DJ', genres: ['disco'] },
  ];
  assert.deepEqual(filterHostsByTypeAndGenres(hosts, 'DJ', 'house').map((host) => host.name), ['Exact', 'Partial']);
  assert.deepEqual(filterHostsByTypeAndGenres(hosts, 'Organizer', '').map((host) => host.name), ['Other type']);
  assert.equal(filterHostsByTypeAndGenres(hosts, null, '').length, 4);
});
