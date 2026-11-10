import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

async function setup() {
  const SaveEventButton = () => null;
  const FollowEntityButton = () => null;
  const CustomLink = () => null;
  const modules = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    '@/lib/utils': {},
    '@/lib/date-utils': { isUpcoming: (event) => event.startdate === 'upcoming' },
    './SaveEventButton': { SaveEventButton, FollowEntityButton },
    './CustomLink': { default: CustomLink },
    '@/app/styles/eventcard.module.css': { default: {} },
    './UserBadgesInline': { default: () => null, BadgeChipsInline: () => null },
  };
  const source = await readFile(new URL('../app/components/EventCard.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: false },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require: (id) => modules[id], Date, Intl });
  return { SearchResult: exports.SearchResult, SaveEventButton, FollowEntityButton, CustomLink };
}

test('host, venue and user results have a follow control outside the link', async () => {
  const { SearchResult, FollowEntityButton, CustomLink } = await setup();
  for (const entity of ['hosts', 'venues', 'users']) {
    const row = SearchResult({ header: 'Name', subheader: '', entity, entityId: '123', showActions: true });
    const [link, action] = React.Children.toArray(row.props.children);
    assert.equal(link.type, CustomLink);
    assert.equal(action.props.children.type, FollowEntityButton);
    assert.equal(action.props.children.props.entity, entity);
    assert.equal(action.props.children.props.entityId, '123');
  }
});

test('event results provide labelled RSVP and disable past events', async () => {
  const { SearchResult, SaveEventButton } = await setup();
  for (const [startdate, disabled] of [['upcoming', false], ['past', true]]) {
    const row = SearchResult({ header: 'Party', subheader: '', entity: 'events', entityId: '42', event: { startdate }, showActions: true });
    const [, action] = React.Children.toArray(row.props.children);
    assert.equal(action.props.children.type, SaveEventButton);
    assert.equal(action.props.children.props.eventId, '42');
    assert.equal(action.props.children.props.isDisabled, disabled);
    assert.equal(action.props.children.props.showLabel, true);
  }
});

test('results with no actionable entity do not render a control', async () => {
  const { SearchResult } = await setup();
  for (const props of [{ entity: 'events' }, { entity: 'events', entityId: '1' }, { entity: 'unknown', entityId: '1' }]) {
    const row = SearchResult({ header: 'Name', subheader: '', ...props, showActions: true });
    assert.equal(React.Children.toArray(row.props.children).length, 1);
  }
});

test('preview cards have no action controls by default', async () => {
  const { SearchResult } = await setup();
  for (const entity of ['users', 'venues', 'hosts', 'events']) {
    const row = SearchResult({ header: 'Name', subheader: '', entity, entityId: '123', event: { startdate: 'upcoming' } });
    assert.equal(React.Children.toArray(row.props.children).length, 1);
  }
});
