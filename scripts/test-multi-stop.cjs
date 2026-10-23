const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');

function load(entry, jsx = false, externals = []) {
  const result = buildSync({
    entryPoints: [path.resolve(__dirname, '..', entry)],
    bundle: true, platform: 'node', format: 'cjs', write: false,
    loader: jsx ? { '.jsx': 'jsx' } : {}, external: externals
  });
  const filename = path.join(__dirname, `${path.basename(entry)}-test.cjs`);
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
}

async function main() {
  const helpers = load('src/utils/multiStopPlanner.js');
  const point = (id, coord) => ({ id, coord, label: id });
  const legs = helpers.buildMultiStopLegs([
    point('a', [30, 31]), point('b', [30.1, 31.1]), point('c', [30.2, 31.2])
  ]);
  assert.equal(legs.length, 2);
  assert.deepEqual(legs.map(leg => [leg.from.id, leg.to.id]), [['a', 'b'], ['b', 'c']]);

  const incomplete = helpers.buildMultiStopLegs([point('a', [30, 31]), point('b', null), point('c', [30.2, 31.2])]);
  assert.deepEqual(incomplete.map(leg => leg.status), ['incomplete', 'incomplete']);
  assert.equal(helpers.buildMultiStopLegs([point('a', [30, 31]), point('b', [30, 31])])[0].status, 'same-point');

  const ride = (id, vehicle, fromSequence = 1) => ({ kind: 'ride', tripId: id, fromSequence, toSequence: fromSequence + 1, route: { id, vehicle } });
  const journey = (id, rides) => ({ id, type: rides.length > 1 ? 'transfer' : 'direct', transfers: rides.length - 1,
    legs: rides.flatMap((item, index) => [
      { kind: 'walk', purpose: index === 0 ? 'access' : 'transfer', distanceMeters: 0, durationMinutes: 0 }, item
    ]).concat([{ kind: 'walk', purpose: 'egress', distanceMeters: 0, durationMinutes: 0 }]) });
  const direct = { directRoutes: [journey('d:1-2', [ride('d', 'Microbus')])], transferRoutes: [] };
  const genericTransferJourney = journey('a:1-2|b:1-2', [ride('a', 'Box'), ride('b', 'Tomnaya')]);
  const transfer = { directRoutes: [], transferRoutes: [genericTransferJourney] };
  assert.equal(helpers.filterMultiStopPlan(direct, 'Microbus').directRoutes.length, 1);
  assert.equal(helpers.filterMultiStopPlan(transfer, 'Microbus').transferRoutes.length, 1);
  const mixedTransfer = { directRoutes: [], transferRoutes: [{
    ...genericTransferJourney, legs: [...genericTransferJourney.legs.slice(0, -2), ride('c', 'Bus'), genericTransferJourney.legs.at(-1)]
  }] };
  assert.equal(helpers.filterMultiStopPlan(mixedTransfer, 'Microbus').transferRoutes.length, 0,
    'a transfer survives only when both routes match');
  const reverse = helpers.buildMultiStopLegs([point('b', [30.1, 31.1]), point('a', [30, 31])])[0];
  assert.notEqual(legs[0].key, reverse.key, 'reverse direction must have its own cache key');
  assert.notEqual(helpers.journeyOptionKey(genericTransferJourney), helpers.journeyOptionKey(journey('a:3-4|b:1-2', [ride('a', 'Box', 3), ride('b', 'Tomnaya')])), 'boarding call occurrences belong to journey identity');
  assert.notEqual(helpers.buildMultiStopLegs([point('a', [30, 31]), point('b', [30.1, 31.1])], { vehicle: 'Bus' })[0].key,
    helpers.buildMultiStopLegs([point('a', [30, 31]), point('b', [30.1, 31.1])], { vehicle: 'Metro' })[0].key, 'search options separate cache entries');

  let callCount = 0;
  const cache = new Map();
  const compute = async () => { callCount += 1; return { directRoutes: [], transferRoutes: [] }; };
  await helpers.runMultiStopPlans(legs, {}, { compute, cache, onResult: () => {} });
  await helpers.runMultiStopPlans(legs, {}, { compute, cache, onResult: () => {} });
  assert.equal(callCount, 2, 'successful pair plans should be cached');
  const emptyOutcomes = [];
  await helpers.runMultiStopPlans([legs[0]], {}, { compute: async () => null, cache: new Map(), onResult: item => emptyOutcomes.push(item) });
  assert.equal(emptyOutcomes[0].status, 'ready', 'a successful empty plan is ready');

  let cancelled = false;
  let resolveFirst;
  let scheduled = 0;
  const published = [];
  const pending = helpers.runMultiStopPlans(legs, {}, {
    compute: () => { scheduled += 1; return new Promise(resolve => { resolveFirst = resolve; }); },
    cache: new Map(), isCancelled: () => cancelled, onResult: value => published.push(value)
  });
  await Promise.resolve();
  cancelled = true;
  resolveFirst({ directRoutes: [], transferRoutes: [] });
  await pending;
  assert.equal(scheduled, 1, 'cancelled run must not schedule later legs');
  assert.equal(published.length, 0, 'cancelled result must not publish');

  const outcomes = [];
  let attempts = 0;
  await helpers.runMultiStopPlans(legs, {}, {
    compute: async () => { attempts += 1; if (attempts === 1) throw new Error('leg failed'); return { directRoutes: [], transferRoutes: [] }; },
    cache: new Map(), onResult: item => outcomes.push(item)
  });
  assert.deepEqual(outcomes.map(item => item.status), ['error', 'ready']);

  const panel = load('src/components/MultiStopPlanner.jsx', true, ['react', 'react-dom/server']);
  const { I18N } = load('src/utils/i18n.js');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const renderPanel = (lang, props) => renderToStaticMarkup(React.createElement(panel.MultiStopPlanner, { ...props, lang, t: I18N[lang] }));
  const blank = renderPanel('en', { points: [{ id: 'a', label: '', coord: null }, { id: 'b', label: '', coord: null }] });
  assert.equal((blank.match(/class="multi-stop-point /g) || []).length, 2, 'two empty stop rows render');
  assert.ok(blank.includes('Multi-stop'));
  assert.ok(!/undefined|NaN/.test(blank));

  const points = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, label: `Place ${i + 1}`, coord: [30 + i / 100, 31] }));
  const fixtureLeg = (i, status, plan = null) => ({ key: `k${i}`, from: points[i], to: points[i + 1], status, plan, error: status === 'error' ? 'failed' : null });
  const rideLeg = (id, num, vehicle, from, to, fromSequence = 1) => ({ kind: 'ride', tripId: id, fromSequence, toSequence: fromSequence + 1,
    route: { id, num, vehicle }, fromStop: { nameEn: from, nameAr: from }, toStop: { nameEn: to, nameAr: to },
    fromCoord: [30,31], toCoord: [30.01,31], distanceMeters: 1100, durationMinutes: 3.3, path: [[30,31],[30.01,31]], source: 'test' });
  const walkLeg = purpose => ({ kind: 'walk', purpose, fromCoord: [30,31], toCoord: [30,31], distanceMeters: 0, durationMinutes: 0, verification: 'estimated' });
  const directJourney = { id: 'r1:1-2', type: 'direct', transfers: 0, totalTimeMinutes: 35, totalWalkMeters: 240,
    legs: [walkLeg('access'), rideLeg('r1','42','Bus','Attaba','Tagamoa'), walkLeg('egress')] };
  const transferJourney = { id: 'r2:1-2|r3:1-2', type: 'transfer', transfers: 1, totalTimeMinutes: 50, totalWalkMeters: 500,
    legs: [walkLeg('access'), rideLeg('r2','7','Bus','Attaba','Ramses'), walkLeg('transfer'), rideLeg('r3','9','Minibus','Ramses','Dokki'), walkLeg('egress')] };
  const fixtures = [fixtureLeg(0, 'ready', { directRoutes: [directJourney], transferRoutes: [] }),
    fixtureLeg(1, 'ready', { directRoutes: [], transferRoutes: [transferJourney] }), fixtureLeg(2, 'incomplete'),
    fixtureLeg(3, 'error'), fixtureLeg(4, 'ready', { directRoutes: [], transferRoutes: [] })];
  const maxMarkup = renderPanel('en', { points, legs: fixtures });
  assert.equal((maxMarkup.match(/class="multi-stop-point /g) || []).length, 6);
  assert.equal((maxMarkup.match(/class="multi-stop-leg(?:\s|\")/g) || []).length, 5, 'every pair state renders independently');
  assert.ok(maxMarkup.includes('Attaba') && maxMarkup.includes('Ramses'));
  assert.ok(maxMarkup.includes('Approx.') && maxMarkup.includes('historical') && maxMarkup.includes('transfers'));
  assert.ok(maxMarkup.includes('Choose a place') && maxMarkup.includes('Could not calculate') && maxMarkup.includes(I18N.en.noTripsFound));
  assert.ok(maxMarkup.includes('disabled=""') && !/undefined|NaN/.test(maxMarkup));
  const arMarkup = renderPanel('ar', { points, legs: fixtures });
  assert.ok(arMarkup.includes('عدة وجهات') && arMarkup.includes('اختر مكاناً'));
  assert.ok(!/undefined|NaN/.test(arMarkup));
  assert.ok(I18N.ar.tabMultiStop && I18N.en.tabMultiStop);
  const manyOptions = {
    directRoutes: Array.from({ length: 5 }, (_, i) => ({ ...directJourney, id: `direct-${i}` })),
    transferRoutes: Array.from({ length: 5 }, (_, i) => ({ ...transferJourney, id: `transfer-${i}` }))
  };
  const grouped = renderPanel('en', { points: points.slice(0, 2), legs: [fixtureLeg(0, 'ready', manyOptions)] });
  assert.equal((grouped.match(/class="multi-stop-option /g) || []).length, 10, 'all multi-stop option IDs remain rendered');
  assert.equal((grouped.match(/<details class="journey-more-options"/g) || []).length, 2, 'direct and transfer groups disclose remaining results separately');
  assert.ok(!/<details[^>]*\sopen(?:=|\s|>)/.test(grouped), 'remaining results start collapsed');
  assert.ok(grouped.includes(I18N.en.directFoundTitle(5)) && grouped.includes(I18N.en.transfersFoundTitle(5)));
  for (let index = 0; index < 5; index++) assert.ok(grouped.includes(`data-journey-id="direct-${index}"`), 'all original direct option IDs remain available');
  for (let index = 0; index < 5; index++) assert.ok(grouped.includes(`data-journey-id="transfer-${index}"`), 'all original transfer option IDs remain available');
  assert.equal(grouped.split(I18N.en.journeyWalkNotice).length - 1, 1, 'walking notice appears once for this stop pair');
  assert.equal(grouped.split(I18N.en.journeyServiceNotice).length - 1, 1, 'service notice appears once for this stop pair');
  console.log('Multi-stop planner helpers and render checks passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
