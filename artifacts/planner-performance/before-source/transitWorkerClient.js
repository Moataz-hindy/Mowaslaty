// Small promise wrapper around the transit Web Worker.
// Falls back to running on the main thread if workers aren't available.
import { findNearestDropPoints } from './geoUtils';
import { planJourney } from './tripPlanner';
import { loadRoutingNetwork } from './dataLoader';
import { relinkJourney } from './journey';
import { walkRoute } from './walkRouter';

let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (worker || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('../workers/transit.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, ok, result, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      ok ? p.resolve(result) : p.reject(new Error(error));
    };
    worker.onerror = (e) => {
      console.error('Transit worker error:', e.message);
      pending.forEach(p => p.reject(new Error('worker failed')));
      pending.clear();
      worker = null;
    };
  } catch (e) {
    worker = null;
  }
  return worker;
}

function run(type, payload, fallback) {
  const w = getWorker();
  if (!w) return Promise.resolve().then(fallback);
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, type, payload });
  }).catch(() => fallback());
}

export function computeNearest(targetCoord, data, maxDistance = 2000, options = {}) {
  return run('nearest', { targetCoord, maxDistance, options },
    () => {
      const res = findNearestDropPoints(targetCoord, data.routes, data.geometries, data.stops, maxDistance, options);
      return {
        items: res,
        counts: res.counts,
        byCategory: res.byCategory
      };
    }).then(res => {
      if (res && res.items) {
        const arr = res.items;
        arr.counts = res.counts || { ALL: arr.length, Metro: 0, Minibus: 0, Microbus: 0, Bus: 0 };
        arr.byCategory = res.byCategory || {};
        return arr;
      }
      return res || [];
    });
}

export function computePlan(originCoord, destCoord, data, maxWalk = 1200, options = {}) {
  const routesById = new Map((data?.routes || []).map(route => [route.id, route]));
  const relink = plan => ({ ...plan,
    directRoutes: (plan?.directRoutes || []).map(journey => relinkJourney(journey, routesById)),
    transferRoutes: (plan?.transferRoutes || []).map(journey => relinkJourney(journey, routesById))
  });
  return run('plan', { originCoord, destCoord, maxWalk, options }, async () => {
    const network = data?.routingNetwork || await loadRoutingNetwork();
    return planJourney(originCoord, destCoord, network, { maxWalkMeters: maxWalk, geometries: data?.geometries, ...options });
  }).then(relink);
}

export function computeWalk(start, end) {
  return run('walk', { start, end }, () => walkRoute(start, end));
}
