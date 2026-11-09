import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
test('service worker passes a flyer to notification options and preserves defaults without it', async () => {
  const handlers = {};
  const calls = [];
  const self = {
    addEventListener(type, handler) { handlers[type] = handler; },
    registration: { showNotification(title, options) { calls.push({ title, options }); return Promise.resolve(); } },
  };
  runInNewContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), { self });
  const push = async (payload) => {
    let operation;
    handlers.push({ data: { json: () => payload }, waitUntil(promise) { operation = promise; } });
    await operation;
  };
  await push({ title: 'Party', body: 'Tonight', href: '/events/42', tag: 'party', image: ' https://example.com/flyer.jpg ' });
  assert.equal(calls[0].options.image, 'https://example.com/flyer.jpg');
  assert.equal(calls[0].options.icon, '/icons/icon_1.png');
  assert.equal(calls[0].options.badge, '/icons/icon_1.png');
  assert.equal(calls[0].options.data.href, '/events/42');
  await push({ title: 'Message', image: ' ' });
  assert.equal('image' in calls[1].options, false);
  assert.equal(calls[1].options.icon, '/icons/icon_1.png');
  assert.equal(calls[1].options.badge, '/icons/icon_1.png');
  assert.equal(calls[1].options.data.href, '/notifications');
  await push({ title: 'No flyer' });
  assert.equal('image' in calls[2].options, false);
  assert.equal(calls[2].options.icon, '/icons/icon_1.png');
});
