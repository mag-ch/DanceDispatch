import test from 'node:test';
import assert from 'node:assert/strict';
import { metadataDescription, pageMetadata } from '../lib/page-metadata.ts';

test('metadata contains matching title, description, URL and social images', () => {
  const result = pageMetadata('Refuge', 'Dance events', '/venues/42', '/images/default_venues.jpg');
  assert.equal(result.title, 'Refuge');
  assert.equal(result.description, 'Dance events');
  assert.equal(result.openGraph.url, '/venues/42');
  assert.equal(result.openGraph.siteName, 'DanceDispatch');
  assert.deepEqual(result.openGraph.images, [{ url: '/images/default_venues.jpg' }]);
  assert.equal(result.twitter.card, 'summary_large_image');
  assert.deepEqual(result.twitter.images, ['/images/default_venues.jpg']);
});

test('descriptions normalize whitespace, apply fallbacks, and limit length', () => {
  assert.equal(metadataDescription('  House\n  music  ', 'fallback'), 'House music');
  assert.equal(metadataDescription(null, 'fallback'), 'fallback');
  assert.equal(metadataDescription('  ', 'fallback'), 'fallback');
  assert.equal(metadataDescription('x'.repeat(200), 'fallback').length, 160);
});
