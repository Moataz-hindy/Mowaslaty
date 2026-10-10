// Small promise wrapper around the transit Web Worker.
// Falls back to running on the main thread if workers aren't available.
import { findNearestDropPoints } from './geoUtils';
import { planJourney } from './tripPlanner';

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

export function computeNearest(targetCoord, data, maxDistance = 2000) {
  return run('nearest', { targetCoord, maxDistance },
    () => findNearestDropPoints(targetCoord, data.routes, data.geometries, data.stops, maxDistance));
}

export function computePlan(originCoord, destCoord, data, maxWalk = 1200) {
  return run('plan', { originCoord, destCoord, maxWalk },
    () => planJourney(originCoord, destCoord, data.routes, data.geometries, data.stops, maxWalk));
}
