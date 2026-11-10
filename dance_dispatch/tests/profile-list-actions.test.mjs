import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

test('horizontal preview and expanded modal receive distinct result elements', async () => {
  const SearchableListModal = () => null;
  const modules = {
    react: { ...React, useState: () => [true, () => {}], useMemo: (fn) => fn() },
    'react/jsx-runtime': jsxRuntime,
    'next/link': { default: () => null },
    './SearchableListModal': { default: SearchableListModal },
  };
  const source = await readFile(new URL('../app/components/CollapsedSectionModal.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require: (id) => modules[id] });
  const preview = React.createElement('span', { key: 'preview', showActions: false });
  const expanded = React.createElement('span', { key: 'expanded', showActions: true });
  const section = exports.default({
    title: 'Following', count: 1, emptyMessage: 'Empty', discoverHref: '/', discoverLabel: 'Discover',
    children: [preview], modalChildren: [expanded],
  });
  const children = React.Children.toArray(section.props.children);
  const previewRow = React.Children.toArray(children[1].props.children)[0].props.children;
  const modal = children[2];
  assert.equal(previewRow.props.showActions, false);
  assert.equal(modal.type, SearchableListModal);
  assert.equal(modal.props.children[0].props.showActions, true);
});
