const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');

function load(entry) {
  const result = buildSync({ entryPoints: [path.resolve(__dirname, '..', entry)], bundle: true,
    platform: 'node', format: 'cjs', write: false });
  const filename = path.join(__dirname, `${path.basename(entry)}-performance-test.cjs`);
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
}

const { getJourneyGeometryContext, geometryMayBeWithinMeters } = load('src/utils/journey.js');
const line = [[30, 31], [30.01, 31.01], [30.02, 31.02]];
assert.ok(getJourneyGeometryContext, 'journey exports its cached geometry context');
assert.strictEqual(getJourneyGeometryContext(line), getJourneyGeometryContext(line), 'same immutable coordinate array reuses geometry work');
assert.notStrictEqual(getJourneyGeometryContext(line), getJourneyGeometryContext(line.map(point => [...point])),
  'a replacement coordinate array receives its own context');
console.log('PASS geometry context is reused by coordinate-array identity and isolated after replacement');
assert.equal(geometryMayBeWithinMeters(line, [30.005, 31.005], 10), true, 'an interior line point remains eligible');
assert.equal(geometryMayBeWithinMeters(line, [31, 32], 1200), false, 'a distant route bounding box safely skips flexible drop projection');
assert.equal(geometryMayBeWithinMeters([[80, -60], [80, 60]], [84, 0], 1200), true,
  'long geodesic segments disable the bound rejection to avoid excluding curved geometry');
assert.equal(geometryMayBeWithinMeters([[30, 31], [30, 31.08]], [30.000006045997576, 31.04], 0), true,
  'the curved geodesic between short segment vertices remains inside the conservative envelope');
console.log('PASS geometry bounds reject only routes outside the requested walk radius');

const { planJourney, planJourneyProgressive } = load('src/utils/tripPlanner.js');
const route = { id: 'r', route_id: 'r', vehicle: 'Bus' };
const network = { version: 'test', routes: [route], stops: [
  { id: 'a', lat: 30, lng: 31 }, { id: 'b', lat: 30.01, lng: 31 }
], trips: [{ id: 't', appRouteId: 'r', route, calls: [
  { stopId: 'a', sequence: 1, canBoard: true, canAlight: true, distanceMeters: 0 },
  { stopId: 'b', sequence: 2, canBoard: true, canAlight: true, distanceMeters: 1100 }
] }] };

(async () => {
  const phases = [];
  const result = await planJourneyProgressive([30, 31], [30.01, 31], network, { maxWalkMeters: 0 }, {
    onProgress: update => phases.push(update.phase)
  });
  assert.equal(phases[0], 'direct', 'direct alternatives are published before the final search result');
  assert.ok(result.directRoutes.length, 'the final Promise still resolves to the complete plan');
  assert.deepEqual(result, planJourney([30, 31], [30.01, 31], network, { maxWalkMeters: 0 }),
    'the progressive runner produces the same final plan as the synchronous compatibility API');
  const controller = new AbortController();
  await assert.rejects(planJourneyProgressive([30, 31], [30.01, 31], network, { maxWalkMeters: 0 }, {
    signal: controller.signal, onProgress: () => controller.abort()
  }), error => error.name === 'AbortError', 'cancelled progressive searches reject as cancellation');
  const { computePlan } = load('src/utils/transitWorkerClient.js');
  const data = { routes: [route], geometries: {}, stops: network.stops, routingNetwork: network };
  const clientPhases = [];
  const clientResult = await computePlan([30, 31], [30.01, 31], data, 0, { onProgress: update => clientPhases.push(update.phase) });
  assert.ok(clientResult.directRoutes.length);
  assert.deepEqual(clientPhases, ['direct', 'final'], 'client forwards progressive and final results');
  clientResult.directRoutes[0].legs.find(leg => leg.kind === 'ride').distanceMeters = -1;
  const cachePhases = [];
  const cachedResult = await computePlan([30, 31], [30.01, 31], data, 0, { onProgress: update => cachePhases.push(update.phase) });
  assert.deepEqual(cachePhases, ['final'], 'a final-result cache hit still publishes a final progress phase');
  assert.ok(cachedResult.directRoutes[0].legs.find(leg => leg.kind === 'ride').distanceMeters > 0,
    'mutating one consumer result cannot corrupt the cached plan');
  const vehicleFiltered = await computePlan([30, 31], [30.01, 31], data, 0, { vehicle: 'Metro' });
  assert.equal(vehicleFiltered.status, 'no-service', 'vehicle settings participate in the result cache key');
  network.version = 'test-v2';
  network.trips = [{ ...network.trips[0], id: 't-v2' }];
  const versionPhases = [];
  const versionResult = await computePlan([30, 31], [30.01, 31], data, 0, { onProgress: update => versionPhases.push(update.phase) });
  assert.equal(versionResult.directRoutes[0].legs.find(leg => leg.kind === 'ride').tripId, 't-v2',
    'a routing-network version change invalidates a cached plan even when the network object is reused');
  assert.deepEqual(versionPhases, ['direct', 'final']);
  const cancelledNetwork = { ...network, version: 'cancelled-test' };
  const cancelledData = { routes: [route], geometries: {}, stops: network.stops, routingNetwork: cancelledNetwork };
  const clientController = new AbortController();
  await assert.rejects(computePlan([30, 31], [30.01, 31], cancelledData, 0, {
    signal: clientController.signal, onProgress: update => { if (update.phase === 'direct') clientController.abort(); }
  }), error => error.name === 'AbortError', 'client cancellation does not fall back and rerun on the main thread');
  const previousWorker = global.Worker;
  const previousUrl = global.URL;
  const fetchBefore = global.fetch;
  class FakeWorker {
    static instances = [];
    static mode = 'auto';
    constructor(url, options) { this.url = url; this.options = options; this.terminated = 0; FakeWorker.instances.push(this); }
    postMessage(message) {
      this.message = structuredClone(message);
      if (FakeWorker.mode === 'auto') setTimeout(() => this.complete(), 5);
      else if (FakeWorker.mode === 'delayed') setTimeout(() => this.complete(), 30);
      else if (FakeWorker.mode === 'late-subscriber') {
        setTimeout(() => this.publishDirect(), 2);
        setTimeout(() => this.finish(), 30);
      }
      else if (FakeWorker.mode === 'error') setTimeout(() => this.onerror?.({ message: 'fixture worker error' }), 0);
    }
    result() { return planJourney(this.message.payload.originCoord, this.message.payload.destCoord,
        network, { maxWalkMeters: this.message.payload.maxWalk ?? 1200, ...(this.message.payload.options || {}) });
    }
    publishDirect() { this.onmessage?.({ data: { id: this.message.id, phase: 'progress', progress: { phase: 'direct', plan: this.result() } } }); }
    finish() { this.onmessage?.({ data: { id: this.message.id, ok: true, result: this.result() } }); }
    complete() {
      this.publishDirect();
      this.finish();
    }
    emit(message) { this.onmessage?.({ data: message }); }
    terminate() { this.terminated++; }
  }
  global.Worker = FakeWorker;
  global.URL = function FakeUrl(value) { return { value }; };
  try {
    const workerData = { routes: [route], geometries: {}, stops: network.stops, routingNetwork: network };
    const workerController = new AbortController();
    const workerPhases = [];
    const workerResult = await computePlan([30, 31], [30.01, 31], workerData, 0, {
      signal: workerController.signal, onProgress: update => workerPhases.push(update.phase), vehicle: 'Bus'
    });
    assert.ok(workerResult.directRoutes.length);
    assert.deepEqual(workerPhases, ['direct', 'final']);
    const pooled = FakeWorker.instances[0];
    assert.equal(pooled.message.payload.options.signal, undefined);
    assert.equal(pooled.message.payload.options.onProgress, undefined);
    const oldId = pooled.message.id;
    FakeWorker.mode = 'manual';
    let secondSettled = false;
    const secondPromise = computePlan([30, 31], [30.011, 31], workerData, 1200).then(result => { secondSettled = true; return result; });
    assert.equal(FakeWorker.instances.length, 1, 'a successful planner worker remains pooled for the same dataset');
    const secondId = pooled.message.id;
    assert.notEqual(secondId, oldId);
    pooled.emit({ id: oldId, ok: true, result: clientResult });
    await Promise.resolve();
    assert.equal(secondSettled, false, 'a stale worker message cannot settle a newer search');
    pooled.complete();
    assert.ok((await secondPromise).directRoutes.length);

    FakeWorker.mode = 'late-subscriber';
    const sharedData = { routes: [route], geometries: {}, stops: network.stops, routingNetwork: { ...network, version: 'shared' } };
    const firstSubscriber = new AbortController();
    const sharedSecond = new AbortController();
    const firstWaiter = computePlan([30, 31], [30.01, 31], sharedData, 0, { signal: firstSubscriber.signal });
    await new Promise(resolve => setTimeout(resolve, 5));
    const latePhases = [];
    const secondWaiter = computePlan([30, 31], [30.01, 31], sharedData, 0, {
      signal: sharedSecond.signal, onProgress: update => latePhases.push(update.phase)
    });
    secondWaiter.then(() => latePhases.push('settled'));
    assert.equal(FakeWorker.instances.length, 2, 'identical in-flight plans share one worker task');
    firstSubscriber.abort();
    await assert.rejects(firstWaiter, error => error.name === 'AbortError');
    assert.equal(FakeWorker.instances[1].terminated, 0, 'one subscriber cancellation leaves shared work alive');
    assert.ok((await secondWaiter).directRoutes.length);
    assert.deepEqual(latePhases, ['direct', 'final', 'settled'], 'late in-flight subscribers receive the current direct phase and final result');

    FakeWorker.mode = 'manual';
    const canceledData = { routes: [route], geometries: {}, stops: network.stops };
    let fetchCount = 0;
    global.fetch = async () => { fetchCount++; throw new Error('fallback should not start after cancellation'); };
    const lastController = new AbortController();
    const canceledPromise = computePlan([30, 31], [30.01, 31], canceledData, 0, { signal: lastController.signal });
    const cancellableWorker = FakeWorker.instances.at(-1);
    lastController.abort();
    await assert.rejects(canceledPromise, error => error.name === 'AbortError');
    assert.equal(cancellableWorker.terminated, 1);
    assert.equal(fetchCount, 0, 'aborting the last subscriber terminates its worker without main-thread fallback');

    FakeWorker.mode = 'error';
    const fallbackData = { routes: [route], geometries: {}, stops: network.stops, routingNetwork: { ...network, version: 'worker-fallback' } };
    const fallbackResult = await computePlan([30, 31], [30.01, 31], fallbackData, 0);
    assert.ok(fallbackResult.directRoutes.length, 'unexpected worker errors retain the existing main-thread fallback');
  } finally {
    global.Worker = previousWorker;
    global.URL = previousUrl;
    global.fetch = fetchBefore;
  }
  console.log('PASS progressive plans publish direct routes, retain final Promise results, and cancel cooperatively');
})().catch(error => { console.error(error); process.exitCode = 1; });
