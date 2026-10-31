const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const Module = require('node:module');

const root = path.resolve(__dirname, '../..');
const sourceRoot = process.env.BENCH_SOURCE_DIR ? path.resolve(process.env.BENCH_SOURCE_DIR) : root;
function load(entry) {
  const result = buildSync({ entryPoints: [path.join(sourceRoot, entry)], bundle: true, platform: 'node', format: 'cjs', write: false });
  const filename = path.join(__dirname, `${path.basename(entry)}-benchmark.cjs`);
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
}

const dataPath = url => path.join(root, 'public', url.replace(/^\//, ''));
global.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(dataPath(url), 'utf8')) });
const { loadRoutingNetwork, loadGeometries } = load('src/utils/dataLoader.js');
const { planJourney } = load('src/utils/tripPlanner.js');

const scenarios = [
  { name: 'direct_metro_helwan_sadat', origin: [29.84921, 31.33443], destination: [30.04401, 31.2357], options: { vehicle: 'Metro' } },
  { name: 'transfer_metro_attaba_roxy', origin: [30.0524, 31.2471], destination: [30.0936, 31.3144], options: { vehicle: 'Metro' } },
  { name: 'direct_bus_1078_full_network', origin: [30.0662451, 31.4501627], destination: [29.973723, 31.24716], options: { vehicle: 'Bus' } },
  { name: 'urban_all_attaba_roxy', origin: [30.0524, 31.2471], destination: [30.0936, 31.3144], options: {} },
  { name: 'direct_bus_1078_geometry', origin: [30.0662451, 31.4501627], destination: [29.973723, 31.24716],
    tripIds: ['CTA_1078_O'], options: { vehicle: 'Bus' } },
  { name: 'near_network_no_service', origin: [30.0524, 31.2471], destination: [30.0936, 31.3144], options: { vehicle: 'NoMatchingVehicle' } },
  { name: 'no_service_remote', origin: [30.60, 31.70], destination: [30.61, 31.71], options: { vehicle: 'ALL' } }
];

function signature(plan) {
  const simplify = journey => ({ id: journey.id, rank: journey.rankingMinutes, totalTimeMinutes: journey.totalTimeMinutes,
    totalWalkMeters: journey.totalWalkMeters, totalRideKm: journey.totalRideKm,
    legs: journey.legs.map(leg => ({ kind: leg.kind, tripId: leg.tripId || null, fromSequence: leg.fromSequence ?? null,
      toSequence: leg.toSequence ?? null, flexibleDrop: Boolean(leg.flexibleDrop), distanceMeters: leg.distanceMeters,
      fromCoord: leg.fromCoord, toCoord: leg.toCoord })) });
  return { status: plan.status, directRoutes: plan.directRoutes.map(simplify), transferRoutes: plan.transferRoutes.map(simplify) };
}

async function main() {
  const ioStart = process.hrtime.bigint();
  const network = await loadRoutingNetwork();
  const networkMs = Number(process.hrtime.bigint() - ioStart) / 1e6;
  const geometryStart = process.hrtime.bigint();
  const geometries = await loadGeometries();
  const geometryMs = Number(process.hrtime.bigint() - geometryStart) / 1e6;
  const counts = {
    routes: network.routes.length, trips: network.trips.length, stops: network.stops.length,
    geometries: Object.keys(geometries).filter(key => key !== 'brtUnavailable').length,
    geometryPoints: Object.values(geometries).filter(Array.isArray).reduce((sum, line) => sum + line.length, 0),
    brtRoutes: network.routes.filter(route => route.vehicle === 'BRT').length,
    brtTrips: network.trips.filter(trip => trip.source === 'community-reference-estimated').length,
    brtGeometryPoints: Object.entries(geometries).filter(([id]) => id.startsWith('brt_')).reduce((sum, [, line]) => sum + line.length, 0),
    brtUnavailable: Boolean(network.metadata?.brtUnavailable || geometries.brtUnavailable)
  };
  const runs = [];
  const selectedCases = process.env.BENCH_CASES?.split(',').map(name => name.trim()).filter(Boolean);
  for (const scenario of scenarios.filter(item => process.env.BENCH_SKIP_SYNC !== '1' && (!process.env.BENCH_CASE || item.name === process.env.BENCH_CASE) &&
    (!selectedCases || selectedCases.includes(item.name)))) {
    const times = [];
    let lastPlan;
    const repeats = Math.max(1, Number(process.env.BENCH_REPEATS || 4));
    for (let run = 0; run < repeats; run++) {
      const start = process.hrtime.bigint();
      const searchNetwork = scenario.tripIds ? { ...network, trips: network.trips.filter(trip => scenario.tripIds.includes(trip.id)) } : network;
      lastPlan = planJourney(scenario.origin, scenario.destination, searchNetwork, { maxWalkMeters: 1200, maxTransferWalkMeters: 600,
        maxTotalWalkMeters: 3600, maxTransfers: 2, geometries, ...scenario.options });
      times.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    runs.push({ name: scenario.name, origin: scenario.origin, destination: scenario.destination, options: scenario.options,
      scopedTrips: scenario.tripIds || null,
      coldMs: times[0], warmMs: times.slice(1), medianWarmMs: times.length > 1 ? [...times.slice(1)].sort((a,b) => a-b)[Math.floor((times.length - 1) / 2)] : null,
      scannedCalls: lastPlan.metadata?.scannedCalls ?? 0, expandedLabels: lastPlan.metadata?.expandedLabels ?? 0,
      flexibleProjectionSkips: lastPlan.metadata?.flexibleProjectionSkips ?? 0,
      eligibleTrips: lastPlan.metadata?.eligibleTrips ?? 0, signature: signature(lastPlan) });
  }
  const report = { label: process.env.BENCH_LABEL || 'unlabeled', createdAt: new Date().toISOString(), runtime: process.version,
    loadMs: { routingNetwork: networkMs, decodedGeometries: geometryMs }, dataset: counts, runs };
  if (process.env.BENCH_PROGRESS === '1') {
    const { computePlan } = load('src/utils/transitWorkerClient.js');
    const scenario = scenarios.find(item => item.name === (process.env.BENCH_CASE || 'urban_all_attaba_roxy'));
    const data = { routes: network.routes, stops: network.stops, geometries, routingNetwork: network };
    const progressOptions = { maxTransferWalkMeters: 600, maxTotalWalkMeters: 3600, maxTransfers: 2, ...scenario.options };
    let firstDirectMs = null;
    const start = process.hrtime.bigint();
    const progressive = await computePlan(scenario.origin, scenario.destination, data, 1200, { ...progressOptions,
      onProgress: update => { if (firstDirectMs === null && update.phase === 'direct') firstDirectMs = Number(process.hrtime.bigint() - start) / 1e6; } });
    const finalMs = Number(process.hrtime.bigint() - start) / 1e6;
    const cacheStart = process.hrtime.bigint();
    await computePlan(scenario.origin, scenario.destination, data, 1200, progressOptions);
    const cachedMs = Number(process.hrtime.bigint() - cacheStart) / 1e6;
    report.progressive = { case: scenario.name, timeToFirstDirectMs: firstDirectMs, finalMs, sameQueryCacheMs: cachedMs,
      signature: signature(progressive) };
  }
  const target = process.argv[2] || path.join(__dirname, `${report.label}.json`);
  fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
