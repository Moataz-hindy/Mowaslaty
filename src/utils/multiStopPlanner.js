export const EMPTY_PLAN = { directRoutes: [], transferRoutes: [] };
import { journeyId, rideLegs, matchesVehicle } from './journey';

const coordinateKey = coord => Array.isArray(coord) ? `${coord[0]},${coord[1]}` : '';

export function buildMultiStopLegs(points = [], options = {}) {
  const optionsKey = `${options.networkVersion || 'routing-network-v1'}|${options.vehicle || 'ALL'}|${options.maxWalkMeters ?? 1200}|${options.maxTransferWalkMeters ?? 600}|${options.maxTotalWalkMeters ?? 3600}|${options.maxTransfers ?? 2}`;
  return points.slice(0, -1).map((from, index) => {
    const to = points[index + 1];
    const key = `${from.id}>${to.id}@${coordinateKey(from.coord)}>${coordinateKey(to.coord)}#${optionsKey}`;
    let status = 'loading';
    if (!from.coord || !to.coord) status = 'incomplete';
    else if (from.coord[0] === to.coord[0] && from.coord[1] === to.coord[1]) status = 'same-point';
    return { key, from, to, status, plan: null, error: null };
  });
}

export function journeyOptionKey(journey) {
  return journeyId(journey);
}

export function filterMultiStopPlan(plan = EMPTY_PLAN, vehicle = 'ALL') {
  return {
    directRoutes: (plan.directRoutes || []).filter(item => rideLegs(item).length && rideLegs(item).every(leg => matchesVehicle(leg.route, vehicle))),
    transferRoutes: (plan.transferRoutes || []).filter(item => rideLegs(item).length && rideLegs(item).every(leg => matchesVehicle(leg.route, vehicle)))
  };
}

export async function runMultiStopPlans(legs, data, { compute, options = {}, cache = new Map(), isCancelled = () => false, onResult = () => {} } = {}) {
  for (const leg of legs) {
    if (isCancelled()) break;
    if (leg.status === 'incomplete' || leg.status === 'same-point') {
      onResult({ ...leg, plan: null, error: null });
      continue;
    }
    if (cache.has(leg.key)) {
      onResult({ ...leg, status: 'ready', plan: cache.get(leg.key), error: null });
      continue;
    }
    try {
      const plan = await compute(leg.from.coord, leg.to.coord, data, options.maxWalkMeters ?? 1200, options);
      if (isCancelled()) break;
      const successfulPlan = plan || EMPTY_PLAN;
      cache.set(leg.key, successfulPlan);
      onResult({ ...leg, status: 'ready', plan: successfulPlan, error: null });
    } catch (error) {
      if (isCancelled()) break;
      onResult({ ...leg, status: 'error', plan: null, error: error?.message || String(error) });
    }
    if (!isCancelled()) await new Promise(resolve => setTimeout(resolve, 0));
  }
}
