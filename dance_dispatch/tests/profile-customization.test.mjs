import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

async function setup({ user = { id: 'me', email: 'old@example.com' }, available = true, updateError = null, emailError = null, immediate = false } = {}) {
  const calls = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      updateUser: async (data, options) => {
        calls.push(['email', data, options]);
        return { data: { user: { email: immediate ? data.email : 'old@example.com' } }, error: emailError };
      },
    },
    rpc: async (name, args) => {
      calls.push(['rpc', name, args]);
      return { data: available, error: null };
    },
    from: (table) => ({
      select: () => table === 'Hosts'
        ? Promise.resolve({ data: [{ genres: ['House', 'Techno'] }], error: null })
        : { eq: () => ({ single: async () => ({ data: { genres: ['Old genre'] }, error: null }) }) },
      update: (values) => ({
        eq: async (column, id) => {
          calls.push(['update', values, column, id]);
          return { error: updateError };
        },
      }),
    }),
  };
  const source = await readFile(new URL('../app/api/profile/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const modules = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/supabase/server': { createClient: async () => client },
  };
  runInNewContext(code, { exports, require: (name) => modules[name], URL, console });
  const submit = (values = {}) => exports.PATCH({
    url: 'https://example.com/api/profile',
    json: async () => ({ fullName: '  Alex  ', username: ' dancer ', email: 'old@example.com', bio: '  hello  ', genres: ['House'], ...values }),
  });
  return { calls, submit };
}

test('requires authentication and rejects invalid or unavailable genres', async () => {
  const anonymous = await setup({ user: null });
  assert.equal((await anonymous.submit()).status, 401);
  const { calls, submit } = await setup();
  assert.equal((await submit({ genres: ['Invented'] })).status, 400);
  assert.equal((await submit({ username: '  ' })).status, 400);
  assert.equal(calls.length, 0);
});

test('saves trimmed profile for the authenticated user and preserves an existing retired genre', async () => {
  const { calls, submit } = await setup();
  const result = await submit({ genres: ['Old genre'] });
  assert.equal(result.status, 200);
  const update = calls.find(([name]) => name === 'update');
  assert.equal(update[1].full_name, 'Alex');
  assert.equal(update[1].username, 'dancer');
  assert.equal(update[1].bio, 'hello');
  assert.equal(update[1].genres[0], 'Old genre');
  assert.equal(update[2], 'id');
  assert.equal(update[3], 'me');
  assert.ok(!('email' in update[1]));
});

test('reports duplicate username and email without requesting an email change', async () => {
  const duplicateEmail = await setup({ available: false });
  assert.equal((await duplicateEmail.submit({ email: 'new@example.com' })).status, 409);
  assert.equal(duplicateEmail.calls.some(([name]) => name === 'update' || name === 'email'), false);
  const duplicateName = await setup({ updateError: { code: '23505' } });
  assert.equal((await duplicateName.submit()).status, 409);
});

test('requests email confirmation after saving and reports pending or immediate changes', async () => {
  for (const immediate of [false, true]) {
    const { calls, submit } = await setup({ immediate });
    const result = await submit({ email: ' NEW@example.com ' });
    assert.equal(result.body.emailPending, !immediate);
    assert.deepEqual(calls.map(([name]) => name), ['rpc', 'update', 'email']);
    assert.equal(calls[2][1].email, 'new@example.com');
    assert.equal(calls[2][2].emailRedirectTo, 'https://example.com/auth/confirm?next=%2Fprofile');
  }
});

test('reports partial success when the email change fails', async () => {
  const { submit } = await setup({ emailError: { message: 'Email unavailable' } });
  const result = await submit({ email: 'new@example.com' });
  assert.equal(result.status, 400);
  assert.equal(result.body.profileSaved, true);
  assert.match(result.body.error, /Email unavailable/);
});
