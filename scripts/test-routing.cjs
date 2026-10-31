const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');

function load(entry) {
  const result = buildSync({ entryPoints: [path.resolve(__dirname, '..', entry)], bundle: true,
    platform: 'node', format: 'cjs', write: false });
  const filename = path.join(__dirname, `${path.basename(entry)}-test.cjs`);
  const compiled = new Module(filename, module); compiled.filename = filename; compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, filename); return compiled.exports;
}

const { planJourney } = load('src/utils/tripPlanner.js');
const { createRoutingIndex } = load('src/utils/routingNetwork.js');
const { journeyRidePath } = load('src/utils/journey.js');
const shippedNetwork = require('../public/data/routing_network.v1.json');
const shippedBrtCatalogue = require('../public/data/brt_catalogue.v1.json');
const stop = (id, lat, lng) => ({ id, nameEn: id, nameAr: id, lat, lng });
const stops = [stop('a', 30, 31), stop('b', 30.01, 31), stop('c', 30.02, 31), stop('d', 30.03, 31)];
const trip = (id, calls, vehicle = 'Bus') => ({ id, appRouteId: id, source: 'gtfs', calls: calls.map(([stopId, sequence, canBoard = true, canAlight = true, distanceMeters]) => ({
  stopId, sequence, canBoard, canAlight, distanceMeters: distanceMeters ?? (sequence - 1) * 1100, distanceEstimated: true
})) });
const routes = Object.fromEntries(['r1','r2','r3','direct','later','micro'].map((id, i) => [id, { id, num: String(i + 1), vehicle: id === 'micro' ? 'Box' : 'Bus', color: '#123456' }]));
const network = { version: 1, metadata: { historical: true, servicesVerified: false }, routes: Object.values(routes), stops, trips: [
  trip('r1', [['a',1],['b',2]]), trip('r2', [['b',1],['c',2]]), trip('r3', [['c',1],['d',2]]),
  trip('direct', [['a',1],['d',2]]), trip('later', [['a',1],['d',2]]), trip('micro', [['a',1],['d',2]], 'Box')
] };
const near = (id) => { const s = stops.find(item => item.id === id); return [s.lat, s.lng]; };

function test(name, fn) { try { fn(); console.log(`PASS ${name}`); } catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1; } }

test('finds directed journeys through three rides with generic alternating legs', () => {
  const result = planJourney(near('a'), near('d'), network, { maxTransfers: 2 });
  assert.equal(result.status, 'ok');
  assert.ok(result.transferRoutes.some(j => j.legs.filter(l => l.kind === 'ride').length === 3));
  const journey = result.transferRoutes.find(j => j.legs.filter(l => l.kind === 'ride').length === 3);
  assert.equal(journey.transfers, 2);
  assert.deepEqual(journey.legs.map(l => l.kind), ['walk','ride','walk','ride','walk','ride','walk']);
});

test('clips selected ride geometry between boarding and alighting stops', () => {
  const leg = { route: { id: 'shape' }, fromCoord: [30.002, 31], toCoord: [30.008, 31], path: [[30.002, 31], [30.008, 31]] };
  const result = journeyRidePath(leg, { shape: [[30, 31], [30.005, 31], [30.01, 31]] });
  assert.equal(result.estimated, false);
  assert.deepEqual(result.path[0], [30.002, 31]);
  assert.ok(Math.abs(result.path.at(-1)[0] - 30.008) < 1e-5);
  assert.ok(Math.abs(result.path.at(-1)[1] - 31) < 1e-5);
  const ordinary = journeyRidePath({ ...leg, fromCoord: [30.004,31], toCoord: [30.006,31] }, { shape: [[30,31],[30.004,31],[30.006,31],[30.01,31]] });
  assert.equal(ordinary.estimated, false);
  assert.ok(Math.abs(ordinary.path[0][0] - 30.004) < 1e-5);
  const loopShape = [[30,31],[30.01,31],[30,31],[30,31.01]];
  const repeatedStop = journeyRidePath({ ...leg, fromCoord: [30,31], toCoord: [30,31.01], path: loopShape.slice(2) }, { shape: loopShape });
  assert.equal(repeatedStop.estimated, true, 'ambiguous repeated shape occurrence uses the selected trip-call path');
  assert.deepEqual(repeatedStop.path, loopShape.slice(2));
  const midSegmentLoop = [[30,31],[30.01,31],[30,31],[30,31.01]];
  const secondPass = journeyRidePath({ ...leg, fromCoord: [30.005,31], toCoord: [30,31.01], path: [[30.005,31],[30,31],[30,31.01]] }, { shape: midSegmentLoop });
  assert.equal(secondPass.estimated, true, 'ambiguous endpoint projections inside repeated segments use the selected call path');
  assert.deepEqual(secondPass.path, [[30.005,31],[30,31],[30,31.01]]);
});

test('does not route backward and obeys call pickup/alight permissions', () => {
  const reverse = planJourney(near('d'), near('a'), network);
  assert.equal(reverse.directRoutes.length + reverse.transferRoutes.length, 0);
  const forbidden = { ...network, routes: [...network.routes, { id: 'blocked', vehicle: 'Bus' }], trips: [trip('blocked', [['a',1,false,true],['d',2,true,false]])] };
  assert.equal(planJourney(near('a'), near('d'), forbidden).directRoutes.length, 0);
});

test('walking limits count access, interchange and egress; zero walk stays zero', () => {
  const result = planJourney(near('a'), near('d'), network, { maxWalkMeters: 0, maxTransferWalkMeters: 0, maxTotalWalkMeters: 0 });
  const journey = result.directRoutes.find(j => j.legs.some(l => l.kind === 'ride'));
  assert.ok(journey);
  assert.equal(journey.totalWalkMeters, 0);
  assert.ok(journey.legs.filter(l => l.kind === 'walk').every(l => l.durationMinutes === 0));
  assert.equal(planJourney([30.1,31], near('d'), network, { maxWalkMeters: 1200 }).directRoutes.length, 0);
});

test('same point, invalid input, index reuse and pre-search vehicle filter are explicit', () => {
  assert.equal(planJourney(near('a'), near('a'), network).status, 'same-point');
  assert.equal(planJourney([NaN, 0], near('d'), network).status, 'invalid-input');
  assert.equal(createRoutingIndex(network), createRoutingIndex(network));
  const filtered = planJourney(near('a'), near('d'), network, { vehicle: 'Microbus' });
  assert.equal(filtered.status, 'ok');
  assert.ok(filtered.directRoutes.length > 0);
  assert.ok(filtered.directRoutes.every(j => j.legs.some(l => l.kind === 'ride' && l.route.vehicle === 'Box')));
});

test('keeps distinct transfer coordinates within the full walking budget', () => {
  const e = stop('e', 30.0118, 31);
  const transferNetwork = { ...network, stops: [...stops, e], trips: [
    trip('r1', [['a',1],['b',2]]), trip('r2', [['e',1],['c',2]]), trip('r3', [['c',1],['d',2]])
  ] };
  const result = planJourney(near('a'), near('d'), transferNetwork, { maxWalkMeters: 0, maxTransferWalkMeters: 300, maxTotalWalkMeters: 300, maxTransfers: 2 });
  const transfer = result.transferRoutes.find(j => j.legs.some(l => l.kind === 'ride' && l.tripId === 'r1') && j.legs.some(l => l.kind === 'ride' && l.tripId === 'r2'));
  assert.ok(transfer);
  const transferWalk = transfer.legs.find(l => l.kind === 'walk' && l.purpose === 'transfer');
  assert.ok(transferWalk.distanceMeters > 150 && transferWalk.distanceMeters <= 300);
  assert.ok(transfer.totalWalkMeters <= 300);
  const overBudget = planJourney(near('a'), near('d'), transferNetwork, { maxWalkMeters: 0, maxTransferWalkMeters: 300, maxTotalWalkMeters: 100, maxTransfers: 2 });
  assert.ok(!overBudget.transferRoutes.some(j => j.legs.some(l => l.kind === 'ride' && l.tripId === 'r1') && j.legs.some(l => l.kind === 'ride' && l.tripId === 'r2')));
});

test('filters vehicles before candidate limits and allows more than five distinct direct trips', () => {
  const ids = Array.from({ length: 5 }, (_, i) => `candidate-${i}`);
  const candidateRoutes = [...ids, 'candidate-six'].map(id => ({ id, num: id, vehicle: id === 'candidate-six' ? 'Box' : 'Bus' }));
  const candidates = { ...network, routes: candidateRoutes, trips: [
    ...ids.map(id => trip(id, [['a',1],['b',2]])), trip('candidate-six', [['a',1],['d',2]])
  ] };
  const all = planJourney(near('a'), near('d'), candidates);
  assert.equal(all.directRoutes.length, 1);
  assert.equal(all.directRoutes[0].legs.find(leg => leg.kind === 'ride').route.id, 'candidate-six', 'the only valid connection is the sixth boarding candidate');
  const filtered = planJourney(near('a'), near('d'), candidates, { vehicle: 'Microbus' });
  assert.equal(filtered.status, 'ok');
  assert.equal(filtered.directRoutes.length, 1);
  assert.equal(filtered.directRoutes[0].legs.find(leg => leg.kind === 'ride').route.vehicle, 'Box');
});

test('keeps repeated stop occurrences distinct and never exceeds three rides', () => {
  const repeatedTrip = { ...trip('repeat', [['a',1],['b',2],['a',3],['d',4]]), calls: [
    { stopId: 'a', sequence: 1, canBoard: true, canAlight: true, distanceMeters: 0 },
    { stopId: 'b', sequence: 2, canBoard: true, canAlight: true, distanceMeters: 1000 },
    { stopId: 'a', sequence: 3, canBoard: true, canAlight: true, distanceMeters: 2000 },
    { stopId: 'd', sequence: 4, canBoard: true, canAlight: true, distanceMeters: 3000 }
  ] };
  const repeatedNetwork = { ...network, routes: [{ id: 'repeat', vehicle: 'Bus' }], trips: [repeatedTrip] };
  const repeated = planJourney(near('a'), near('d'), repeatedNetwork, { maxWalkMeters: 0 });
  const sequencePairs = repeated.directRoutes.map(j => j.legs.find(l => l.kind === 'ride')).map(l => `${l.fromSequence}-${l.toSequence}`);
  assert.ok(sequencePairs.includes('1-4') && sequencePairs.includes('3-4'));
  assert.ok([...repeated.directRoutes, ...repeated.transferRoutes].every(j => {
    const rides = j.legs.filter(l => l.kind === 'ride');
    return rides.every((ride, index) => index === 0 || rides[index - 1].tripId !== ride.tripId || ride.fromSequence < rides[index - 1].toSequence);
  }), 'forward continuation on one source trip cannot be presented as a transfer');

  const chainStops = [0,1,2,3,4].map(i => stop(`chain-${i}`, 30 + i * .01, 31));
  const chainRoutes = [0,1,2,3].map(i => ({ id: `chain-route-${i}`, vehicle: ['Bus','Metro','Minibus','Box'][i] }));
  const chainTrips = chainRoutes.map((route, i) => ({ id: route.id, appRouteId: route.id, calls: [
    { stopId: `chain-${i}`, sequence: 1, canBoard: true, canAlight: true, distanceMeters: 0 },
    { stopId: `chain-${i+1}`, sequence: 2, canBoard: true, canAlight: true, distanceMeters: 1000 }
  ] }));
  const fourVehicles = { stops: chainStops, routes: chainRoutes, trips: chainTrips };
  const bounded = planJourney([30,31], [30.04,31], fourVehicles, { maxWalkMeters: 0, maxTransferWalkMeters: 0, maxTotalWalkMeters: 0, maxTransfers: 3 });
  assert.equal(bounded.directRoutes.length + bounded.transferRoutes.length, 0, 'four distinct vehicle trips cannot fit the clamped two-transfer limit');
});

test('suppresses same-trip reboarding in the shipped Attaba to Roxy metro result', () => {
  const result = planJourney([30.0524,31.2471], [30.0936,31.3144], shippedNetwork, { vehicle: 'Metro', maxTransfers: 2 });
  const journeys = [...result.directRoutes, ...result.transferRoutes];
  assert.ok(journeys.some(j => {
    const rides = j.legs.filter(l => l.kind === 'ride');
    return rides.length === 2 && rides[0].route.num === 'M2' && rides[1].route.num === 'M1';
  }), 'a legitimate M2 to M1 transfer remains available');
  assert.ok(journeys.every(j => {
    const ids = j.legs.filter(l => l.kind === 'ride').map(l => l.tripId);
    return new Set(ids).size === ids.length;
  }), 'the same L1 source trip must not be presented as two rides');
});

test('allows a transfer between distinct trips on the same route', () => {
  const sameRouteNetwork = { stops, routes: [{ id: 'same-line', vehicle: 'Bus' }], trips: [
    { ...trip('run-1', [['a',1],['b',2]]), appRouteId: 'same-line' },
    { ...trip('run-2', [['b',1],['d',2]]), appRouteId: 'same-line' }
  ] };
  const result = planJourney(near('a'), near('d'), sameRouteNetwork, { maxWalkMeters: 0, maxTransferWalkMeters: 0, maxTotalWalkMeters: 0 });
  assert.ok(result.transferRoutes.some(j => {
    const rides = j.legs.filter(l => l.kind === 'ride');
    return rides.length === 2 && rides[0].tripId === 'run-1' && rides[1].tripId === 'run-2' && rides[0].route.id === rides[1].route.id;
  }), 'different source trips remain transferable even when they share a route');
});

test('rejects malformed trip order and never bridges missing calls', () => {
  const bad = { ...network, routes: [{ id: 'bad', vehicle: 'Bus' }], trips: [trip('bad', [['a',2],['d',1]])] };
  const result = planJourney(near('a'), near('d'), bad);
  assert.equal(result.status, 'no-service');
  assert.equal(createRoutingIndex(bad).rejectedTrips[0].reason, 'non-increasing-sequence');
  const missing = { ...network, routes: [{ id: 'missing', vehicle: 'Bus' }], trips: [trip('missing', [['a',1],['missing-stop',2],['d',3]])] };
  const missingResult = planJourney(near('a'), near('d'), missing);
  assert.equal(missingResult.status, 'no-service');
  assert.equal(createRoutingIndex(missing).rejectedTrips[0].reason, 'unknown-stop');
});

test('network load failures can retry', async () => {
  const loader = load('src/utils/dataLoader.js');
  let networkCalls = 0;
  let calls = 0;
  global.fetch = async url => {
    calls++;
    if (url === '/data/bt_catalogue.v1.json' || url === '/data/brt_catalogue.v1.json') return { ok: true, json: async () => shippedBrtCatalogue };
    networkCalls++;
    return networkCalls === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => network };
  };
  await assert.rejects(loader.loadRoutingNetwork());
  assert.equal((await loader.loadRoutingNetwork()).version, '1+brt1');
  assert.equal(networkCalls, 2);
  assert.equal(calls, 3);
});
