import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFollowedEventActivity } from '../lib/followed-event-activity.ts';

test('one event matching multiple followed entities appears once with its posting date', () => {
  const event = {
    id: '42', title: 'Party', startdate: '2026-05-01', starttime: '22:00:00',
    locationid: 'venue', location: 'Venue', hostIDs: ['dj', 'dj2'],
    hostNames: ['DJ', 'DJ 2'], imageurl: 'flyer',
  };
  const result = buildFollowedEventActivity([event, event], ['venue'], ['dj', 'dj2'],
    new Map([['42', '2026-03-01T10:00:00Z']]));
  assert.equal(result.length, 1);
  assert.equal(result[0].createdAt, '2026-03-01T10:00:00Z');
  assert.equal(result[0].eventDate, '2026-05-01T22:00:00');
  assert.equal(result[0].href, '/events/42');
  assert.equal(result[0].eventId, '42');
  assert.equal(result[0].title, 'From your follows: Venue, DJ, DJ 2');
});

test('events without a matching follow are excluded', () => {
  const event = { id: '1', locationid: 'venue', hostIDs: ['dj'] };
  assert.deepEqual(buildFollowedEventActivity([event], [], [], new Map()), []);
});
