import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

async function setup({ privacy = 'public', profileError = null, username = 'dancer' } = {}) {
  const calls = [];
  const sends = [];
  const supabase = {
    from(table) {
      const query = {
        select() { return this; },
        eq(column, value) { calls.push([table, column, value]); return this; },
        async maybeSingle() {
          if (table === 'Reviews') return { data: { id: 1, event_id: 2, user_id: 'user-id', privacy_level: privacy }, error: null };
          return { data: profileError ? null : { username }, error: profileError };
        },
        then(resolve) { return Promise.resolve({ data: [{ user_id: 'follower' }], error: null }).then(resolve); },
      };
      return query;
    },
  };
  const modules = {
    'node:crypto': { randomUUID: () => 'uuid' },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/auth-helpers': { requireAuth: async () => ({ id: 'admin' }) },
    '@/lib/utils_supabase_server': { getEventById: async () => ({ id: '2', title: 'Party' }) },
    '@/lib/push-notification-constants': { PUSH_TEST_USER_ID: 'admin' },
    '@/lib/push-notifications': {
      sendPushToAllUsers: async (payload) => { sends.push(payload); return {}; },
      sendPushToUsers: async (users, payload) => { sends.push({ ...payload, users }); return {}; },
    },
    '@/lib/supabase/server': { createClient: async () => supabase },
  };
  const code = await readFile(new URL('../app/api/push-notifications/broadcast/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, require: (id) => modules[id], console, Set, String, Number, Array });
  return { post: (body) => exports.POST({ json: async () => body }), calls, sends };
}

test('new review announcement resolves username but targets followers by ID', async () => {
  const { post, calls, sends } = await setup();
  const response = await post({ mode: 'new-review', reviewId: '1', followersOnly: true });
  assert.equal(response.status, 200);
  assert.equal(sends[0].body, 'dancer posted a review for Party!');
  assert.deepEqual(sends[0].users, ['follower']);
  assert.ok(calls.some(([table, column, value]) => table === 'profiles' && column === 'id' && value === 'user-id'));
  assert.ok(calls.some(([table, column, value]) => table === 'UserFollowUsers' && column === 'followed_id' && value === 'user-id'));
});

test('anonymous review does not expose or fetch the author username', async () => {
  const { post, calls, sends } = await setup({ privacy: 'anonymous' });
  const response = await post({ mode: 'new-review', reviewId: '1' });
  assert.equal(response.status, 200);
  assert.equal(sends[0].body, 'Anonymous posted a review for Party!');
  assert.equal(calls.some(([table]) => table === 'profiles'), false);
});

test('private review and profile errors do not send a notification', async () => {
  const privateReview = await setup({ privacy: 'private' });
  assert.equal((await privateReview.post({ mode: 'new-review', reviewId: '1' })).status, 400);
  assert.equal(privateReview.sends.length, 0);
  const failedLookup = await setup({ profileError: new Error('lookup failed') });
  assert.equal((await failedLookup.post({ mode: 'new-review', reviewId: '1' })).status, 500);
  assert.equal(failedLookup.sends.length, 0);
});
