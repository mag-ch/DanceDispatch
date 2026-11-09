import test from 'node:test';
import assert from 'node:assert/strict';
import { recentHostComments, toHostEventReview } from '../lib/host-review-display.ts';

const row = (id, created_at, overrides = {}) => ({
  id, created_at, event_id: '10', eventName: 'Party', username: 'Someone',
  rating: null, comment: 'Comment', privacy_level: 'public', entity_type: 'event', mediaPaths: [], ...overrides,
});

test('filters to past year, sorts newest first, and includes rating or media-only reviews', () => {
  const now = new Date('2026-11-09T12:00:00Z');
  const comments = [
    row('old', '2025-11-09T11:59:59Z'),
    row('boundary', '2025-11-09T12:00:00Z'),
    row('rating', '2026-09-01T00:00:00Z', { comment: '', rating: 4 }),
    row('media', '2026-10-01T00:00:00Z', { comment: '', mediaPaths: ['media'] }),
    row('empty', '2026-10-02T00:00:00Z', { comment: '' }),
    row('future', '2026-11-10T00:00:00Z'),
  ];
  assert.deepEqual(recentHostComments(comments, now).map((item) => item.id), ['media', 'rating', 'boundary']);
  assert.equal(comments[0].id, 'old');
});

test('converts general and host-specific entries without mixing their content', () => {
  const host = { id: '2', name: 'DJ' };
  const general = toHostEventReview(row('1', '2026-01-01T00:00:00Z'), host);
  assert.equal(general.mainComment, 'Comment');
  assert.equal(general.djReviews, undefined);
  const specific = toHostEventReview(row('2', '2026-01-01T00:00:00Z', {
    entity_type: 'host', rating: 4, privacy_level: 'anonymous', username: 'Anonymous',
  }), host);
  assert.equal(specific.mainComment, undefined);
  assert.deepEqual(specific.djReviews, [{ djId: '2', djName: 'DJ', rating: 4, comments: 'Comment' }]);
  assert.equal(specific.username, 'Anonymous');
});
