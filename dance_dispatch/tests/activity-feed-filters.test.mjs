import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_CATEGORIES, buildActivityFeed, isFeedItemSelected, toggleActivityCategory } from '../lib/activity-feed-filters.ts';

test('all four activity categories are selected by default and toggle independently', () => {
  const initial = [...ACTIVITY_CATEGORIES];
  assert.deepEqual(initial, ['reviews', 'comments', 'rsvps', 'new_events']);
  const withoutComments = toggleActivityCategory(initial, 'comments');
  assert.deepEqual(withoutComments, ['reviews', 'rsvps', 'new_events']);
  assert.deepEqual(toggleActivityCategory(withoutComments, 'comments'), ['reviews', 'rsvps', 'new_events', 'comments']);
  assert.deepEqual(initial, ACTIVITY_CATEGORIES);
  assert.deepEqual(toggleActivityCategory([], 'rsvps'), ['rsvps']);
  let selected = initial;
  for (const category of ACTIVITY_CATEGORIES) {
    selected = toggleActivityCategory(selected, category);
  }
  assert.deepEqual(selected, []);
  for (const category of ACTIVITY_CATEGORIES) {
    selected = toggleActivityCategory(selected, category);
  }
  assert.deepEqual(selected, initial);
});

test('combines categories newest first using activity timestamps', () => {
  const reviews = [
    { id: 'review', eventId: '1', username: 'A', dateSubmitted: '2026-03-02T12:00:00Z' },
    { id: 'pre-event', eventId: '2', username: 'B', dateSubmitted: '2026-03-04T12:00:00Z', isPreEvent: true },
  ];
  const activity = {
    reviewsAndComments: [
      { id: 'reply', type: 'comment', createdAt: '2026-03-03T12:00:00Z', parentReview: reviews[0] },
      { id: 'duplicate-review', type: 'review', createdAt: '2026-03-05T12:00:00Z' },
    ],
    friendsGoing: [{ id: 'rsvp', createdAt: '2026-03-06T12:00:00Z' }],
    followedEvents: [{ id: 'follow', createdAt: '2026-03-05T12:00:00Z' }],
    fromFollows: [],
  };
  const feed = buildActivityFeed(reviews, activity);
  assert.deepEqual(feed.map((item) => item.category), ['rsvps', 'new_events', 'comments', 'reviews']);
  assert.deepEqual(feed.map((item) => item.kind === 'review' ? item.review.id : item.activity.id),
    ['rsvp', 'follow', 'pre-event', 'review']);
  assert.equal(feed[3].replies[0].id, 'reply');
  assert.equal(isFeedItemSelected(feed[3], ['comments']), true);
  assert.equal(isFeedItemSelected(feed[3], ['reviews']), true);
  assert.equal(isFeedItemSelected(feed[3], ['rsvps']), false);
});

test('replies to older reviews restore their parent and group together', () => {
  const parent = { id: 'old', eventId: '4', dateSubmitted: '2025-01-01T00:00:00Z' };
  const replies = [
    { id: 'a', type: 'comment', parentReview: parent, createdAt: '2026-03-01T00:00:00Z' },
    { id: 'b', type: 'comment', parentReview: parent, createdAt: '2026-03-04T00:00:00Z' },
  ];
  const feed = buildActivityFeed([], { reviewsAndComments: replies, friendsGoing: [], fromFollows: [], followedEvents: [] });
  assert.equal(feed.length, 1);
  assert.equal(feed[0].review.id, 'old');
  assert.equal(feed[0].replies.length, 2);
  assert.equal(feed[0].date, '2026-03-04T00:00:00Z');
  assert.equal(isFeedItemSelected(feed[0], ['comments']), true);
  assert.equal(isFeedItemSelected(feed[0], ['reviews']), false);
});

test('empty activity yields an empty feed', () => {
  assert.deepEqual(buildActivityFeed([], { reviewsAndComments: [], friendsGoing: [], fromFollows: [], followedEvents: [] }), []);
});
