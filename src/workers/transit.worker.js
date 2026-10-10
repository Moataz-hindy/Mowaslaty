// Runs the heavy geometry searches off the main thread so the page
// stays smooth on slower phones. It loads its own copy of the data
// (served from the browser cache after the page's first download).
import { loadRoutes, loadGeometries, loadStops } from '../utils/dataLoader';
import { findNearestDropPoints } from '../utils/geoUtils';
import { planJourney } from '../utils/tripPlanner';

const dataReady = Promise.all([loadRoutes(), loadGeometries(), loadStops()])
  .then(([routes, geometries, stops]) => ({ routes, geometries, stops }));

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};
  try {
    const { routes, geometries, stops } = await dataReady;
    let result;
    if (type === 'nearest') {
      result = findNearestDropPoints(payload.targetCoord, routes, geometries, stops, payload.maxDistance ?? 2000);
    } else if (type === 'plan') {
      result = planJourney(payload.originCoord, payload.destCoord, routes, geometries, stops, payload.maxWalk ?? 1200);
    } else {
      throw new Error(`Unknown task: ${type}`);
    }
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
