import test from 'node:test';
import assert from 'node:assert/strict';
import { exchangeAuthCallback } from './auth.js';

test('callback removes the code before exchange and exchanges only once across remounts', async () => {
  const location = { href: 'https://example.test/auth/callback?code=once&state=opaque#community', pathname: '/auth/callback', hash: '#community' };
  const calls = [];
  const history = { state: null, replaceState(_state, _title, url) { calls.push(['clean', url]); location.href = `https://example.test${url}`; } };
  const client = { auth: { exchangeCodeForSession: async code => { calls.push(['exchange', code]); return { data: { session: {} }, error: null }; } } };
  const first = exchangeAuthCallback(client, location, history);
  const second = exchangeAuthCallback(client, location, history);
  assert.equal((await first).exchanged, true);
  await second;
  assert.deepEqual(calls, [['clean', '/auth/callback#community'], ['exchange', 'once']]);
});

test('callback never redirects to caller supplied state and handles provider errors', async () => {
  const location = { href: 'https://example.test/auth/callback?error=denied&state=https://evil.test', pathname: '/auth/callback', hash: '' };
  let cleaned;
  const result = await exchangeAuthCallback({ auth: {} }, location, { state: null, replaceState(_s, _t, url) { cleaned = url; } });
  assert.equal(result.exchanged, false);
  assert.equal(result.error.message, 'denied');
  assert.equal(cleaned, '/auth/callback');
});
