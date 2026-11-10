import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

async function setup(blockError = null) {
  const sent = [];
  const requested = [];
  const supabase = {
    from(table) {
      return {
        select() { return this; },
        async eq(column, value) {
          if (table === 'user_blocks') {
            assert.equal(column, 'blocker_id');
            assert.equal(value, 'author');
            return { data: [{ blocked_id: 'blocked' }], error: blockError };
          }
          requested.push(value);
          return { data: [{ endpoint: value, p256dh: 'key', auth: 'auth', expiration_time: null }], error: null };
        },
      };
    },
  };
  const modules = {
    'server-only': {},
    'web-push': { default: { setVapidDetails() {}, async sendNotification(subscription) { sent.push(subscription.endpoint); } } },
    '@supabase/supabase-js': { createClient: () => supabase },
    '@/lib/push-notification-constants': {},
    '@/lib/utils_supabase_server': {},
  };
  const source = await readFile(new URL('../lib/push-notifications.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  const process = { env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.test',
    SUPABASE_SERVICE_ROLE_KEY: 'test',
    VAPID_SUBJECT: 'mailto:test@example.test',
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'test',
    VAPID_PRIVATE_KEY: 'test',
  } };
  runInNewContext(code, { exports, require: (id) => modules[id], process, console, Set, String, Number, Array, JSON });
  return { send: exports.sendPushToUsers, sent, requested };
}

test('review pushes exclude the author’s blocked users', async () => {
  const { send, sent, requested } = await setup();
  const result = await send(['blocked', 'visible', 'visible'], { title: 'Review', body: 'New review' }, 'author');
  assert.deepEqual(sent, ['visible']);
  assert.deepEqual(requested, ['visible']);
  assert.equal(result.users, 1);
});

test('review pushes fail closed if blocked users cannot be loaded', async () => {
  const { send, sent } = await setup({ message: 'database unavailable' });
  await assert.rejects(() => send(['blocked'], { title: 'Review', body: 'New review' }, 'author'), /database unavailable/);
  assert.equal(sent.length, 0);
});
