import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestGet } from '../functions/api/walk.js';

function setup(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/community/0003_service_budgets.sql', import.meta.url), 'utf8'));
  t.after(() => db.close());
  const old = globalThis.caches;
  globalThis.caches = { default: { async match() { return undefined; }, async put() {} } };
  t.after(() => { if (old) globalThis.caches = old; else delete globalThis.caches; });
  return { GEOAPIFY_KEY: 'private-provider-key', SERVICE_RATE_SECRET: 'a-test-secret-that-is-at-least-32-characters',
    COMMUNITY_DB: { prepare(sql) { let args = []; return { bind(...v) { args = v; return this; },
      async first() { return db.prepare(sql).get(...args); },
      async run() { return { success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } }; }
    }; } } };
}
function context(env, i = 0) {
  return { env, request: new Request(`https://example.test/api/walk?from=31.2,30.04&to=31.3,${30.05 + i / 100000}`, { headers: { 'CF-Connecting-IP': '192.0.2.1' } }), waitUntil() {} };
}
test('walking refuses paid requests without working abuse protection', async t => {
  setup(t);
  let fetched = false;
  t.mock.method(globalThis, 'fetch', async () => { fetched = true; return Response.json({ features: [] }); });
  const response = await onRequestGet(context({ GEOAPIFY_KEY: 'private-provider-key' }));
  assert.equal(response.status, 503);
  assert.equal(fetched, false);
});
test('changing coordinates does not bypass client quota and cached routes remain available', async t => {
  const env = setup(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.redirect, 'manual', 'Workers requires manual redirect rejection');
    calls++;
    return Response.json({ features: [{ properties: { distance: 100, time: 80 }, geometry: { type: 'LineString', coordinates: [[31.2,30.04],[31.3,30.05]] } }] });
  });
  for (let i = 0; i < 60; i++) assert.equal((await onRequestGet(context(env, i))).status, 200);
  assert.equal((await onRequestGet(context(env, 61))).status, 429);
  assert.equal(calls, 60);
  globalThis.caches.default.match = async () => Response.json({ code: 'Ok', routes: [] });
  assert.equal((await onRequestGet(context(env, 61))).status, 200);
  assert.equal(calls, 60);
});
test('walking failures never echo provider errors or secrets', async t => {
  const env = setup(t);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error(env.GEOAPIFY_KEY); });
  const response = await onRequestGet(context(env));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { code: 'UpstreamError' });
});
