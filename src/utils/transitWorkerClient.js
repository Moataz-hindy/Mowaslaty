// Small promise wrapper around the transit Web Worker.
// Falls back to running on the main thread if workers aren't available.
import { findNearestDropPoints } from './geoUtils';
import { planJourneyProgressive } from './tripPlanner';
import { loadGeometries, loadRoutingNetwork } from './dataLoader';
import { relinkJourney } from './journey';
import { walkRoute } from './walkRouter';

let worker = null;
let nextId = 1;
const pending = new Map();
let nextPlanId = 1;
const datasetIds = new WeakMap();
let nextDatasetId = 1;
const planCache = new Map();
const inflightPlans = new Map();
const PLAN_CACHE_LIMIT = 12;
let idlePlannerWorker = null;
let idlePlannerWorkerDataset = null;

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
  const { signal, onProgress, ...searchOptions } = options || {};
  if (signal?.aborted) return Promise.reject(createAbortError());
  const datasetKey = plannerDatasetKey(data);
  const key = planKey(originCoord, destCoord, datasetKey, maxWalk, searchOptions);
  if (planCache.has(key)) {
    const cached = planCache.get(key);
    planCache.delete(key);
    planCache.set(key, cached);
    const result = relink(clonePlan(cached));
    notifyProgress(onProgress, { phase: 'final', plan: relink(clonePlan(cached)) });
    return Promise.resolve(result);
  }
  let task = inflightPlans.get(key);
  if (!task) {
    task = { key, id: nextPlanId++, datasetKey, data, originCoord, destCoord, maxWalk, searchOptions,
      subscribers: new Set(), worker: null, fallbackController: null, lastProgress: null, settled: false };
    inflightPlans.set(key, task);
    launchPlanTask(task);
  }
  return subscribePlanTask(task, { signal, onProgress, relink });
}

function identityOf(value) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return String(value ?? '');
  if (!datasetIds.has(value)) datasetIds.set(value, nextDatasetId++);
  return datasetIds.get(value);
}

function plannerDatasetKey(data) {
  const versions = [data?.routingNetwork?.version, data?.networkVersion, data?.routes?.version,
    data?.geometries?.version, data?.stops?.version].map(value => String(value ?? '')).join(':');
  return `${versions}|${[data?.routingNetwork, data?.routes, data?.geometries, data?.stops].map(identityOf).join(':')}`;
}

function planKey(origin, destination, dataset, maxWalk, options) {
  const orderedOptions = Object.fromEntries(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)));
  return `${dataset}|${JSON.stringify(origin)}>${JSON.stringify(destination)}|${maxWalk}|${JSON.stringify(orderedOptions)}`;
}

function clonePlan(plan) {
  if (typeof structuredClone === 'function') return structuredClone(plan);
  return JSON.parse(JSON.stringify(plan));
}

function createAbortError() {
  return Object.assign(new Error('The planner search was cancelled'), { name: 'AbortError' });
}

function notifyProgress(callback, progress) {
  if (typeof callback !== 'function') return;
  try { callback(progress); } catch (error) { console.error('Planner progress callback failed:', error); }
}

function publishPlanProgress(task, progress) {
  if (task.settled || progress?.phase !== 'direct' || !progress.plan) return;
  task.lastProgress = progress;
  for (const subscriber of task.subscribers) {
    if (subscriber.active) notifyProgress(subscriber.onProgress, { phase: progress.phase, plan: subscriber.relink(clonePlan(progress.plan)) });
  }
}

function finishPlanTask(task, plan) {
  if (task.settled) return;
  task.settled = true;
  inflightPlans.delete(task.key);
  if (plan && plan.status !== 'invalid-input') {
    planCache.delete(task.key);
    planCache.set(task.key, clonePlan(plan));
    while (planCache.size > PLAN_CACHE_LIMIT) planCache.delete(planCache.keys().next().value);
  }
  if (task.worker) {
    task.worker.onmessage = null;
    task.worker.onerror = null;
    if (idlePlannerWorker && idlePlannerWorker !== task.worker) idlePlannerWorker.terminate();
    idlePlannerWorker = task.worker;
    idlePlannerWorkerDataset = task.datasetKey;
    task.worker = null;
  }
  for (const subscriber of task.subscribers) {
    if (!subscriber.active) continue;
    subscriber.active = false;
    subscriber.signal?.removeEventListener?.('abort', subscriber.abort);
    const result = clonePlan(plan);
    notifyProgress(subscriber.onProgress, { phase: 'final', plan: subscriber.relink(clonePlan(result)) });
    subscriber.resolve(subscriber.relink(result));
  }
  task.subscribers.clear();
}

function failPlanTask(task, error) {
  if (task.settled) return;
  task.settled = true;
  inflightPlans.delete(task.key);
  task.worker?.terminate();
  if (task.worker === idlePlannerWorker) { idlePlannerWorker = null; idlePlannerWorkerDataset = null; }
  task.fallbackController?.abort();
  for (const subscriber of task.subscribers) {
    if (!subscriber.active) continue;
    subscriber.active = false;
    subscriber.signal?.removeEventListener?.('abort', subscriber.abort);
    subscriber.reject(error);
  }
  task.subscribers.clear();
}

function abortPlanTask(task) {
  if (task.settled) return;
  task.settled = true;
  inflightPlans.delete(task.key);
  task.worker?.terminate();
  if (task.worker === idlePlannerWorker) { idlePlannerWorker = null; idlePlannerWorkerDataset = null; }
  task.fallbackController?.abort();
  task.subscribers.clear();
}

function subscribePlanTask(task, { signal, onProgress, relink }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(createAbortError()); return; }
    const subscriber = { signal, onProgress, relink, resolve, reject, active: true, abort: null };
    subscriber.abort = () => {
      if (!subscriber.active) return;
      subscriber.active = false;
      task.subscribers.delete(subscriber);
      signal?.removeEventListener?.('abort', subscriber.abort);
      reject(createAbortError());
      if (![...task.subscribers].some(item => item.active)) abortPlanTask(task);
    };
    signal?.addEventListener?.('abort', subscriber.abort, { once: true });
    task.subscribers.add(subscriber);
    if (task.lastProgress) notifyProgress(onProgress, { phase: task.lastProgress.phase,
      plan: relink(clonePlan(task.lastProgress.plan)) });
  });
}

function launchPlanTask(task) {
  if (typeof Worker !== 'undefined') {
    try {
      let worker;
      if (idlePlannerWorker && idlePlannerWorkerDataset === task.datasetKey) {
        worker = idlePlannerWorker;
        idlePlannerWorker = null;
        idlePlannerWorkerDataset = null;
      } else {
        idlePlannerWorker?.terminate();
        idlePlannerWorker = null;
        idlePlannerWorkerDataset = null;
        worker = new Worker(new URL('../workers/planner.worker.js', import.meta.url), { type: 'module' });
      }
      task.worker = worker;
      worker.onmessage = event => {
        const message = event.data || {};
        if (message.id !== task.id || task.settled) return;
        if (message.phase === 'progress') publishPlanProgress(task, message.progress);
        else if (message.ok) finishPlanTask(task, message.result);
        else if (message.errorName === 'AbortError') failPlanTask(task, createAbortError());
        else launchMainPlanFallback(task);
      };
      worker.onerror = () => launchMainPlanFallback(task);
      worker.postMessage({ id: task.id, type: 'plan', payload: { originCoord: task.originCoord, destCoord: task.destCoord,
        maxWalk: task.maxWalk, options: task.searchOptions } });
      return;
    } catch (_error) { task.worker?.terminate(); task.worker = null; }
  }
  launchMainPlanFallback(task);
}

function launchMainPlanFallback(task) {
  if (task.settled || task.fallbackController) return;
  task.worker?.terminate();
  task.worker = null;
  const controller = new AbortController();
  task.fallbackController = controller;
  Promise.resolve().then(async () => {
    const network = task.data?.routingNetwork || await loadRoutingNetwork();
    const geometries = task.data?.geometries || await loadGeometries();
    return planJourneyProgressive(task.originCoord, task.destCoord, network,
      { maxWalkMeters: task.maxWalk, ...task.searchOptions, geometries }, {
        signal: controller.signal, onProgress: progress => publishPlanProgress(task, progress)
      });
  }).then(result => finishPlanTask(task, result)).catch(error => {
    if (error?.name === 'AbortError') failPlanTask(task, createAbortError());
    else failPlanTask(task, error);
  });
}

export function computeWalk(start, end) {
  return run('walk', { start, end }, () => walkRoute(start, end));
}
