import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestPost } from '../functions/api/feedback.js';

function setup(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/community/0003_service_budgets.sql', import.meta.url), 'utf8'));
  t.after(() => db.close());
  return { COMMUNITY_DB: { prepare(sql) { let args = []; return {
    bind(...v) { args = v; return this; }, async first() { return db.prepare(sql).get(...args); },
    async run() { return { success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } }; }
  }; } }, SERVICE_RATE_SECRET: 'a-test-secret-that-is-at-least-32-characters',
  RESEND_API_KEY: 'server-test-key', FEEDBACK_TO: 'private-owner@example.test', FEEDBACK_FROM: 'support@example.test' };
}
const req = body => new Request('https://example.test/api/feedback', {
  method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
  body: JSON.stringify(body)
});

test('feedback only delivers to server-configured recipient and never reveals recipient or provider details', async t => {
  const env = setup(t);
  let delivered;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.redirect, 'manual', 'Workers requires manual redirect rejection');
    delivered = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: 'provider-private-id' }), { status: 200 });
  });
  const response = await onRequestPost({ request: req({ kind: 'feedback', message: '<b>test</b>', to: 'attacker@example.test' }), env });
  assert.equal(response.status, 200);
  assert.deepEqual(delivered.to, ['private-owner@example.test']);
  assert.equal(delivered.text, '<b>test</b>');
  assert.equal(delivered.html, undefined);
  assert.deepEqual(await response.json(), { sent: true });
});

test('feedback rejects missing config, oversized input and unsafe attachment names before sending', async t => {
  const env = setup(t);
  t.mock.method(globalThis, 'fetch', () => { throw new Error('must not send'); });
  assert.equal((await onRequestPost({ request: req({ message: 'test' }), env: {} })).status, 503);
  assert.equal((await onRequestPost({ request: req({ kind: 'feedback', message: 'a'.repeat(5001) }), env })).status, 400);
  assert.equal((await onRequestPost({ request: req({ kind: 'route', message: 'test', file: { name: '../bad.html', content: 'x' } }), env })).status, 400);
});

test('provider failures do not leak secret values or report a successful send', async t => {
  const env = setup(t);
  t.mock.method(globalThis, 'fetch', async () => new Response(env.FEEDBACK_TO + env.RESEND_API_KEY, { status: 500 }));
  const response = await onRequestPost({ request: req({ kind: 'privacy', message: 'remove my account' }), env });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { code: 'DeliveryUnavailable' });
});

test('provider redirects never forward the private message or authorization to another URL', async t => {
  const env = setup(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++;
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 307, headers: { location: 'https://untrusted.example' } });
  });
  const response = await onRequestPost({ request: req({ kind: 'feedback', message: 'private test' }), env });
  assert.equal(response.status, 502);
  assert.equal(calls, 1);
});
