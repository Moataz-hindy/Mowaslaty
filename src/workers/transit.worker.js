// Runs the heavy geometry searches off the main thread so the page
// stays smooth on slower phones. It loads its own copy of the data
// (served from the browser cache after the page's first download).
import { loadRoutes, loadGeometries, loadStops, loadRoutingNetwork } from '../utils/dataLoader';
import { findNearestDropPoints } from '../utils/geoUtils';
import { planJourney } from '../utils/tripPlanner';
import { walkRoute } from '../utils/walkRouter';

let dataReady = null;
function loadTransitData() {
  if (!dataReady) dataReady = Promise.all([loadRoutes(), loadGeometries(), loadStops()])
    .then(([routes, geometries, stops]) => ({ routes, geometries, stops }))
    .catch(error => { dataReady = null; throw error; });
  return dataReady;
}

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};
  if (type === 'walk') {
    // walking routes don't need the transit data
    try {
      const result = await walkRoute(payload.start, payload.end);
      self.postMessage({ id, ok: true, result });
    } catch (err) {
      self.postMessage({ id, ok: false, error: String(err && err.message || err) });
    }
    return;
  }
  try {
    let result;
    if (type === 'nearest') {
      const { routes, geometries, stops } = await loadTransitData();
      const dropPoints = findNearestDropPoints(payload.targetCoord, routes, geometries, stops, payload.maxDistance ?? 2000, payload.options || {});
      result = {
        items: dropPoints,
        counts: dropPoints.counts,
        byCategory: dropPoints.byCategory
      };
    } else if (type === 'plan') {
      const [network, { geometries }] = await Promise.all([loadRoutingNetwork(), loadTransitData()]);
      result = planJourney(payload.originCoord, payload.destCoord, network, { maxWalkMeters: payload.maxWalk ?? 1200, geometries, ...(payload.options || {}) });
    } else {
      throw new Error(`Unknown task: ${type}`);
    }
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
