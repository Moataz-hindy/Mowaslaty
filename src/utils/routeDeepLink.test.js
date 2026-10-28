import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExactRoute, routeIdFromSearch } from './routeDeepLink.js';

test('route query is decoded and resolves only the exact directional record', () => {
  const routes = [
    { id: 'line-east', route_id: 'line', dir: 0 },
    { id: 'line-west', route_id: 'line', dir: 1 }
  ];
  assert.equal(routeIdFromSearch('?route=line-west'), 'line-west');
  assert.equal(resolveExactRoute(routes, 'line-west'), routes[1]);
  assert.equal(resolveExactRoute(routes, 'line'), null);
});

test('missing or invalid route query does not select a fallback route', () => {
  const routes = [{ id: 'allowed', dir: 0 }];
  assert.equal(routeIdFromSearch(''), null);
  assert.equal(resolveExactRoute(routes, null), null);
  assert.equal(resolveExactRoute(routes, 'excluded-or-unknown'), null);
});
