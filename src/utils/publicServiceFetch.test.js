import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublicService, PUBLIC_SERVICE_ORIGIN } from './publicServiceFetch.js';

test('browser requests preserve same-origin relative fetch behavior', async () => {
  const expected = { ok: true };
  let called;
  const result = await fetchPublicService('/api/walk?from=1,2&to=3,4', { method: 'GET' }, {
    isNative: false,
    fetchImpl: async (...args) => { called = args; return expected; }
  });
  assert.equal(result, expected);
  assert.equal(called[0], '/api/walk?from=1,2&to=3,4');
  assert.deepEqual(called[1], { method: 'GET' });
});

test('native requests resolve only supported routes against the production origin', async () => {
  let request;
  const response = await fetchPublicService('/api/expand?url=https%3A%2F%2Fmaps.app.goo.gl%2Fx', {}, {
    isNative: true,
    timeoutMs: 900,
    http: { get: async (options) => { request = options; return { status: 200, data: { coord: [30, 31] } }; } }
  });
  assert.equal(request.url, `${PUBLIC_SERVICE_ORIGIN}/api/expand?url=https%3A%2F%2Fmaps.app.goo.gl%2Fx`);
  assert.equal(request.connectTimeout, 900);
  assert.equal(request.readTimeout, 900);
  assert.equal(response.ok, true);
  assert.deepEqual(await response.json(), { coord: [30, 31] });
});

test('native adapter rejects other origins and paths before making a request', async () => {
  for (const url of [
    'https://attacker.example/api/walk',
    '//attacker.example/api/walk',
    'https://user@mowaslaty.pages.dev/api/walk',
    'https://user:pass@mowaslaty.pages.dev/api/walk',
    'https://mowaslaty.pages.dev/api/walk#fragment',
    '/api/other',
    '/api/walk/extra',
    '/api/walk/../expand',
    '/api/%2e%2e/expand',
    'http://mowaslaty.pages.dev/api/walk'
  ]) {
    await assert.rejects(fetchPublicService(url, {}, { isNative: true, http: { get: async () => assert.fail('request must not run') } }), TypeError);
  }
});

test('native timeout and caller abort reject while the request is pending', async () => {
  const pendingHttp = { get: () => new Promise(() => {}) };
  await assert.rejects(fetchPublicService('/api/walk', {}, { isNative: true, timeoutMs: 5, http: pendingHttp }), { name: 'AbortError' });
  const controller = new AbortController();
  const pending = fetchPublicService('/api/walk', { signal: controller.signal }, { isNative: true, timeoutMs: 1000, http: pendingHttp });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
