import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const owner = '00000000-0000-0000-0000-000000000001';
const target = '00000000-0000-0000-0000-000000000002';

async function setup({ user = { id: owner }, error = null } = {}) {
  const calls = [];
  const supabase = {
    from(table) {
      return {
        async upsert(row, options) { calls.push(['upsert', table, row, options]); return { error }; },
        delete() {
          calls.push(['delete', table]);
          return {
            eq(column, value) {
              calls.push(['eq', column, value]);
              return this;
            },
            then(resolve) { return Promise.resolve({ error }).then(resolve); },
          };
        },
      };
    },
  };
  const modules = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/auth-helpers': { requireAuth: async () => { if (!user) throw new Error('Unauthorized'); return user; } },
    '@/lib/supabase/server': { createClient: async () => supabase },
  };
  const source = await readFile(new URL('../app/api/users/blocks/[userId]/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require: (id) => modules[id], console, Error });
  const request = (method, id) => exports[method]({}, { params: Promise.resolve({ userId: id }) });
  return { calls, request };
}

test('blocking is scoped to the current user and duplicate requests are safe', async () => {
  const { calls, request } = await setup();
  assert.equal((await request('POST', target)).status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), [
    'upsert', 'user_blocks', { blocker_id: owner, blocked_id: target },
    { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
  ]);
});

test('unblocking can only delete the current user’s block', async () => {
  const { calls, request } = await setup();
  assert.equal((await request('DELETE', target)).status, 200);
  assert.deepEqual(calls, [
    ['delete', 'user_blocks'], ['eq', 'blocker_id', owner], ['eq', 'blocked_id', target],
  ]);
});

test('rejects invalid users, self-blocks, unauthenticated requests and database errors', async () => {
  const { calls, request } = await setup();
  assert.equal((await request('POST', owner)).status, 400);
  assert.equal((await request('POST', 'invalid')).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await (await setup({ user: null })).request('POST', target)).status, 401);
  assert.equal((await (await setup({ error: new Error('failed') })).request('POST', target)).status, 500);
});
