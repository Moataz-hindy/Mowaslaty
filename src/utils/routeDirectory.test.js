import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDirectoryRoutes, normalizeDirectorySearch, paginateDirectoryRoutes } from './routeDirectory.js';

const routes = [
  { id: 'micro-east', num: '١٢٣', vehicle: 'Microbus', dir: 0, origin_ar: 'القاهرة', dest_ar: 'الجيزة', origin_en: 'Cairo', dest_en: 'Giza', via_stops: ['ميدان التحرير'] },
  { id: 'bus-west', num: '7', vehicle: 'Bus', agency: 'CTA', dir: 1, origin_ar: 'الجيزة', dest_ar: 'القاهرة', via_stops: ['جامعة القاهرة'] },
  { id: 'bus-other', num: '9', vehicle: 'Bus', agency: 'GRN' },
  { id: 'mini', num: 'M', vehicle: 'Minibus', origin_ar: 'المعادي', dest_ar: 'حلوان' },
  { id: 'metro', num: 'M1', vehicle: 'Metro' },
  { id: 'box', num: '9', vehicle: 'Box' },
  { id: 'tomnaya', num: 'T', vehicle: 'Tomnaya' }
];

test('directory includes only the supported road vehicle categories and filters by category', () => {
  assert.deepEqual(filterDirectoryRoutes(routes).map(route => route.id), ['micro-east', 'bus-west', 'bus-other', 'mini']);
  assert.deepEqual(filterDirectoryRoutes(routes, 'CTA').map(route => route.id), ['bus-west']);
});

test('search normalizes Arabic letters and digit forms across route number, endpoints and supplied stops', () => {
  assert.deepEqual(filterDirectoryRoutes(routes, 'ALL', '123').map(route => route.id), ['micro-east']);
  assert.deepEqual(filterDirectoryRoutes(routes, 'ALL', 'التحرير').map(route => route.id), ['micro-east']);
  assert.deepEqual(filterDirectoryRoutes(routes, 'ALL', 'القاهره').map(route => route.id), ['micro-east', 'bus-west']);
  assert.deepEqual(filterDirectoryRoutes([{ ...routes[0], num: 'Microbus', route_id: 'P_O_14_CA112' }], 'ALL', 'CA112'), []);
  assert.equal(normalizeDirectorySearch('إِلى ١٢٣'), 'الي 123');
});

test('pagination clamps requested page and reports page count', () => {
  const result = paginateDirectoryRoutes(routes.slice(0, 4), 2, 2);
  assert.deepEqual(result.items.map(route => route.id), ['bus-other', 'mini']);
  assert.equal(result.page, 2);
  assert.equal(result.pageCount, 2);
  assert.equal(paginateDirectoryRoutes([], 8, 0).page, 1);
});
