import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

async function setup({ lookupError = null, saveError = null } = {}) {
  const rows = new Set();
  const calls = [];
  const supabase = {
    from(table) {
      assert.equal(table, 'UserFollowedHosts');
      const filters = {};
      return {
        async upsert(row, options) {
          calls.push(['upsert', JSON.parse(JSON.stringify(row)), JSON.parse(JSON.stringify(options))]);
          if (saveError) return { error: saveError };
          rows.add(`${row.user_id}:${row.host_id}`);
          return { error: null };
        },
        select() { return this; },
        delete() { this.deleting = true; return this; },
        eq(column, value) { filters[column] = String(value); return this; },
        async maybeSingle() {
          return { data: rows.has(`${filters.user_id}:${filters.host_id}`) ? { id: 1 } : null, error: lookupError };
        },
        then(resolve) {
          if (this.deleting) rows.delete(`${filters.user_id}:${filters.host_id}`);
          return Promise.resolve({ error: saveError }).then(resolve);
        },
      };
    },
  };
  const source = await readFile(new URL('../lib/utils_supabase_server.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('utils_supabase_server.ts', source, ts.ScriptTarget.Latest, true);
  const functions = ast.statements
    .filter((node) => ts.isFunctionDeclaration(node) && ['userSaveHost', 'checkHostSaved'].includes(node.name?.text))
    .map((node) => node.getText(ast)).join('\n');
  const code = ts.transpileModule(functions, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports, createServerClient: async () => supabase, console: { error() {} }, Error, Number, String,
  });
  return { ...exports, calls, rows };
}

test('multiple users may follow one host and repeated follows are idempotent', async () => {
  const { userSaveHost, checkHostSaved, calls, rows } = await setup();
  await userSaveHost('42', 'user-1', true);
  assert.equal(await checkHostSaved('42', 'user-1'), true);
  assert.equal(await checkHostSaved('42', 'user-2'), false);
  await userSaveHost('42', 'user-2', true);
  await userSaveHost('42', 'user-2', true);
  assert.equal(rows.size, 2);
  assert.deepEqual(calls[0], ['upsert', { host_id: '42', user_id: 'user-1' }, {
    onConflict: 'user_id,host_id', ignoreDuplicates: true,
  }]);
  await userSaveHost('42', 'user-1', false);
  assert.equal(await checkHostSaved('42', 'user-1'), false);
  assert.equal(await checkHostSaved('42', 'user-2'), true);
});

test('lookup and write errors are not mistaken for an unfollowed or saved host', async () => {
  const failedLookup = await setup({ lookupError: new Error('lookup failed') });
  await assert.rejects(failedLookup.checkHostSaved('42', 'user-1'), /lookup failed/);
  const failedSave = await setup({ saveError: new Error('insert failed') });
  await assert.rejects(failedSave.userSaveHost('42', 'user-1', true), /Failed to save user follow/);
});

test('host follow route surfaces lookup and write failures', async () => {
  const modules = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/auth-helpers': { requireAuth: async () => ({ id: 'user-1' }) },
    '@/lib/utils_supabase_server': {
      checkHostSaved: async () => { throw new Error('lookup failed'); },
      userSaveHost: async () => { throw new Error('save failed'); },
    },
  };
  const source = await readFile(new URL('../app/api/users/saved-hosts/[hostId]/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require: (id) => modules[id], console: { error() {} }, Error, Number, String });
  const params = { params: Promise.resolve({ hostId: '42' }) };
  assert.equal((await exports.GET({}, params)).status, 500);
  assert.equal((await exports.POST({ json: async () => ({ saveToggle: true }) }, params)).status, 500);
});

test('migration replaces host-only uniqueness and removes the wrong venue foreign key', async () => {
  const sql = await readFile(new URL('../supabase/host_follow_constraints.sql', import.meta.url), 'utf8');
  assert.match(sql, /begin;[\s\S]*commit;/i);
  assert.match(sql, /contype = 'u' and conkey = array\[host_attnum\]/);
  assert.match(sql, /confrelid = 'public\."Venues"'::regclass/);
  assert.match(sql, /on public\."UserFollowedHosts" \(user_id, host_id\)/);
  assert.doesNotMatch(sql, /delete\s+from/i);
});
