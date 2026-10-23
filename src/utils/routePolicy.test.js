import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ROUTE_EXCLUSIONS,
  filterRouteSummary,
  filterRoutingNetwork,
  filterRouteGeometry
} from './routePolicy.js';

const verificationIds = [
  'P_O_14_GZ007_O',
  'oacehl0X7OcJby1R4Oba0',
  'P_O_14_IC038_O',
  'P_O_14_IC038_R'
];

const preferenceIds = [
  'P_O_14_CA164_R', 'P_O_14_CA164_O',
  'ePNQk9H2GgQ-Cbow7POH4', 'TnxdfTNGoloPBPxsVd3z7',
  'duOxQcPZP8dTe9lKJ7r8r', 'Bdl1wVURvHT6n_Nao9mGM',
  'P_O_14_IC005_R', 'P_O_14_IC005_O',
  'P_O_14_IC050_R', 'P_O_14_IC050_O',
  'rqv6KxE8qYSbJ-a4xcXsK', 'JCPiG-iikHSYZMr2lcfF2'
];

const excludedIds = [...verificationIds, ...preferenceIds];
const smartVillageLebanonId = 'T2r8Obs1qiEqRPcGqhAAW';

test('keeps the original verification holds and labels the twelve added exclusions as user preference', () => {
  assert.deepEqual(Object.keys(ROUTE_EXCLUSIONS), excludedIds);
  for (const id of verificationIds) {
    assert.match(ROUTE_EXCLUSIONS[id].status, /pending verification/);
  }
  for (const id of preferenceIds) {
    assert.equal(ROUTE_EXCLUSIONS[id].status, 'excluded by user preference');
    assert.match(ROUTE_EXCLUSIONS[id].reason, /not a finding/i);
  }
  for (const exclusion of Object.values(ROUTE_EXCLUSIONS)) {
    assert.ok(exclusion.reason);
    assert.ok(exclusion.evidence);
  }
});

test('filters only the sixteen exact summary IDs and preserves Smart Village–Lebanon', () => {
  const input = [...excludedIds.map(id => ({ id })),
    { id: 'P_O_14_GZ007_R' },
    { id: 'P_O_14_IC050_O_EXTRA' },
    { id: smartVillageLebanonId }];
  assert.deepEqual(filterRouteSummary(input).map(route => route.id), [
    'P_O_14_GZ007_R', 'P_O_14_IC050_O_EXTRA', smartVillageLebanonId
  ]);
});

test('filters route records and trips by app route ID while retaining stops and shared route IDs', () => {
  const input = {
    routes: [...excludedIds.map(id => ({ id, route_id: 'h2J_fjZiNjbt_8gzFSmzs' })),
      { id: smartVillageLebanonId, route_id: 'h2J_fjZiNjbt_8gzFSmzs' }],
    trips: [...excludedIds.map(id => ({ id: `trip-${id}`, appRouteId: id, routeId: 'h2J_fjZiNjbt_8gzFSmzs' })),
      { id: 'trip-smart-village-lebanon', appRouteId: smartVillageLebanonId, routeId: 'h2J_fjZiNjbt_8gzFSmzs' }],
    stops: [{ id: 'stop-1' }]
  };
  const filtered = filterRoutingNetwork(input);
  assert.deepEqual(filtered.routes.map(route => route.id), [smartVillageLebanonId]);
  assert.deepEqual(filtered.trips.map(trip => trip.appRouteId), [smartVillageLebanonId]);
  assert.equal(filtered.stops, input.stops);
});

test('filters geometry keys by exact app route ID', () => {
  const input = Object.fromEntries([...excludedIds, 'P_O_14_GZ007_R', smartVillageLebanonId].map(id => [id, id]));
  assert.deepEqual(Object.keys(filterRouteGeometry(input)), ['P_O_14_GZ007_R', smartVillageLebanonId]);
});

test('all sixteen additions exist in shipped data and only those exact records are filtered', () => {
  const summary = JSON.parse(fs.readFileSync('public/data/routes_summary.v2.json', 'utf8'));
  const geometry = JSON.parse(fs.readFileSync('public/data/routes_geometry.v2.json', 'utf8'));
  const network = JSON.parse(fs.readFileSync('public/data/routing_network.v1.json', 'utf8'));
  const filteredSummary = filterRouteSummary(summary);
  const filteredGeometry = filterRouteGeometry(geometry);
  const filteredNetwork = filterRoutingNetwork(network);

  for (const id of excludedIds) {
    assert.ok(summary.some(route => route.id === id), `summary missing ${id}`);
    assert.ok(Object.hasOwn(geometry, id), `geometry missing ${id}`);
  }
  assert.equal(summary.length - filteredSummary.length, excludedIds.length);
  assert.equal(Object.keys(geometry).length - Object.keys(filteredGeometry).length, excludedIds.length);
  assert.equal(network.routes.length - filteredNetwork.routes.length, excludedIds.length);
  assert.equal(network.trips.length - filteredNetwork.trips.length, excludedIds.length);
  assert.equal(filteredNetwork.stops.length, network.stops.length);
  assert.ok(filteredSummary.some(route => route.id === smartVillageLebanonId));
  assert.ok(filteredNetwork.routes.some(route => route.id === smartVillageLebanonId));
  assert.ok(filteredNetwork.trips.some(trip => trip.appRouteId === smartVillageLebanonId));
});
