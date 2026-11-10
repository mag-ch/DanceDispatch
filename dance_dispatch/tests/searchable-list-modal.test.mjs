import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

async function setup(search = '') {
  const effects = [];
  let closed = 0;
  const dialog = { showModal() { this.opened = true; }, close() { this.closed = true; } };
  const hooks = {
    ...React,
    useState: () => [search, () => {}],
    useRef: () => ({ current: dialog }),
    useMemo: (fn) => fn(),
    useEffect: (fn) => effects.push(fn),
    useId: () => 'title-id',
  };
  const source = await readFile(new URL('../app/components/SearchableListModal.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports,
    require: (id) => id === 'react' ? hooks : id === 'react/jsx-runtime' ? jsxRuntime : null,
  });
  const render = (children) => exports.default({
    title: 'Followed Hosts', count: React.Children.count(children), emptyMessage: 'No hosts.', onClose: () => { closed++; }, children,
  });
  return { render, effects, dialog, closed: () => closed };
}

function content(element) {
  return React.Children.toArray(element.props.children)[2].props.children;
}

test('matches list cards by name or subtitle, ignoring case and whitespace', async () => {
  const { render } = await setup('  tEcHnO ');
  const cards = [
    React.createElement('span', { key: 'a', header: 'Artist', subheader: 'Techno' }),
    React.createElement('span', { key: 'b', header: 'Venue', subheader: 'House' }),
  ];
  assert.deepEqual(React.Children.toArray(content(render(cards))).map((item) => item.props.header), ['Artist']);
});

test('distinguishes empty lists from searches without matches', async () => {
  const { render } = await setup('missing');
  assert.equal(content(render([])).props.children, 'No hosts.');
  const item = React.createElement('span', { header: 'Artist', subheader: 'House' });
  assert.equal(content(render([item])).props.children, 'No matches found.');
});

test('opens a native dialog and closes on cancel, button, or backdrop, not its interior', async () => {
  const { render, effects, dialog, closed } = await setup();
  const element = render([]);
  const cleanup = effects[0]();
  assert.equal(dialog.opened, true);
  const event = { preventDefault() { this.prevented = true; } };
  element.props.onCancel(event);
  assert.equal(event.prevented, true);
  const button = React.Children.toArray(React.Children.toArray(element.props.children)[0].props.children)[1];
  button.props.onClick();
  const target = { getBoundingClientRect: () => ({ left: 10, right: 100, top: 10, bottom: 100 }) };
  element.props.onClick({ target, currentTarget: target, clientX: 20, clientY: 20 });
  assert.equal(closed(), 2);
  element.props.onClick({ target, currentTarget: target, clientX: 2, clientY: 2 });
  assert.equal(closed(), 3);
  cleanup();
  assert.equal(dialog.closed, true);
});
