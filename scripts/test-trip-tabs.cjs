const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(entry, jsx = false, externals = []) {
  const compiledResult = buildSync({ entryPoints: [path.resolve(__dirname, '..', entry)], bundle: true,
    platform: 'node', format: 'cjs', write: false, loader: jsx ? { '.jsx': 'jsx' } : {}, external: externals });
  const filename = path.join(__dirname, `${path.basename(entry)}-test.cjs`);
  const moduleObject = new Module(filename, module); moduleObject.filename = filename; moduleObject.paths = module.paths;
  moduleObject._compile(compiledResult.outputFiles[0].text, filename); return moduleObject.exports;
}

const result = buildSync({
  stdin: {
    contents: `import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import Sidebar from './src/components/Sidebar.jsx';
      import { I18N } from './src/utils/i18n.js';
      const walk = purpose => ({kind:'walk',purpose,distanceMeters:100,durationMinutes:2,fromCoord:[30,31],toCoord:[30,31]});
      const journey = (id, transfer = false) => ({id,transfers:transfer?1:0,totalWalkMeters:100,totalTimeMinutes:25,legs:[walk('access'),
        {kind:'ride',tripId:id,fromSequence:1,toSequence:2,route:{id,num:id,vehicle:'Bus'},fromStop:{nameEn:'A',nameAr:'أ'},toStop:{nameEn:'B',nameAr:'ب'},fromCoord:[30,31],toCoord:[30.01,31],distanceMeters:1000,durationMinutes:3},
        ...(transfer ? [walk('transfer'),{kind:'ride',tripId:id+'b',fromSequence:3,toSequence:4,route:{id:id+'b',num:'M2',vehicle:'Metro'},fromStop:{nameEn:'B',nameAr:'ب'},toStop:{nameEn:'C',nameAr:'ج'},fromCoord:[30.01,31],toCoord:[30.02,31],distanceMeters:1000,durationMinutes:3}] : []),walk('egress')]});
      export function render(activeTab, lang) {
        return renderToStaticMarkup(<Sidebar activeTab={activeTab} lang={lang}
          t={I18N[lang]} routes={[]} filteredRoutes={[]} nearestResults={[]}
          theme="light" plannerSelecting="origin" originCoord={[30,31]} destCoord={[30.1,31]}
          plannedJourneys={{ directRoutes: Array.from({length:5},(_,i)=>journey('d'+i)), transferRoutes: Array.from({length:5},(_,i)=>journey('t'+i,true)) }}
          multiStopProps={{ points: [{id:'a',label:''},{id:'b',label:''}], legs: [] }} />);
      }`,
    resolveDir: path.resolve(__dirname, '..'),
    loader: 'jsx'
  },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['react', 'react-dom/server']
});
const compiled = new Module(path.join(__dirname, 'trip-tabs-render.cjs'), module);
compiled.filename = path.join(__dirname, 'trip-tabs-render.cjs');
compiled.paths = module.paths;
compiled._compile(result.outputFiles[0].text, compiled.filename);
const I18N = load('src/utils/i18n.js').I18N;

for (const lang of ['ar', 'en']) {
  const nearest = compiled.exports.render('nearest', lang);
  assert.ok(!nearest.includes('ride-origin-box'), 'Drop-off tab must not request a boarding point');
  assert.ok(nearest.includes('specific-line-box'), 'Keep specific-line drop-off search');
  const planner = compiled.exports.render('planner', lang);
  assert.equal((planner.match(/class="coord-selector-box/g) || []).length, 2,
    'Journey planning must retain origin and destination');
  assert.ok(planner.includes(lang === 'ar' ? 'خطط رحلتك' : 'Plan your trip'));
  assert.equal((planner.match(/class="journey-card /g) || []).length, 10, 'all planner journey IDs remain rendered');
  assert.equal((planner.match(/<details class="journey-more-options"/g) || []).length, 2, 'direct and transfer groups each disclose remaining results');
  assert.ok(!/<details[^>]*\sopen(?:=|\s|>)/.test(planner), 'remaining results start collapsed');
  assert.ok(planner.includes(I18N[lang].directFoundTitle(5)) && planner.includes(I18N[lang].transfersFoundTitle(5)));
  const directGroupMarkup = planner.slice(planner.indexOf('journey-option-group-direct'), planner.indexOf('<details class="journey-more-options"'));
  assert.equal((directGroupMarkup.match(/class="journey-card /g) || []).length, 3, 'three direct results are initially visible');
  for (let index = 0; index < 5; index++) assert.ok(planner.includes(`data-journey-id="d${index}"`), 'all original direct journey IDs remain available');
  for (let index = 0; index < 5; index++) assert.ok(planner.includes(`data-journey-id="t${index}"`), 'all original transfer journey IDs remain available');
  assert.equal(planner.split(I18N[lang].journeyWalkNotice).length - 1, 1, 'walking notice appears once for the panel');
  assert.equal(planner.split(I18N[lang].journeyServiceNotice).length - 1, 1, 'service notice appears once for the panel');
  assert.ok(nearest.includes(lang === 'ar' ? 'اعرف الخطوط التي تمر بمكانك' : 'Find routes that pass near a place'), 'Nearest tab keeps its location-focused heading');
  const multi = compiled.exports.render('multi', lang);
  assert.ok(multi.includes(lang === 'ar' ? 'عدة وجهات' : 'Multi-stop'));
  assert.ok(multi.includes('multi-stop-tab-container'));
}
const sidebarSource = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/components/Sidebar.jsx'), 'utf8');
const moreMenu = sidebarSource.slice(sidebarSource.indexOf('className="mobile-more-menu"'));
assert.ok(moreMenu.includes("selectTab('multi')"), 'More menu exposes Multi-stop');
assert.ok(moreMenu.indexOf("selectTab('multi')") < moreMenu.indexOf("selectTab('chat')"), 'Multi-stop appears first in More');
assert.ok(sidebarSource.includes('mobile-secondary-mode ${activeTab === \'multi\''), 'Multi-stop is hidden on mobile primary tabs');

const journeySteps = load('src/components/JourneySteps.jsx', true, ['react', 'react-dom/server']);
const i18n = I18N;
const stop = name => ({ name_en: name, name_ar: name });
const ride = (id, vehicle, num, from, to, sequence) => ({ kind: 'ride', tripId: id, fromSequence: sequence, toSequence: sequence + 2,
  route: { id, vehicle, num }, fromStop: stop(from), toStop: stop(to), distanceMeters: 1200, durationMinutes: 3.6,
  fromCoord: [30,31], toCoord: [30.01,31], path: [[30,31],[30.01,31]] });
const walk = purpose => ({ kind: 'walk', purpose, distanceMeters: 100, durationMinutes: 1.25, fromCoord: [30,31], toCoord: [30,31], verification: 'estimated' });
const journey = { id: 'a:1-3|b:4-5|c:6-8', type: 'transfer', transfers: 2, totalWalkMeters: 600, totalTimeMinutes: 42.5,
  legs: [walk('access'), ride('a','Metro','M2','Shubra','Attaba',1), walk('transfer'), ride('b','Bus','M8','Attaba','Ramses',4), walk('transfer'), ride('c','Tomnaya','Tomnaya','Ramses','Dokki',6), walk('egress')] };
for (const lang of ['ar', 'en']) {
  const markup = renderToStaticMarkup(React.createElement(journeySteps.JourneySteps, { journey, lang, t: i18n[lang], showNotices: true }));
  assert.ok(markup.includes(i18n[lang].journeyTransferCount(2)), `${lang}: transfer count renders`);
  assert.ok(markup.includes('Shubra') && markup.includes('Dokki') && markup.includes('Attaba'));
  assert.ok(markup.includes(i18n[lang].journeyServiceNotice) && markup.includes(i18n[lang].journeyWalkNotice));
  assert.ok(markup.includes('M8') && markup.includes('M2') && markup.includes(lang === 'ar' ? 'تمناية' : 'Tomnaya'));
  assert.ok(markup.includes(lang === 'ar' ? 'أتوبيس' : 'Bus') && markup.includes('Ramses'));
  assert.ok(markup.includes(lang === 'ar' ? 'إمكانية الوصول غير متحققين' : 'accessibility are unverified'));
  const quietMarkup = renderToStaticMarkup(React.createElement(journeySteps.JourneySteps, { journey, lang, t: i18n[lang] }));
  assert.ok(!quietMarkup.includes(i18n[lang].journeyWalkNotice) && !quietMarkup.includes(i18n[lang].journeyServiceNotice),
    'journey cards do not repeat panel-level notices by default');
}
console.log('Trip tabs render correctly in Arabic and English.');
