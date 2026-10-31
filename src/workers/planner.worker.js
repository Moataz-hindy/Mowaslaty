import { loadGeometries, loadRoutingNetwork } from '../utils/dataLoader';
import { planJourneyProgressive } from '../utils/tripPlanner';

const cancelled = new Set();
let dataPromise = null;
function loadPlannerData() {
  if (!dataPromise) dataPromise = Promise.all([loadRoutingNetwork(), loadGeometries()])
    .then(([network, geometries]) => ({ network, geometries }))
    .catch(error => { dataPromise = null; throw error; });
  return dataPromise;
}

self.onmessage = event => {
  const { id, type, payload } = event.data || {};
  if (type === 'cancel') { cancelled.add(id); return; }
  if (type !== 'plan') return;
  (async () => {
    try {
      const { network, geometries } = await loadPlannerData();
      const result = await planJourneyProgressive(payload.originCoord, payload.destCoord, network,
        { maxWalkMeters: payload.maxWalk ?? 1200, ...(payload.options || {}), geometries }, {
          signal: { get aborted() { return cancelled.has(id); } },
          onProgress: progress => self.postMessage({ id, phase: 'progress', progress })
        });
      if (!cancelled.has(id)) self.postMessage({ id, ok: true, result });
    } catch (error) {
      self.postMessage({ id, ok: false, error: String(error?.message || error), errorName: error?.name || 'Error' });
    } finally {
      cancelled.delete(id);
    }
  })();
};
