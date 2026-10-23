import { decodePolyline } from './polyline';
import { filterRouteGeometry, filterRouteSummary, filterRoutingNetwork } from './routePolicy.js';

// Versioned file names: when the data changes, bump the version so browsers
// (and the CDN) fetch the new file instead of a cached copy.
export const DATA_FILES = {
  routes: '/data/routes_summary.v2.json',
  geometry: '/data/routes_geometry.v2.json',
  stops: '/data/stops_summary.json',
  routingNetwork: '/data/routing_network.v1.json',
  places: '/data/places.v1.json'
};

const getJson = (url) => fetch(url).then(res => {
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
});

export const loadRoutes = () => getJson(DATA_FILES.routes).then(filterRouteSummary);
export const loadStops = () => getJson(DATA_FILES.stops);

let routingNetworkPromise = null;
export function loadRoutingNetwork() {
  if (!routingNetworkPromise) {
    routingNetworkPromise = getJson(DATA_FILES.routingNetwork).then(filterRoutingNetwork).catch(err => {
      routingNetworkPromise = null;
      throw err;
    });
  }
  return routingNetworkPromise;
}

// Route shapes are stored as encoded polylines -> decode to [[lat, lng], ...]
export async function loadGeometries() {
  const encoded = await getJson(DATA_FILES.geometry);
  const out = {};
  const filtered = filterRouteGeometry(encoded);
  for (const id in filtered) out[id] = decodePolyline(filtered[id]);
  return out;
}

// Named places from OpenStreetMap (scripts/build_osm.py), loaded on first search
let placesPromise = null;
export function loadPlaces() {
  if (!placesPromise) {
    placesPromise = getJson(DATA_FILES.places).catch(err => {
      placesPromise = null;
      throw err;
    });
  }
  return placesPromise;
}
