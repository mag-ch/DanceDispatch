import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

async function setup({ userId = 'viewer', fetchResponse = { ok: true, json: async () => ({ isSaved: false }) } } = {}) {
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
  const modules = {
    react: { ...hooks, default: React },
    'react/jsx-runtime': jsxRuntime,
    'lucide-react': { Bookmark: () => null },
    '@/app/providers/AuthContext': { useAuth: () => ({ session: { user: { id: userId } }, loading: false }) },
    '@/app/components/AuthRequiredModal': { AuthRequiredModal: () => null },
  };
  const source = await readFile(new URL('../app/components/SaveEventButton.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  const fetch = async (...args) => { calls.push(args); return fetchResponse; };
  runInNewContext(code, { exports, require: (id) => modules[id], fetch, console: { error() {} }, setTimeout, clearTimeout });
  const render = (id = 'target') => { index = 0; effects.length = 0; return exports.FollowEntityButton({ entity: 'users', entityId: id }); };
  const runEffects = async () => { effects.forEach((effect) => effect()); await new Promise((resolve) => setImmediate(resolve)); };
  return { render, runEffects, calls };
}

test('does not show or fetch a follow control for the current user', async () => {
  const { render, runEffects, calls } = await setup();
  assert.equal(render('viewer'), null);
  await runEffects();
  assert.equal(calls.length, 0);
});

test('a failed follow lookup offers retry instead of an incorrect follow action', async () => {
  const { render, runEffects, calls } = await setup({ fetchResponse: { ok: false } });
  render();
  await runEffects();
  const button = React.Children.toArray(render().props.children)[0];
  assert.equal(button.props.children, 'Retry');
  await button.props.onClick({ preventDefault() {}, stopPropagation() {} });
  assert.equal(calls.length, 1);
});

test('successful follow lookup displays the actual follow state', async () => {
  const { render, runEffects } = await setup({ fetchResponse: { ok: true, json: async () => ({ isSaved: true }) } });
  render();
  await runEffects();
  const button = React.Children.toArray(render().props.children)[0];
  assert.equal(button.props.children, 'Unfollow');
  assert.equal(button.props['aria-pressed'], true);
});
