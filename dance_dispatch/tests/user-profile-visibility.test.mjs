import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

async function setup({ viewer = null, following = false, followError = null } = {}) {
  const calls = [];
  const fetch = (name, value = []) => async (...args) => {
    calls.push([name, ...args]);
    return value;
  };
  const query = (table) => ({
    select() { return this; },
    eq(column, value) { calls.push(['follow-filter', column, value]); return this; },
    async maybeSingle() {
      return table === 'user_blocks' ? { data: null, error: null }
        : { data: following ? { user_id: viewer?.id } : null, error: followError };
    },
  });
  const modules = {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    react: { cache: (fn) => fn },
    '@/lib/utils_supabase_server': {
      getUserById: fetch('profile', { id: 'target', username: 'Target' }),
      getAllFollowedHosts: fetch('hosts'),
      getAllFollowedUsers: fetch('users'),
      getAllFollowedVenues: fetch('venues'),
      getUserReviews: fetch('reviews', ['review']),
    },
    '@/lib/server_utils': { getSavedEventsForUserServer: fetch('events', ['event']) },
    '@/lib/auth-helpers': { getCurrentUser: async () => viewer },
    '@/lib/supabase/server': { createClient: async () => ({ from: (table) => query(table) }) },
    '@/lib/page-metadata': { pageMetadata: () => ({}) },
    './UserProfileClient': { default: 'UserProfileClient' },
  };
  const source = await readFile(new URL('../app/(public)/users/[userId]/page.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require: (name) => modules[name], Promise, Boolean });
  return { calls, render: () => exports.default({ params: Promise.resolve({ userId: 'target' }) }) };
}

for (const viewer of [null, { id: 'other' }]) {
  test(`profile does not fetch restricted activity for ${viewer ? 'non-follower' : 'signed-out viewer'}`, async () => {
    const { calls, render } = await setup({ viewer });
    const result = await render();
    assert.equal(result.props.canSeeActivity, false);
    assert.equal(calls.some(([name, , mode]) => name === 'events' && mode === 'upcoming'), false);
    assert.equal(calls.some(([name]) => name === 'reviews'), false);
  });
}

test('followers can see public profile activity; owners can see their own reviews', async () => {
  for (const [viewer, following, includeAnonymous] of [[{ id: 'other' }, true, false], [{ id: 'target' }, false, true]]) {
    const { calls, render } = await setup({ viewer, following });
    const result = await render();
    assert.equal(result.props.canSeeActivity, true);
    assert.ok(calls.some(([name, id, mode]) => name === 'events' && id === 'target' && mode === 'upcoming'));
    assert.ok(calls.some(([name, id, include]) => name === 'reviews' && id === 'target' && include === includeAnonymous));
  }
});

test('follow lookup failure does not expose restricted data', async () => {
  const { calls, render } = await setup({ viewer: { id: 'other' }, followError: new Error('database unavailable') });
  await assert.rejects(render, /database unavailable/);
  assert.equal(calls.some(([name]) => name === 'reviews' || name === 'events'), false);
});
