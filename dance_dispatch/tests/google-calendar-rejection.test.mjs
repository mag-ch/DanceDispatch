import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import ts from 'typescript';

async function load(file, modules, globals = {}) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports, require: (id) => modules[id], console, Error, URL, URLSearchParams, Date, Intl,
    ...globals,
  });
  return exports;
}

const event = {
  id: 'calendar-1', summary: 'Dance', start: { date: '2026-11-18' }, end: { date: '2026-11-19' },
};

async function calendarSetup({ rejection = false, existing = false, rpcResult = 'inserted', rpcError = null, item = event } = {}) {
  const calls = [];
  const supabase = {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          if (table === 'rejected_calendar_events') return { data: rejection ? { google_cal_id: event.id } : null };
          if (table === 'Events') return { data: existing ? { id: 1 } : null };
          throw new Error(`Unexpected table ${table}`);
        },
      };
    },
    async rpc(name, args) {
      calls.push(['rpc', name, JSON.parse(JSON.stringify(args))]);
      return { data: rpcResult, error: rpcError };
    },
  };
  const fs = {
    async readFile() { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); },
    async writeFile(file, value) { calls.push(['writeToken', value]); },
    async mkdir() {},
    async unlink() {},
  };
  const fetch = async (url) => {
    calls.push(['fetch', url]);
    if (url.includes('oauth2.googleapis.com')) return { ok: true, json: async () => ({ access_token: 'token' }) };
    if (url.includes('?')) return { ok: true, json: async () => ({ items: [item], nextSyncToken: 'next-token' }) };
    return { ok: true, json: async () => item };
  };
  const calendar = await load('../lib/google-calendar.ts', {
    'server-only': {}, 'node:fs/promises': fs, 'node:path': path,
    './supabase/service': { createServiceClient: () => supabase },
  }, {
    fetch,
    process: { cwd: () => '.', env: {
      GOOGLE_CALENDAR_CLIENT_ID: 'client', GOOGLE_CALENDAR_CLIENT_SECRET: 'secret',
      GOOGLE_CALENDAR_REFRESH_TOKEN: 'refresh', GOOGLE_CALENDAR_ID: 'calendar',
    } },
  });
  return { calendar, calls };
}

test('sync skips tombstones and preserves approved existing events', async () => {
  for (const [options, field] of [[{ rejection: true }, 'skippedExcluded'], [{ existing: true }, 'skippedExisting']]) {
    const { calendar, calls } = await calendarSetup(options);
    const result = await calendar.syncGoogleCalendarEventsToSupabase();
    assert.equal(result[field], 1);
    assert.equal(calls.filter(([kind]) => kind === 'rpc').length, 0);
    assert.equal(calls.at(-1)[0], 'writeToken');
  }
});

test('sync handles a concurrent rejection and advances its token only on success', async () => {
  const racing = await calendarSetup({ rpcResult: 'excluded' });
  const result = await racing.calendar.syncGoogleCalendarEventsToSupabase();
  assert.equal(result.skippedExcluded, 1);
  assert.equal('p_restore' in racing.calls.find(([kind]) => kind === 'rpc')[2], false);
  assert.equal(racing.calls.at(-1)[0], 'writeToken');

  const failing = await calendarSetup({ rpcError: { message: 'pending insert failed' } });
  await assert.rejects(failing.calendar.syncGoogleCalendarEventsToSupabase(), /pending insert failed/);
  assert.equal(failing.calls.some(([kind]) => kind === 'writeToken'), false);
});

test('new calendar events are queued by the transactional import', async () => {
  const { calendar, calls } = await calendarSetup();
  const result = await calendar.syncGoogleCalendarEventsToSupabase();
  assert.equal(result.inserted, 1);
  assert.equal(result.pendingQueued, 1);
  const rpc = calls.find(([kind]) => kind === 'rpc');
  assert.equal(rpc[1], 'import_google_calendar_event');
  assert.equal(rpc[2].p_event.google_cal_id, 'calendar-1');
  assert.equal('p_restore' in rpc[2], false);
});

async function routeSetup({ authenticated = true, result = true, error = null } = {}) {
  const calls = [];
  const modules = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/admin': { requireAdmin: async () => { if (!authenticated) throw new Error('Unauthorized'); } },
    '@/lib/auth-helpers': {},
    '@/lib/supabase/service': { createServiceClient: () => ({
      rpc: async (name, args) => { calls.push([name, args.p_event_id]); return { data: result, error }; },
    }) },
    '@/lib/utils_supabase_server': { revalidateCatalogCache: () => calls.push(['revalidate']) },
    '@supabase/supabase-js': {},
  };
  const route = await load('../app/api/google-calendar/pending-events/route.ts', modules);
  return { calls, request: (eventId) => route.DELETE({ json: async () => ({ eventId }) }) };
}

test('pending rejection validates inputs, authorizes, and invalidates cache only after success', async () => {
  const valid = await routeSetup();
  assert.equal((await valid.request('42')).status, 200);
  assert.deepEqual(valid.calls, [['reject_pending_event', '42'], ['revalidate']]);
  assert.equal((await valid.request('0')).status, 400);
  assert.equal((await (await routeSetup({ authenticated: false })).request('42')).status, 401);
  assert.equal((await (await routeSetup({ result: false })).request('42')).status, 404);
  const failed = await routeSetup({ error: new Error('database failed') });
  assert.equal((await failed.request('42')).status, 500);
  assert.equal(failed.calls.length, 1);
});

test('migration moves only identifiable orphan rows and makes rejection and import transactional', async () => {
  const sql = await readFile(new URL('../supabase/rejected_calendar_events.sql', import.meta.url), 'utf8');
  assert.match(sql, /begin;[\s\S]*commit;/i);
  assert.match(sql, /where event_id is null and google_cal_id is not null and length\(btrim\(google_cal_id\)\) > 0/);
  assert.equal((sql.match(/pg_advisory_xact_lock\(hashtextextended\(calendar_id, 0\)\)/g) ?? []).length, 2);
  assert.match(sql, /insert into public\."Events"[\s\S]*insert into public\.pending_events/);
  assert.match(sql, /revoke all on function public\.import_google_calendar_event/);
  assert.match(sql, /drop function if exists public\.import_google_calendar_event\(jsonb, bigint\[\], boolean\)/);
  assert.doesNotMatch(sql, /p_restore|delete from public\.rejected_calendar_events/i);
});
