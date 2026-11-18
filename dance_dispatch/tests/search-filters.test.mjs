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
  runInNewContext(code, { exports, require: (id) => modules[id], URLSearchParams, Date, Map, console, ...globals });
  return exports;
}

async function helpers() {
  const dates = await load('../lib/date-utils.ts', {});
  return load('../lib/search-filters.ts', { '@/lib/date-utils': dates });
}

test('filter state round-trips all URL parameters and preserves unrelated parameters', async () => {
  const { readSearchFilters, writeSearchFilters } = await helpers();
  const initial = new URLSearchParams('query=house+&categories=events&categories=hosts&includePast=true&dateStart=2025-01-01&minPrice=0&maxPrice=30&boroughs=Brooklyn&boroughs=Queens&source=link');
  const filters = readSearchFilters(initial);
  const encoded = writeSearchFilters(initial, filters);
  assert.equal(encoded.get('source'), 'link');
  assert.equal(encoded.get('query'), 'house ');
  assert.deepEqual(JSON.parse(JSON.stringify(readSearchFilters(encoded))), JSON.parse(JSON.stringify(filters)));
  filters.categories = [];
  assert.deepEqual(JSON.parse(JSON.stringify(readSearchFilters(writeSearchFilters(encoded, filters)).categories)), []);
  filters.includePast = false;
  assert.equal(writeSearchFilters(encoded, filters).has('includePast'), false);
});

test('past and upcoming filters are disjoint, ordered, and do not mutate inputs', async () => {
  const { filterEventsByTime } = await helpers();
  const events = [
    { id: 'later', startdate: '2026-11-20', starttime: '20:00', enddate: '2026-11-20', endtime: '23:00' },
    { id: 'past', startdate: '2026-11-01', starttime: '20:00', enddate: '2026-11-01', endtime: '23:00' },
    { id: 'soon', startdate: '2026-11-19', starttime: '20:00', enddate: '2026-11-19', endtime: '23:00' },
    { id: 'ongoing', startdate: '2026-11-18', starttime: '18:00', enddate: '2026-11-18', endtime: '22:00' },
    { id: 'fallback', startdate: '2026-11-18', starttime: '23:00' },
  ];
  const now = new Date(2026, 10, 18, 19, 0);
  const ids = (items) => Array.from(items, (item) => item.id);
  assert.deepEqual(ids(filterEventsByTime(events, true, now)), ['past']);
  assert.deepEqual(ids(filterEventsByTime(events, false, now)), ['ongoing', 'fallback', 'soon', 'later']);
  assert.deepEqual(events.map((event) => event.id), ['later', 'past', 'soon', 'ongoing', 'fallback']);
});

async function setupClient() {
  const search = await helpers();
  const slots = [];
  const deps = [];
  const effects = [];
  let index = 0;
  let current = new URL('https://example.test/search?query=party&source=link');
  let routerQuery = current.searchParams.toString();
  const writes = [];
  const window = {
    get location() { return current; },
    history: { replaceState(_state, _title, url) { writes.push(url); current = new URL(url, current); } },
  };
  const hooks = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
      return [slots[slot], (value) => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useMemo(fn) { index++; return fn(); },
    useEffect(fn, nextDeps) {
      const slot = index++;
      if (!deps[slot] || nextDeps.some((value, i) => value !== deps[slot][i])) {
        deps[slot] = nextDeps;
        effects.push(fn);
      }
    },
  };
  const SearchResult = () => null;
  const component = await load('../app/(public)/search/SearchClient.tsx', {
    react: hooks,
    'react/jsx-runtime': jsxRuntime,
    'lucide-react': { Search: () => null },
    '@/app/components/EventCard': { SearchResult },
    'react-select': { default: () => null },
    'next/navigation': { useSearchParams: () => new URLSearchParams(routerQuery) },
    '@/lib/search-filters': search,
  }, { window });
  const props = {
    initialEvents: [
      { id: 'past', title: 'Party past', startdate: '2000-01-01', starttime: '20:00', enddate: '2000-01-01', endtime: '23:00' },
      { id: 'future', title: 'Party future', startdate: '2099-01-01', starttime: '20:00', enddate: '2099-01-01', endtime: '23:00' },
    ],
    initialVenues: [], initialHosts: [], initialUsers: [], initialBoroughs: [],
    categories: ['events', 'venues', 'hosts', 'users'], searchBar: 'party',
  };
  const render = () => { index = 0; effects.length = 0; return component.default(props); };
  const flushEffects = () => effects.forEach((effect) => effect());
  return {
    render, flushEffects, writes, SearchResult,
    get current() { return current; },
    notify(query = current.searchParams.toString()) { routerQuery = query; },
    navigate(url) { current = new URL(url, current); routerQuery = current.searchParams.toString(); },
  };
}

function elements(node, predicate) {
  if (!React.isValidElement(node)) return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props.children).flatMap((child) => elements(child, predicate))];
}

test('rapid checkbox changes update URL and results immediately without stale navigation resets', async () => {
  const client = await setupClient();
  let tree = client.render();
  client.flushEffects();
  const checkbox = () => elements(tree, (node) => node.type === 'input' && node.props.type === 'checkbox')[0];
  const results = () => elements(tree, (node) => node.type === client.SearchResult).map((node) => node.props.entityId);
  assert.deepEqual(results(), ['future']);
  checkbox().props.onChange({ target: { checked: true } });
  tree = client.render();
  assert.deepEqual(results(), ['past']);
  assert.equal(client.current.searchParams.get('includePast'), 'true');
  const staleQuery = client.current.searchParams.toString();
  checkbox().props.onChange({ target: { checked: false } });
  tree = client.render();
  assert.deepEqual(results(), ['future']);
  assert.equal(client.current.searchParams.has('includePast'), false);
  assert.equal(client.current.searchParams.get('source'), 'link');
  client.notify(staleQuery);
  tree = client.render();
  client.flushEffects();
  tree = client.render();
  assert.equal(checkbox().props.checked, false);
  assert.deepEqual(results(), ['future']);
  client.navigate('/search?query=party&includePast=true');
  tree = client.render();
  client.flushEffects();
  tree = client.render();
  assert.equal(checkbox().props.checked, true);
  assert.deepEqual(results(), ['past']);
  client.navigate('/search?query=future&categories=events');
  tree = client.render();
  client.flushEffects();
  tree = client.render();
  assert.equal(checkbox().props.checked, false);
  assert.equal(elements(tree, (node) => node.type === 'input' && node.props.type === 'text')[0].props.value, 'future');
  assert.deepEqual(results(), ['future']);
});

test('quick edits to different filters preserve earlier values and do not navigate', async () => {
  const client = await setupClient();
  let tree = client.render();
  client.flushEffects();
  const text = elements(tree, (node) => node.type === 'input' && node.props.type === 'text')[0];
  const checkbox = elements(tree, (node) => node.type === 'input' && node.props.type === 'checkbox')[0];
  text.props.onChange({ target: { value: 'party mix ' } });
  checkbox.props.onChange({ target: { checked: true } });
  tree = client.render();
  assert.equal(client.current.searchParams.get('query'), 'party mix ');
  assert.equal(client.current.searchParams.get('includePast'), 'true');
  assert.equal(client.writes.length, 2);
  assert.equal(elements(tree, (node) => node.type === 'input' && node.props.type === 'text')[0].props.value, 'party mix ');
});

test('past-events control stays outside the mobile filters and visible across categories', async () => {
  const client = await setupClient();
  let tree = client.render();
  client.flushEffects();
  const checkbox = () => elements(tree, (node) => node.type === 'input' && node.props.type === 'checkbox');
  const sidebar = () => elements(tree, (node) => node.type === 'aside' && node.props.id === 'search-mobile-filters')[0];
  assert.equal(checkbox().length, 1);
  assert.equal(elements(sidebar(), (node) => node.type === 'input' && node.props.type === 'checkbox').length, 0);
  assert.match(sidebar().props.className, /\bhidden\b/);

  const filterButton = () => elements(tree, (node) => node.type === 'button' && node.props['aria-controls'] === 'search-mobile-filters')[0];
  filterButton().props.onClick();
  tree = client.render();
  assert.match(sidebar().props.className, /\bblock\b/);
  assert.equal(checkbox().length, 1);
  filterButton().props.onClick();
  tree = client.render();

  const categories = elements(tree, (node) => node.type === 'button' && ['events', 'venues', 'hosts'].includes(node.props.children));
  for (const button of categories) button.props.onClick();
  tree = client.render();
  assert.equal(checkbox().length, 1);
  checkbox()[0].props.onChange({ target: { checked: true } });
  tree = client.render();
  assert.equal(checkbox()[0].props.checked, true);
  assert.equal(client.current.searchParams.get('includePast'), 'true');
});
