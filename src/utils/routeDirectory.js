import { getRouteEnds, westernDigits } from './routeEnds.js';

export const DIRECTORY_VEHICLES = Object.freeze(['BRT', 'Microbus', 'Bus', 'Minibus']);

export function normalizeDirectorySearch(value) {
  return westernDigits(String(value ?? ''))
    .toLocaleLowerCase()
    .replace(/[ًٌٍَُِّْـٰٕٓٔ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ـ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function searchableText(route) {
  const endsAr = getRouteEnds(route, 'ar');
  const endsEn = getRouteEnds(route, 'en');
  return normalizeDirectorySearch([
    route.num, route.short_ar, route.short_en,
    endsAr.from, endsAr.to, endsEn.from, endsEn.to,
    ...(route.via_stops || []), ...(route.via_stops_en || []), ...(route.via_stops_ar || [])
  ].filter(Boolean).join(' '));
}

export function filterDirectoryRoutes(routes, vehicle = 'ALL', query = '') {
  const tokens = normalizeDirectorySearch(query).split(' ').filter(Boolean);
  return routes.filter(route => {
    if (!DIRECTORY_VEHICLES.includes(route.vehicle)) return false;
    if (vehicle === 'CTA' && (route.vehicle !== 'Bus' || route.agency !== 'CTA')) return false;
    if (vehicle !== 'ALL' && vehicle !== 'CTA' && route.vehicle !== vehicle) return false;
    if (!tokens.length) return true;
    const text = searchableText(route);
    return tokens.every(token => text.includes(token));
  });
}

export function paginateDirectoryRoutes(routes, requestedPage = 1, pageSize = 20) {
  const safeSize = Math.max(1, Math.floor(Number(pageSize) || 20));
  const pageCount = Math.max(1, Math.ceil(routes.length / safeSize));
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(requestedPage) || 1)));
  return {
    items: routes.slice((page - 1) * safeSize, page * safeSize),
    page,
    pageCount
  };
}
