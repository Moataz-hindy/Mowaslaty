import { decodePolyline } from './polyline';

// Versioned file names: when the data changes, bump the version so browsers
// (and the CDN) fetch the new file instead of a cached copy.
export const DATA_FILES = {
  routes: '/data/routes_summary.json',
  geometry: '/data/routes_geometry.v2.json',
  stops: '/data/stops_summary.json'
};

const getJson = (url) => fetch(url).then(res => {
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
});

export const loadRoutes = () => getJson(DATA_FILES.routes);
export const loadStops = () => getJson(DATA_FILES.stops);

// Route shapes are stored as encoded polylines -> decode to [[lat, lng], ...]
export async function loadGeometries() {
  const encoded = await getJson(DATA_FILES.geometry);
  const out = {};
  for (const id in encoded) out[id] = decodePolyline(encoded[id]);
  return out;
}
