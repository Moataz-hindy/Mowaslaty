// Start / end names of a route in the current language, in travel order.
//  - Arabic: origin_ar / dest_ar (added by scripts/add_arabic_ends.py), or the
//    dataset's own Arabic origin/dest (metro). If unknown, the start falls back
//    to the first stop of this direction, which is always correct.
//  - English: origin_en / dest_en.
const hasArabic = (txt) => /[؀-ۿ]/.test(txt || '');

// The data mixes Arabic-Indic digits ("١٥ مايو") with Western ones ("17.6 كم").
// Use Western digits everywhere in the UI for a consistent look.
export const westernDigits = (txt) =>
  txt == null ? txt : String(txt)
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));

export function getRouteEnds(r, lang = 'ar') {
  const ends = rawEnds(r, lang);
  return { from: westernDigits(ends.from), to: westernDigits(ends.to) };
}

function rawEnds(r, lang) {
  if (!r) return { from: null, to: null };
  if (lang === 'ar') {
    if (r.origin_ar && r.dest_ar) return { from: r.origin_ar, to: r.dest_ar };
    if (hasArabic(r.origin) && hasArabic(r.dest)) return { from: r.origin, to: r.dest };
    const firstStop = r.via_stops && r.via_stops[0];
    return { from: firstStop || null, to: null };
  }
  const from = r.origin_en || (!hasArabic(r.origin) ? r.origin : null);
  const to = r.dest_en || (!hasArabic(r.dest) ? r.dest : null);
  return { from, to };
}

// Text for the LED line-number board. Unnumbered lines carry the vehicle type
// as their "number" ("Minibus", "Microbus") -> show a short Arabic label instead.
const UNNUMBERED_LABELS = {
  ar: { minibus: 'ميني', microbus: 'ميكرو', tomnaya: 'تمناية', box: 'بوكس', bus: 'أتوبيس' },
  en: { minibus: 'Mini', microbus: 'Micro', tomnaya: 'Van', box: 'Box', bus: 'Bus' }
};
export function lineLabel(r, lang = 'ar') {
  if (!r) return '';
  const raw = String(r.num || r.route_id || '').trim();
  const key = raw.toLowerCase();
  const labels = UNNUMBERED_LABELS[lang === 'ar' ? 'ar' : 'en'];
  if (labels[key]) return labels[key];
  return westernDigits(raw);
}

export function vehicleRouteLabel(route, lang = 'ar') {
  if (!route) return '';
  const vehicleNames = lang === 'ar'
    ? { Bus: 'أتوبيس', Minibus: 'ميني باص', Microbus: 'ميكروباص', Box: 'بوكس', Tomnaya: 'تمناية', Metro: 'مترو' }
    : { Bus: 'Bus', Minibus: 'Minibus', Microbus: 'Microbus', Box: 'Box', Tomnaya: 'Tomnaya', Metro: 'Metro' };
  const vehicle = vehicleNames[route.vehicle] || route.vehicle || '';
  const number = lineLabel(route, lang);
  const isTypeFallback = String(route.num || route.route_id || '').trim().toLowerCase() === String(route.vehicle || '').toLowerCase();
  return [vehicle, isTypeFallback ? '' : number].filter(Boolean).join(' ');
}
