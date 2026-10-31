import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { serviceBudget } from '../functions/_service-security.js';

export function database(t) {
  const db = new DatabaseSync(':memory:');
  const binding = { prepare(sql) {
    let args = [];
    return { bind(...values) { args = values; return this; },
      async run() { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
      async first() { return db.prepare(sql).get(...args) || null; }
    };
  } };
  t.after(() => db.close());
  return { db, binding };
}

test('outbound services fail closed when abuse protection is unconfigured', async () => {
  const response = await serviceBudget(new Request('https://example.test'), {}, 'walk');
  assert.equal(response.status, 503);
});

test('atomic budgets stop repeated clients and changing clients cannot exceed global quota', async t => {
  let clock = Date.parse('2026-10-30T01:00:00Z');
  t.mock.method(Date, 'now', () => clock);
  const { db, binding } = database(t);
  db.exec(readFileSync(new URL('../migrations/community/0003_service_budgets.sql', import.meta.url), 'utf8'));
  const env = { COMMUNITY_DB: binding, SERVICE_RATE_SECRET: 'a-test-secret-that-is-at-least-32-characters' };
  const req = ip => new Request('https://example.test/api/feedback', { headers: { 'CF-Connecting-IP': ip } });
  for (let i = 0; i < 5; i++) assert.equal(await serviceBudget(req('192.0.2.1'), env, 'feedback'), null);
  assert.equal((await serviceBudget(req('192.0.2.1'), env, 'feedback')).status, 429);
  for (let i = 0; i < 95; i++) assert.equal(await serviceBudget(req(`198.51.100.${i}`), env, 'feedback'), null);
  assert.equal((await serviceBudget(req('203.0.113.1'), env, 'feedback')).status, 429);
  assert.equal(db.prepare("SELECT count FROM service_rate_limits WHERE key='feedback:global'").get().count, 100);
  assert.ok(db.prepare('SELECT key FROM service_rate_limits').all().every(row => !row.key.includes('192.0.2.1')));
  clock += 3 * 3600000;
  assert.equal((await serviceBudget(req('203.0.113.2'), env, 'feedback')).status, 429);
  assert.equal(db.prepare('SELECT count(*) AS n FROM service_rate_limits WHERE expires_at<?').get(clock).n, 0,
    'expired client fingerprints must be pruned even while global quota is full');
});
