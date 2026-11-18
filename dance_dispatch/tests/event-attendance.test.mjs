import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

async function load(file, modules, globals = {}) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require: (id) => modules[id], console, Error, Date, Intl, ...globals });
  return exports;
}

test('stored event end is compared to Eastern time regardless of server timezone and DST', async () => {
  const { isPastStoredEvent } = await load('../lib/event-attendance.ts', {});
  assert.equal(isPastStoredEvent('2026-07-01T20:00:00+00:00', '2026-07-01T22:00:00+00:00', new Date('2026-07-02T01:59:59Z')), false);
  assert.equal(isPastStoredEvent('2026-07-01T20:00:00+00:00', '2026-07-01T22:00:00+00:00', new Date('2026-07-02T02:00:01Z')), true);
  assert.equal(isPastStoredEvent('2026-01-01T22:00:00+00:00', null, new Date('2026-01-02T03:00:01Z')), true);
  assert.throws(() => isPastStoredEvent(null, null), /invalid end time/);
  assert.throws(() => isPastStoredEvent(null, '2026-02-31T12:00:00Z'), /invalid end time/);
});

async function setupRoute({ past = false, event = true, user = true } = {}) {
  const calls = [];
  const supabase = {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          if (table === 'Events') return { data: event ? { id: 42, start: 'start', end: 'end' } : null, error: null };
          return { data: null, error: null };
        },
      };
    },
  };
  const route = await load('../app/api/users/saved-events/[eventId]/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/auth-helpers': { requireAuth: async () => { if (!user) throw new Error('Unauthorized'); return { id: 'user' }; } },
    '@/lib/utils_supabase_server': { userSaveEvent: async (...args) => { calls.push(['save', ...args]); } },
    '@/lib/points': { awardPoints: async (...args) => { calls.push(['points', ...args.slice(0, 3)]); } },
    '@/lib/event-attendance': { isPastStoredEvent: () => past },
  }, { console: { error() {} } });
  const params = { params: Promise.resolve({ eventId: '42' }) };
  return {
    calls,
    post: (body) => route.POST({ json: async () => body }, params),
    get: () => route.GET({}, params),
  };
}

test('past saves require confirmation and never award RSVP points', async () => {
  const route = await setupRoute({ past: true });
  assert.equal((await route.get()).body.isPastEvent, true);
  assert.equal((await route.post({ saveToggle: true })).status, 409);
  assert.equal(route.calls.length, 0);
  assert.equal((await route.post({ saveToggle: true, attendanceConfirmed: true })).status, 200);
  assert.deepEqual(route.calls, [['save', '42', 'user', true]]);
  assert.equal((await route.post({ saveToggle: false })).status, 200);
  assert.deepEqual(route.calls.at(-1), ['save', '42', 'user', false]);
});

test('upcoming saves continue awarding RSVP points and invalid requests do not save', async () => {
  const route = await setupRoute();
  assert.equal((await route.post({ saveToggle: true })).status, 200);
  assert.deepEqual(route.calls, [['save', '42', 'user', true], ['points', 'user', 'rsvp', '42']]);
  assert.equal((await route.post({ saveToggle: 'true' })).status, 400);
  assert.equal((await (await setupRoute({ event: false })).post({ saveToggle: true })).status, 404);
  assert.equal((await (await setupRoute({ user: false })).post({ saveToggle: true })).status, 500);
});

test('a submitted event review still earns review points', async () => {
  const calls = [];
  const route = await load('../app/api/reviews/[eventId]/route.ts', {
    '@/lib/utils_supabase_server': { userSubmitReview: async () => {} },
    '@/lib/validator': {},
    '@/lib/auth-helpers': { requireAuth: async () => ({ id: 'user' }) },
    '@/lib/push-notifications': {},
    'next/server': {},
    '@/lib/admin': {},
    '@/lib/supabase/server': { createClient: async () => ({}) },
    '@/lib/points': { awardPoints: async (...args) => { calls.push(args.slice(0, 3)); return null; } },
  }, { Response, console: { log() {}, error() {} } });
  const response = await route.POST({
    json: async () => ({ content: [{ entityType: 'event', comment: 'Great event' }] }),
  }, { params: Promise.resolve({ eventId: '42' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [['user', 'review', '42']]);
});

async function setupButton({ past = true, failSave = false, requireConfirmation = false } = {}) {
  const slots = [];
  let index = 0;
  const effects = [];
  const calls = [];
  const hooks = {
    useState(initial) {
      const current = index++;
      if (!(current in slots)) slots[current] = initial;
      return [slots[current], (value) => { slots[current] = typeof value === 'function' ? value(slots[current]) : value; }];
    },
    useRef(initial) {
      const current = index++;
      if (!(current in slots)) slots[current] = { current: initial };
      return slots[current];
    },
    useEffect(fn) { effects.push(fn); },
  };
  const component = await load('../app/components/SaveEventButton.tsx', {
    react: { ...hooks, default: React },
    'react/jsx-runtime': jsxRuntime,
    'lucide-react': { Bookmark: () => null },
    '@/app/providers/AuthContext': { useAuth: () => ({ session: { user: { id: 'user' } }, loading: false }) },
    '@/app/components/AuthRequiredModal': { AuthRequiredModal: () => null },
  }, {
    fetch: async (_url, options) => {
      if (!options) return { ok: true, json: async () => ({ isSaved: false, isPastEvent: past }) };
      const body = JSON.parse(options.body);
      calls.push(body);
      if (failSave) return { ok: false, status: 500, json: async () => ({ error: 'Save failed' }) };
      if (requireConfirmation && !body.attendanceConfirmed) {
        return { ok: false, status: 409, json: async () => ({ attendanceConfirmationRequired: true }) };
      }
      return { ok: true, json: async () => ({ isPastEvent: past || requireConfirmation }) };
    },
    console: { error() {} }, setTimeout, clearTimeout,
  });
  const render = () => { index = 0; effects.length = 0; return component.SaveEventButton({ eventId: '42', showLabel: true }); };
  const runEffects = async () => { effects.forEach((effect) => effect()); await new Promise((resolve) => setImmediate(resolve)); };
  return { render, runEffects, calls };
}

function elements(node, predicate) {
  if (!React.isValidElement(node)) return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props.children).flatMap((child) => elements(child, predicate))];
}

const click = { preventDefault() {}, stopPropagation() {} };
const findButton = (tree, label) => elements(tree, (element) => element.type === 'button' && element.props.children === label)[0];

test('past attendance is confirmed before saving, then prompts for a review', async () => {
  const { render, runEffects, calls } = await setupButton();
  render();
  await runEffects();
  const button = elements(render(), (element) => element.type === 'button')[0];
  assert.equal(button.props['aria-label'], 'Mark as attended');
  button.props.onClick(click);
  assert.equal(calls.length, 0);
  findButton(render(), 'Cancel').props.onClick();
  assert.equal(calls.length, 0);
  elements(render(), (element) => element.type === 'button')[0].props.onClick(click);
  await findButton(render(), 'Yes, I attended').props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [{ saveToggle: true, attendanceConfirmed: true }]);
  assert.ok(findButton(render(), 'Leave a review'));
});

test('save errors remain visible and an event ending after lookup still requires confirmation', async () => {
  const failed = await setupButton({ failSave: true });
  failed.render();
  await failed.runEffects();
  elements(failed.render(), (element) => element.type === 'button')[0].props.onClick(click);
  findButton(failed.render(), 'Yes, I attended').props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(elements(failed.render(), (element) => element.props.role === 'alert')[0].props.children, 'Save failed');

  const boundary = await setupButton({ past: false, requireConfirmation: true });
  boundary.render();
  await boundary.runEffects();
  elements(boundary.render(), (element) => element.type === 'button')[0].props.onClick(click);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(findButton(boundary.render(), 'Yes, I attended'));
  assert.equal(boundary.calls[0].attendanceConfirmed, false);
});

test('review submission errors stay visible without closing or clearing the review', async () => {
  const slots = [];
  let index = 0;
  let closed = false;
  const hooks = {
    useState(initial) {
      const current = index++;
      if (!(current in slots)) slots[current] = initial;
      return [slots[current], (value) => { slots[current] = typeof value === 'function' ? value(slots[current]) : value; }];
    },
    useEffect() {},
  };
  const component = await load('../app/components/EventReview.tsx', {
    react: { ...hooks, default: { ...React, ...hooks } },
    'react/jsx-runtime': jsxRuntime,
    'lucide-react': {},
    './EventMediaUpload': { default: () => null },
    './ReviewReplies': { default: () => null },
    '@/lib/supabase/client': {},
    '../providers/AuthContext': {},
    'next/link': { default: () => null },
  });
  const props = {
    isOpen: true, event: { id: '42', title: 'Party' },
    onClose: () => { closed = true; },
    onSubmit: async () => { throw new Error('Review failed'); },
  };
  const render = () => { index = 0; return component.ReviewModal(props); };
  const textarea = elements(render(), (element) => element.type === 'textarea')[0];
  textarea.props.onChange({ target: { value: 'Great event' } });
  findButton(render(), 'Submit Review').props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closed, false);
  assert.equal(elements(render(), (element) => element.props.role === 'alert')[0].props.children, 'Review failed');
  assert.equal(elements(render(), (element) => element.type === 'textarea')[0].props.value, 'Great event');
});
