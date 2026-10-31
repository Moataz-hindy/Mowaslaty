const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');

function load(entry) {
  const result = buildSync({ entryPoints: [path.resolve(__dirname, '..', entry)], bundle: true,
    platform: 'node', format: 'cjs', write: false });
  const filename = path.join(__dirname, `${path.basename(entry)}-brt-test.cjs`);
  const compiled = new Module(filename, module); compiled.filename = filename; compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, filename); return compiled.exports;
}

const { composeBrtRuntime } = load('src/utils/brtData.js');
const { planJourney } = load('src/utils/tripPlanner.js');
const { matchesVehicle } = load('src/utils/journey.js');
const { findNearestDropPoints, calculateRouteDropPoint } = load('src/utils/geoUtils.js');
const { matchRouteStops, buildTrack } = load('src/utils/tripTracker.js');
const realCatalogue = require('../public/data/brt_catalogue.v1.json');
function test(name, fn) { try { fn(); console.log(`PASS ${name}`); } catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1; } }

const stops = [
  { id: 'a', nameEn: 'Agriculture', nameAr: 'الزراعي', lat: 30, lng: 31, status: 'active-corridor-candidate', distanceMeters: 0 },
  { id: 'b', nameEn: 'Golf', nameAr: 'الجولف', lat: 30.01, lng: 31, status: 'active-corridor-candidate', distanceMeters: 1000 },
  { id: 'excluded', nameEn: 'Autostrad', nameAr: 'الأوتوستراد', lat: 30.02, lng: 31, status: 'excluded-unconfirmed-opening', distanceMeters: 2000 },
  { id: 'c', nameEn: 'Sun Capital', nameAr: 'صن كابيتال', lat: 30.03, lng: 31, status: 'active-corridor-candidate', distanceMeters: 3000 },
  { id: 'future', nameEn: 'GEM', nameAr: 'المتحف المصري الكبير', lat: 30.04, lng: 31, status: 'future-extension', distanceMeters: 4000 }
];
const catalogue = { version: 1, source: { verification: 'unverified-community-reference', url: 'https://example.test/community' },
  service: { status: 'provisional-reported', startStationId: 'a', endStationId: 'c', boardingMode: 'fixed-station' },
  stations: stops, geometry: { coordinates: [[31,30],[31,30.01],[31,30.02],[31,30.03],[31,30.04]] } };

test('composes two finite directed fixed-station services and excludes unconfirmed/future calls', () => {
  const runtime = composeBrtRuntime(catalogue);
  assert.equal(runtime.routes.length, 2);
  assert.equal(runtime.trips.length, 2);
  assert.equal(runtime.geometries[runtime.routes[0].id].length, 5);
  for (const trip of runtime.trips) {
    const names = trip.calls.map(call => runtime.stops.find(s => s.id === call.stopId).nameEn);
    assert.ok(names.every(name => !['Autostrad', 'GEM'].includes(name)));
    assert.ok(names.length === 3);
    assert.ok(trip.calls.every(call => call.canBoard && call.canAlight && call.distanceEstimated));
    assert.ok(trip.calls.every((call, index) => !index || call.sequence > trip.calls[index - 1].sequence && call.distanceMeters > trip.calls[index - 1].distanceMeters));
  }
  assert.deepEqual(runtime.trips[1].calls.map(c => c.stopId), [...runtime.trips[0].calls].reverse().map(c => c.stopId));
  assert.ok(runtime.routes.every(route => route.vehicle === 'BRT' && route.boardingMode === 'fixed-station' && route.geometryEstimated));
});

test('planner boards and alights only at fixed BRT calls and carries source quality metadata', () => {
  const runtime = composeBrtRuntime(catalogue);
  const network = { version: 1, metadata: {}, ...runtime };
  const journey = planJourney([30,31], [30.03,31], network, { maxWalkMeters: 0, maxTotalWalkMeters: 0, geometries: runtime.geometries });
  const ride = journey.directRoutes.flatMap(j => j.legs).find(l => l.kind === 'ride');
  assert.ok(ride);
  assert.equal(ride.flexibleDrop, false);
  assert.equal(ride.toStop.nameEn, 'Sun Capital');
  assert.equal(ride.distanceEstimated, true);
  assert.equal(ride.geometryEstimated, true);
  assert.equal(ride.servicePatternStatus, 'provisional-reported');
  assert.ok(journey.directRoutes[0].warnings.includes('brt-geometry-estimated'));
  assert.ok(!journey.directRoutes[0].warnings.includes('historical-service-data'));
  const noMidRouteDrop = planJourney([30,31], [30.015,31], network, { maxWalkMeters: 0, maxTotalWalkMeters: 0, geometries: runtime.geometries });
  assert.equal(noMidRouteDrop.directRoutes.length + noMidRouteDrop.transferRoutes.length, 0);
});

test('does not infer BRT interchanges from nearby but unverified station access', () => {
  const runtime = composeBrtRuntime(catalogue);
  const otherStops = [{ id: 'near-metro', nameEn: 'Nearby Metro', nameAr: 'مترو', lat: 30.01, lng: 31.0005, source: 'manual-metro' }];
  const route = { id: 'metro', route_id: 'M1', vehicle: 'Metro', color: '#223344' };
  const network = { version: 2, metadata: {}, routes: [...runtime.routes, route], stops: [...runtime.stops, ...otherStops], trips: [
    ...runtime.trips, { id: 'metro', appRouteId: 'metro', calls: [
      { stopId: 'near-metro', sequence: 1, canBoard: true, canAlight: true, distanceMeters: 0 },
      { stopId: 'a', sequence: 2, canBoard: true, canAlight: true, distanceMeters: 1000 }
    ] }
  ] };
  const result = planJourney([30,31], [30.03,31], network, { maxWalkMeters: 0, maxTransferWalkMeters: 600, maxTotalWalkMeters: 1000 });
  assert.equal(result.transferRoutes.length, 0);
});

test('BRT belongs to its own browse filter and remains separate from ordinary bus filter', () => {
  const { routes } = composeBrtRuntime(catalogue);
  assert.ok(routes.every(route => matchesVehicle(route, 'BRT')));
  assert.ok(routes.every(route => !matchesVehicle(route, 'Bus')));
});

test('nearest and selected-line suggestions use only BRT stations, never an along-route projection', () => {
  const runtime = composeBrtRuntime(catalogue);
  const allStops = runtime.stops.map(stop => ({ ...stop, type: 'brt', name_en: stop.nameEn, name_ar: stop.nameAr }));
  const target = [30.015, 31];
  const nearest = findNearestDropPoints(target, runtime.routes, runtime.geometries, allStops, 5000);
  assert.ok(nearest.length > 0);
  assert.ok(nearest.every(item => item.fixedStation && item.route.vehicle === 'BRT'));
  const selected = calculateRouteDropPoint(target, runtime.routes[0], runtime.geometries[runtime.routes[0].id], allStops);
  assert.ok(selected.fixedStation);
  assert.ok(allStops.some(stop => stop.id === selected.nearestStop.id));
  assert.deepEqual(selected.dropCoord, [allStops.find(stop => stop.id === selected.nearestStop.id).lat,
    allStops.find(stop => stop.id === selected.nearestStop.id).lng]);
});

test('generated catalogue is trimmed to Sun Capital and does not include future extension calls', () => {
  const runtime = composeBrtRuntime(realCatalogue);
  const active = realCatalogue.stations.filter(station => station.status === 'active-corridor-candidate');
  assert.equal(active.length, 27);
  assert.equal(realCatalogue.geometry.trimmedAtStationId, realCatalogue.service.endStationId);
  assert.ok(realCatalogue.geometry.endpointProjectionMeters < 1);
  assert.ok(runtime.trips.every(trip => trip.calls.length === 27));
  assert.ok(runtime.trips.every(trip => trip.calls.every(call => {
    const station = runtime.stops.find(item => item.id === call.stopId);
    return !['زهراء المعادي', 'الاوتوستراد', 'المنصورية', 'زويل', 'المتحف المصري الكبير'].includes(station.nameAr);
  })));
  assert.ok(runtime.trips.every(trip => trip.calls[0].sequence === 1 && trip.calls.at(-1).sequence === 27));
  for (let direction = 0; direction < 2; direction++) {
    const matched = matchRouteStops(runtime.routes[direction], runtime.geometries[runtime.routes[direction].id], runtime.stops);
    assert.equal(matched.length, 27);
    assert.equal(matched[0].stopId, runtime.routes[direction].stopIds[0]);
    assert.equal(matched.at(-1).stopId, runtime.routes[direction].stopIds.at(-1));
    const track = buildTrack(runtime.routes[direction], runtime.geometries[runtime.routes[direction].id], runtime.stops,
      runtime.geometries[runtime.routes[direction].id].at(-1), 'terminal');
    assert.equal(track.stopsAlong.length, 27);
    assert.equal(track.stopsAlong[0].stopId, runtime.routes[direction].stopIds[0]);
  }
  assert.equal(realCatalogue.stations.find(station => station.sourceName === 'محمد نجيب').nameVerification, 'alias-review');
  assert.ok(realCatalogue.stations.find(station => station.sourceName === 'محمد نجيب').aliases.includes('القلج'));
});

test('merging the BRT preserves existing network routes and trips', () => {
  const { mergeBrtNetwork } = load('src/utils/brtData.js');
  const base = { version: 1, routes: [{ id: 'existing', vehicle: 'Metro' }], stops: [], trips: [{ id: 'existing-trip', appRouteId: 'existing' }] };
  const merged = mergeBrtNetwork(base, catalogue);
  assert.ok(merged.routes.some(route => route.id === 'existing'));
  assert.ok(merged.trips.some(trip => trip.id === 'existing-trip'));
  const unavailable = mergeBrtNetwork(base, null);
  assert.equal(unavailable.routes.length, 1);
  assert.equal(unavailable.metadata.brtUnavailable, true);
});
