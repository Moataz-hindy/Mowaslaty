import React from 'react';
import { createRoot } from 'react-dom/client';
import JourneySteps from '../src/components/JourneySteps.jsx';
import { I18N } from '../src/utils/i18n.js';
import '../src/index.css';
import './journey-layout-preview.css';

// DEV-only synthetic examples. This file is not referenced by the production Vite entry.
const stop = (en, ar) => ({ nameEn: en, nameAr: ar });
const route = (vehicle, num) => ({ vehicle, num });
const ride = (id, vehicle, label, from, to, distanceMeters, durationMinutes, flexibleDrop = false) => ({
  id, kind: 'ride', route: route(vehicle, label), fromStop: stop(from, from), toStop: stop(to, to), distanceMeters, durationMinutes, flexibleDrop
});
const fixtures = [
  { title: 'Direct · one bus ride', lang: 'en', t: I18N.en, journey: { id: 'direct-demo', legs: [ride('r1', 'Bus', '102', 'Ramses Station', 'Maadi Grand Mall', 12300, 42)], totalTimeMinutes: 42, totalWalkMeters: 0, transfers: 0 } },
  { title: 'Two rides · access + transfer walk + egress', lang: 'en', t: I18N.en, journey: { id: 'two-rides-demo', transfers: 1, totalTimeMinutes: 73, totalWalkMeters: 640, legs: [
    { id: 'w1', kind: 'walk', purpose: 'access', distanceMeters: 240, durationMinutes: 4 }, ride('r2', 'Metro', '1', 'Helwan', 'Sadat', 18500, 31),
    { id: 'w2', kind: 'walk', purpose: 'transfer', distanceMeters: 0, durationMinutes: 0 }, ride('r3', 'Minibus', '17', 'Tahrir Square', 'Dokki Square', 4200, 18),
    { id: 'w3', kind: 'walk', purpose: 'egress', distanceMeters: 400, durationMinutes: 8 }
  ] } },
  { title: 'Three rides · flexible suggested drop · long labels', lang: 'en', t: I18N.en, journey: { id: 'three-rides-demo', transfers: 2, totalTimeMinutes: 95, totalWalkMeters: 980, legs: [
    ride('r4', 'Bus', '77', 'A very long boarding point name at El Marg interchange', 'Abbasia', 6100, 23),
    { id: 'w4', kind: 'walk', purpose: 'transfer', distanceMeters: 380, durationMinutes: 7 }, ride('r5', 'Microbus', '4', 'Abbasia', 'Roxy', 7300, 28, true),
    { id: 'w5', kind: 'walk', purpose: 'transfer', distanceMeters: 350, durationMinutes: 7 }, ride('r6', 'Minibus', '25', 'Roxy', 'Long destination name at New Cairo Fifth Settlement', 11100, 30)
  ] } },
  { title: 'Arabic · RTL · two rides', lang: 'ar', t: I18N.ar, journey: { id: 'arabic-demo', transfers: 1, totalTimeMinutes: 58, totalWalkMeters: 350, legs: [
    { id: 'w6', kind: 'walk', purpose: 'access', distanceMeters: 350, durationMinutes: 6 }, ride('r7', 'Metro', '1', 'حلوان', 'السادات', 15600, 35), { id: 'w7', kind: 'walk', purpose: 'transfer', distanceMeters: 0, durationMinutes: 0 }, ride('r8', 'Bus', '12', 'ميدان التحرير', 'العباسية', 5900, 17), { id: 'w8', kind: 'walk', purpose: 'egress', distanceMeters: 0, durationMinutes: 0 }
  ] } }
];

function Preview() {
  return <main className="journey-preview" dir="ltr">
    <header><small>DEVELOPMENT FIXTURES · NOT PRODUCTION</small><h1>Journey layout preview</h1><p>Synthetic examples rendered through the shared JourneySteps component.</p></header>
    <div className="journey-preview-grid">{fixtures.map(fixture => <section key={fixture.title} className="journey-preview-card" dir={fixture.lang === 'ar' ? 'rtl' : 'ltr'}>
      <h2>{fixture.title}</h2><JourneySteps journey={fixture.journey} lang={fixture.lang} t={fixture.t} />
    </section>)}</div>
  </main>;
}

createRoot(document.getElementById('root')).render(<Preview />);
