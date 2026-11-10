import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const owner = '00000000-0000-0000-0000-000000000001';
const follower = '00000000-0000-0000-0000-000000000002';

async function setup({ user = { id: owner }, followError = null, profileError = null, rows = [{ user_id: follower }, { user_id: follower }] } = {}) {
  const calls = [];
  const supabase = {
    from(table) {
      const query = {
        select(value) { calls.push(['select', table, value]); return this; },
        delete() { calls.push(['delete', table]); return this; },
        eq(column, value) { calls.push(['eq', column, value]); return this; },
        order(column, options) { calls.push(['order', column, options]); return this; },
        in(column, values) { calls.push(['in', column, values]); return this; },
        then(resolve) {
          return Promise.resolve(table === 'profiles'
            ? { data: [{ id: follower, username: 'dancer' }], error: profileError }
            : { data: rows, error: followError }).then(resolve);
        },
      };
      return query;
    },
  };
  const modules = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/auth-helpers': { requireAuth: async () => { if (!user) throw new Error('Unauthorized'); return user; } },
    '@/lib/supabase/server': { createClient: async () => supabase },
  };
  async function load(path) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const exports = {};
    runInNewContext(code, { exports, require: (id) => modules[id], console: { error() {} }, Error, Set });
    return exports;
  }
  const list = await load('../app/api/users/followers/route.ts');
  const remove = await load('../app/api/users/followers/[userId]/route.ts');
  return {
    calls,
    get: () => list.GET(),
    remove: (id) => remove.DELETE({}, { params: Promise.resolve({ userId: id }) }),
  };
}

test('lists only the current user’s followers, deduplicated and named', async () => {
  const { calls, get } = await setup();
  const response = await get();
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(response.body.users)), [{ id: follower, name: 'dancer' }]);
  assert.ok(calls.some(([method, column, value]) => method === 'eq' && column === 'followed_id' && value === owner));
  assert.deepEqual(JSON.parse(JSON.stringify(calls.find(([method]) => method === 'in'))), ['in', 'id', [follower]]);
});

test('removal is scoped to the current user and rejects invalid requests', async () => {
  const { calls, remove } = await setup();
  assert.equal((await remove(follower)).status, 200);
  assert.deepEqual(calls, [
    ['delete', 'UserFollowUsers'], ['eq', 'followed_id', owner], ['eq', 'user_id', follower],
  ]);
  assert.equal((await remove(owner)).status, 400);
  assert.equal((await remove('bad')).status, 400);
  assert.equal((await (await setup({ user: null })).remove(follower)).status, 401);
});

test('database failures and unauthenticated list requests are reported', async () => {
  assert.equal((await (await setup({ followError: new Error('failed') })).get()).status, 500);
  assert.equal((await (await setup({ profileError: new Error('failed') })).get()).status, 500);
  assert.equal((await (await setup({ followError: new Error('failed') })).remove(follower)).status, 500);
  assert.equal((await (await setup({ user: null })).get()).status, 401);
});

test('empty follower list does not query profiles', async () => {
  const { calls, get } = await setup({ rows: [] });
  assert.equal((await get()).status, 200);
  assert.equal(calls.some((call) => call[1] === 'profiles'), false);
});
