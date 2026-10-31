import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestGet } from '../functions/api/expand.js';
function context(t, url) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/community/0003_service_budgets.sql', import.meta.url), 'utf8'));
  t.after(() => db.close());
  return { request: new Request(`https://example.test/api/expand?url=${encodeURIComponent(url)}`, { headers: { 'CF-Connecting-IP': '192.0.2.1' } }),
    env: { SERVICE_RATE_SECRET: 'a-test-secret-that-is-at-least-32-characters', COMMUNITY_DB: { prepare(sql) { let args = []; return {
      bind(...v) { args = v; return this; }, async first() { return db.prepare(sql).get(...args); },
      async run() { return { success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } }; }
    }; } } } };
}
test('lookalike Google hosts, credentials, custom ports and insecure redirects are rejected', async t => {
  let fetched = 0;
  t.mock.method(globalThis, 'fetch', async () => { fetched++; return new Response(null, { status: 302, headers: { location: 'http://www.google.com/maps/@30.04,31.23' } }); });
  for (const url of ['https://google.attacker.example/maps', 'https://user@google.com/maps', 'https://google.com:8443/maps']) {
    assert.equal((await onRequestGet(context(t, url))).status, 400);
  }
  assert.equal(fetched, 0);
  assert.equal((await onRequestGet(context(t, 'https://maps.app.goo.gl/test'))).status, 400);
  assert.equal(fetched, 1);
});
test('supported short links can resolve to Google Maps coordinates', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 302, headers: { location: 'https://www.google.com/maps/@30.04,31.23,17z' } }));
  const response = await onRequestGet(context(t, 'https://maps.app.goo.gl/test'));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).coord, [30.04, 31.23]);
});
test('oversized upstream pages are cancelled instead of fully buffered', async t => {
  let cancelled = false;
  let chunks = 0;
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    pull(controller) { if (chunks++ < 3) controller.enqueue(new Uint8Array(200000)); else controller.close(); },
    cancel() { cancelled = true; }
  })));
  const response = await onRequestGet(context(t, 'https://maps.app.goo.gl/test'));
  assert.equal(response.status, 502);
  assert.equal(cancelled, true);
});
