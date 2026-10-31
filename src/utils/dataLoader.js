import { decodePolyline } from './polyline';
import { filterRouteGeometry, filterRouteSummary, filterRoutingNetwork } from './routePolicy.js';
import { mergeBrtGeometries, mergeBrtNetwork, mergeBrtRoutes } from './brtData.js';

// Versioned file names: when the data changes, bump the version so browsers
// (and the CDN) fetch the new file instead of a cached copy.
export const DATA_FILES = {
  routes: '/data/routes_summary.v2.json',
  geometry: '/data/routes_geometry.v2.json',
  stops: '/data/stops_summary.json',
  routingNetwork: '/data/routing_network.v1.json',
  places: '/data/places.v1.json',
  brtCatalogue: '/data/brt_catalogue.v1.json'
};

const getJson = (url) => fetch(url).then(res => {
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
});

let brtCataloguePromise = null;
export function loadBrtCatalogue() {
  if (!brtCataloguePromise) {
    brtCataloguePromise = getJson(DATA_FILES.brtCatalogue).catch(error => {
      brtCataloguePromise = null;
      throw error;
    });
  }
  return brtCataloguePromise;
}

export const loadRoutes = async () => {
  const [routes, catalogue] = await Promise.all([getJson(DATA_FILES.routes).then(filterRouteSummary), loadBrtCatalogue().catch(() => null)]);
  return mergeBrtRoutes(routes, catalogue);
};
export const loadStops = async () => {
  const [stops, catalogue] = await Promise.all([getJson(DATA_FILES.stops), loadBrtCatalogue().catch(() => null)]);
  const result = [...stops, ...(catalogue?.stations || []).filter(station => station.status === 'active-corridor-candidate').map(station => ({
    id: station.id, sourceId: station.id, type: 'brt', name_en: station.nameEn, name_ar: station.nameAr,
    nameEn: station.nameEn, nameAr: station.nameAr, lat: station.lat, lng: station.lng,
    aliases: station.aliases || [], nameVerification: station.nameVerification,
    source: 'community-reference-estimated', stationAccessVerified: false, transferAccessVerified: false
  }))];
  result.brtUnavailable = !catalogue;
  return result;
};

let routingNetworkPromise = null;
export function loadRoutingNetwork() {
  if (!routingNetworkPromise) {
    routingNetworkPromise = Promise.all([getJson(DATA_FILES.routingNetwork).then(filterRoutingNetwork), loadBrtCatalogue().catch(() => null)])
      .then(([network, catalogue]) => mergeBrtNetwork(network, catalogue)).catch(err => {
      routingNetworkPromise = null;
      throw err;
    });
  }
  return routingNetworkPromise;
}

// Route shapes are stored as encoded polylines -> decode to [[lat, lng], ...]
export async function loadGeometries() {
  const [encoded, catalogue] = await Promise.all([getJson(DATA_FILES.geometry), loadBrtCatalogue().catch(() => null)]);
  const out = {};
  const filtered = filterRouteGeometry(encoded);
  for (const id in filtered) out[id] = decodePolyline(filtered[id]);
  return mergeBrtGeometries(out, catalogue);
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
