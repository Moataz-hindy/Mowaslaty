import { createRoutingIndex, distanceMeters, validCoord } from './routingNetwork.js';
import { matchesVehicle, supportsFlexibleAlighting, journeyRidePath, nearestPointOnRidePath, geometryMayBeWithinMeters } from './journey.js';

const DEFAULTS = { maxWalkMeters: 1200, maxTransferWalkMeters: 600, maxTotalWalkMeters: 3600, maxTransfers: 2, vehicle: 'ALL' };
const EMPTY = (status, metadata = {}) => ({ status, directRoutes: [], transferRoutes: [], metadata });
const coordFor = (index, stopId) => {
  const stop = index.stopsById.get(stopId);
  return stop ? [Number(stop.lat), Number(stop.lng)] : null;
};
const routeOf = (_index, trip) => trip.route;
const pathIdentity = rides => rides.map(ride => `${ride.trip.id}:${ride.from.sequence}-${ride.to.sequence}${ride.flexibleDrop ? `@${ride.dropCoord.map(value => Number(value).toFixed(5)).join(',')}` : ''}`).join('|');
const candidateIdentity = rides => rides.map(ride => ride.trip.route.route_id || ride.trip.route.id).join('|');
function historyRides(history) {
  const rides = [];
  for (let node = history; node; node = node.parent) rides.push(node.ride);
  return rides.reverse();
}
function identityOf(label) {
  if (!label.identity) label.identity = pathIdentity(label.rides || historyRides(label.history));
  return label.identity;
}
function hasForwardSameTripContinuation(rides) {
  return rides.some((ride, index) => index > 0 && rides[index - 1].trip.id === ride.trip.id &&
    Number(ride.from.sequence) >= Number(rides[index - 1].to.sequence));
}
function elapsedMinutes(label) {
  return label.rideMeters * 0.003 + label.walkMeters / 80;
}

function addPareto(frontierByStop, label) {
  const previous = frontierByStop.get(label.stopId) || [];
  const identity = identityOf(label);
  for (const other of previous) {
    const noWorse = other.walkMeters <= label.walkMeters && elapsedMinutes(other) <= elapsedMinutes(label);
    if (noWorse && (other.walkMeters < label.walkMeters || elapsedMinutes(other) < elapsedMinutes(label) || identityOf(other) <= identity)) return false;
  }
  const kept = previous.filter(other => !(label.walkMeters <= other.walkMeters && elapsedMinutes(label) <= elapsedMinutes(other) &&
    (label.walkMeters < other.walkMeters || elapsedMinutes(label) < elapsedMinutes(other) || identity < identityOf(other))));
  kept.push(label);
  frontierByStop.set(label.stopId, kept);
  return true;
}

function makeJourney(index, origin, destination, rides, walks, egress, coordFor) {
  const finalWalks = [...walks, egress];
  const rideLegData = rides.map(ride => {
    const fromCoord = [...(coordFor(ride.from.stopId) || [])];
    const toCoord = [...(ride.dropCoord || coordFor(ride.to.stopId) || [])];
    const path = ride.path || ride.trip.calls.slice(ride.fromIndex, ride.toIndex + 1)
      .map(call => coordFor(call.stopId)).filter(Boolean).map(coord => [...coord]);
    const meters = ride.distanceMeters ?? Math.max(0, Number(ride.to.distanceMeters) - Number(ride.from.distanceMeters));
    const toStop = ride.flexibleDrop
      ? { nameAr: 'نقطة النزول المقترحة', nameEn: 'Suggested drop point' }
      : index.stopsById.get(ride.to.stopId);
    const route = routeOf(index, ride.trip);
    return { kind: 'ride', route, tripId: ride.trip.id,
      fromStop: index.stopsById.get(ride.from.stopId), toStop, flexibleDrop: Boolean(ride.flexibleDrop),
      fromSequence: Number(ride.from.sequence), toSequence: Number(ride.to.sequence), fromCoord, toCoord,
      distanceMeters: meters, durationMinutes: meters / 1000 * 3, path, source: ride.trip.source || 'network',
      distanceEstimated: ride.trip.distanceEstimated !== false && ride.from.distanceEstimated !== false && ride.to.distanceEstimated !== false,
      geometryEstimated: route.geometryEstimated === true || Boolean(ride.trip.sourceMetadata?.geometryVerification === 'unverified-community-reference'),
      servicePatternStatus: ride.trip.sourceMetadata?.servicePatternStatus || route.sourceMetadata?.servicePatternStatus || null,
      sourceMetadata: ride.trip.sourceMetadata || route.sourceMetadata || null };
  });
  const legs = [];
  for (let i = 0; i < rideLegData.length; i++) {
    const walk = finalWalks[i];
    legs.push({ kind: 'walk', fromCoord: [...walk.fromCoord], toCoord: [...walk.toCoord], distanceMeters: walk.meters,
      durationMinutes: walk.meters / 80, verification: 'estimated', purpose: walk.purpose });
    legs.push(rideLegData[i]);
  }
  const lastWalk = finalWalks[finalWalks.length - 1];
  legs.push({ kind: 'walk', fromCoord: [...lastWalk.fromCoord], toCoord: [...lastWalk.toCoord], distanceMeters: lastWalk.meters,
    durationMinutes: lastWalk.meters / 80, verification: 'estimated', purpose: lastWalk.purpose });
  const transfers = Math.max(0, rides.length - 1);
  const totalWalkMeters = finalWalks.reduce((sum, walk) => sum + walk.meters, 0);
  const totalRideKm = rideLegData.reduce((sum, leg) => sum + leg.distanceMeters / 1000, 0);
  const totalTimeMinutes = rideLegData.reduce((sum, leg) => sum + leg.durationMinutes, 0) + finalWalks.reduce((sum, walk) => sum + walk.meters / 80, 0);
  const hasBrt = rideLegData.some(leg => leg.route?.vehicle === 'BRT');
  const hasHistoricalRide = rideLegData.some(leg => leg.route?.vehicle !== 'BRT' && leg.source === 'gtfs');
  const warnings = ['waiting-time-unknown', 'walking-estimated'];
  if (hasHistoricalRide) warnings.push('historical-service-data');
  if (hasBrt) warnings.push('brt-service-pattern-provisional', 'brt-geometry-estimated', 'station-access-unverified');
  const id = pathIdentity(rides);
  return { id, type: transfers ? 'transfer' : 'direct', legs, transfers, totalWalkMeters: Math.round(totalWalkMeters),
    totalRideKm: Math.round(totalRideKm * 10) / 10, totalTimeMinutes: Math.round(totalTimeMinutes * 10) / 10,
    estimated: true, warnings,
    rankingMinutes: totalTimeMinutes + 5 * transfers, _origin: origin, _destination: destination };
}

function compareCandidates(a, b) {
  return a.rankingMinutes - b.rankingMinutes || a.totalWalkMeters - b.totalWalkMeters || a.transfers - b.transfers || a.id.localeCompare(b.id);
}

function* planJourneySteps(originCoord, destinationCoord, network, options = {}, isCancelled = () => false) {
  const opts = { ...DEFAULTS, ...options };
  if (!validCoord(originCoord) || !validCoord(destinationCoord) || !network) return EMPTY('invalid-input');
  const origin = [Number(originCoord[0]), Number(originCoord[1])];
  const destination = [Number(destinationCoord[0]), Number(destinationCoord[1])];
  if (distanceMeters(origin, destination) <= 0.01) return EMPTY('same-point', { networkVersion: network.version ?? null });
  if (![opts.maxWalkMeters, opts.maxTransferWalkMeters, opts.maxTotalWalkMeters, opts.maxTransfers].every(Number.isFinite) ||
      opts.maxWalkMeters < 0 || opts.maxWalkMeters > 20000 || opts.maxTransferWalkMeters < 0 || opts.maxTransferWalkMeters > 20000 ||
      opts.maxTotalWalkMeters < 0 || opts.maxTotalWalkMeters > 20000 || opts.maxTransfers < 0) return EMPTY('invalid-input');

  const index = createRoutingIndex(network);
  const stopCoordinateCache = new Map();
  const coordFor = stopId => {
    if (stopCoordinateCache.has(stopId)) return stopCoordinateCache.get(stopId);
    const stop = index.stopsById.get(stopId);
    const coord = stop ? [Number(stop.lat), Number(stop.lng)] : null;
    stopCoordinateCache.set(stopId, coord);
    return coord;
  };
  const destinationDistanceByStop = new Map();
  const distanceToDestination = stopId => {
    if (destinationDistanceByStop.has(stopId)) return destinationDistanceByStop.get(stopId);
    const coord = coordFor(stopId);
    const distance = coord ? distanceMeters(coord, destination) : Infinity;
    destinationDistanceByStop.set(stopId, distance);
    return distance;
  };
  const geometries = opts.geometries || {};
  const eligible = index.trips.filter(trip => matchesVehicle(routeOf(index, trip), opts.vehicle));
  const eligibleBoardings = new Map();
  const eligibleTripSet = new Set(eligible.map(trip => trip.id));
  for (const [stopId, boardings] of index.boardingByStop) {
    const kept = boardings.filter(item => eligibleTripSet.has(index.trips[item.tripIndex].id));
    if (kept.length) eligibleBoardings.set(stopId, kept);
  }
  const origins = index.nearbyStops(origin, opts.maxWalkMeters);
  const destinations = index.nearbyStops(destination, opts.maxWalkMeters);
  if (!origins.length || !destinations.length) return EMPTY('no-nearby-stops', { networkVersion: index.version, eligibleTrips: eligible.length, invalidTrips: index.rejectedTrips });

  const transferLimit = Math.min(2, Math.floor(opts.maxTransfers));
  const totalLimit = opts.maxTotalWalkMeters;
  const direct = new Map();
  const transfers = new Map();
  const nearbyCache = new Map();
  const flexibleDropCache = new Map();
  let flexibleProjectionSkips = 0;
  const rank = (map, limit) => [...map.values()].sort(compareCandidates).slice(0, limit)
    .map(candidate => makeJourney(index, origin, destination, candidate.rides, candidate.walks, candidate.egress, coordFor));
  const nearbyByStop = (stopId, radius) => {
    const key = `${stopId}:${radius}`;
    if (!nearbyCache.has(key)) nearbyCache.set(key, index.nearbyStops(coordFor(stopId), radius));
    return nearbyCache.get(key);
  };
  const flexiblePathFor = trip => {
    const key = trip.id;
    if (flexibleDropCache.has(key)) return flexibleDropCache.get(key);
    if (trip.calls.length < 2 || !supportsFlexibleAlighting(trip.route)) {
      flexibleDropCache.set(key, null);
      return null;
    }
    const fullPath = journeyRidePath({ route: trip.route,
      fromCoord: coordFor(trip.calls[0].stopId), toCoord: coordFor(trip.calls.at(-1).stopId) }, geometries);
    const result = fullPath.estimated ? null : fullPath.path;
    flexibleDropCache.set(key, result);
    return result;
  };
  const flexibleDropFor = (trip, fromIndex) => {
    const key = `${trip.id}:${fromIndex}`;
    if (flexibleDropCache.has(key)) return flexibleDropCache.get(key);
    const routeGeometry = geometries?.[trip.route?.id];
    if (Array.isArray(routeGeometry) && !geometryMayBeWithinMeters(routeGeometry, destination, opts.maxWalkMeters)) {
      flexibleProjectionSkips++;
      flexibleDropCache.set(key, null);
      return null;
    }
    const path = flexiblePathFor(trip);
    const toIndex = trip.calls.length - 1;
    if (!path || toIndex <= fromIndex) {
      flexibleDropCache.set(key, null);
      return null;
    }
    const totalTripMeters = Number(trip.calls[toIndex].distanceMeters) - Number(trip.calls[0].distanceMeters);
    const expectedStartFraction = totalTripMeters > 0
      ? (Number(trip.calls[fromIndex].distanceMeters) - Number(trip.calls[0].distanceMeters)) / totalTripMeters
      : fromIndex / toIndex;
    const projection = nearestPointOnRidePath(path, destination, coordFor(trip.calls[fromIndex].stopId), expectedStartFraction);
    if (!projection) {
      flexibleDropCache.set(key, null);
      return null;
    }
    const estimatedMeters = Math.max(0, Number(trip.calls[toIndex].distanceMeters) - Number(trip.calls[fromIndex].distanceMeters)) * projection.fraction;
    const result = { ...projection, toIndex, distanceMeters: estimatedMeters };
    flexibleDropCache.set(key, result);
    return result;
  };
  let scannedCalls = 0;
  let expandedLabels = 0;
  let prunedByBound = 0;
  let seeds = [];
  for (const originItem of origins) {
    if (!(eligibleBoardings.get(originItem.stop.id) || []).length) continue;
    seeds.push({ stopId: originItem.stop.id, ridesCount: 0, history: null,
      walks: [{ fromCoord: origin, toCoord: coordFor(originItem.stop.id), meters: originItem.meters, purpose: 'access' }],
      walkMeters: originItem.meters, rideMeters: 0 });
  }
  if (!seeds.length) return EMPTY('no-service', { networkVersion: index.version, eligibleTrips: eligible.length });

  for (let round = 0; round <= transferLimit && seeds.length; round++) {
    const alightFrontier = new Map();
    if (round > 0) seeds.sort((a, b) => elapsedMinutes(a) + 5 * a.ridesCount - elapsedMinutes(b) - 5 * b.ridesCount);
    for (const seed of seeds) {
      if (round > 0 && transfers.size >= 8) {
        const worstKnown = [...transfers.values()].sort(compareCandidates)[7].rankingMinutes;
        const lowerBound = elapsedMinutes(seed) + 5 * seed.ridesCount;
        if (lowerBound > worstKnown) { prunedByBound++; continue; }
      }
      expandedLabels++;
      for (const boarding of eligibleBoardings.get(seed.stopId) || []) {
      const trip = index.trips[boarding.tripIndex];
      const fromIndex = boarding.callIndex;
      const fromCall = trip.calls[fromIndex];
      const flexibleDrop = flexibleDropFor(trip, fromIndex);
      if (flexibleDrop && flexibleDrop.distanceToDestinationMeters <= opts.maxWalkMeters) {
        const walks = seed.walks;
        const totalWalk = seed.walkMeters + flexibleDrop.distanceToDestinationMeters;
        if (totalWalk <= totalLimit) {
          const lastCall = trip.calls[flexibleDrop.toIndex];
          const flexRide = { trip, from: fromCall, to: lastCall, fromIndex, toIndex: flexibleDrop.toIndex,
            dropCoord: flexibleDrop.coord, dropType: 'suggested', flexibleDrop: true,
            path: flexibleDrop.path, distanceMeters: flexibleDrop.distanceMeters };
          const rides = [...historyRides(seed.history), flexRide];
          if (rides.length <= transferLimit + 1 && !hasForwardSameTripContinuation(rides)) {
            const egress = { fromCoord: flexibleDrop.coord, toCoord: destination,
              meters: flexibleDrop.distanceToDestinationMeters, purpose: 'egress' };
            const candidate = { id: pathIdentity(rides), rides, walks, egress, transfers: rides.length - 1,
              totalWalkMeters: Math.round(totalWalk), totalRideKm: rides.reduce((sum, ride) => sum + ride.distanceMeters, 0) / 1000,
              totalTimeMinutes: rides.reduce((sum, ride) => sum + ride.distanceMeters * 0.003, 0) + totalWalk / 80 };
            candidate.rankingMinutes = candidate.totalTimeMinutes + 5 * candidate.transfers;
            const map = candidate.transfers === 0 ? direct : transfers;
            const key = candidateIdentity(rides);
            if (!map.has(key) || compareCandidates(candidate, map.get(key)) < 0) map.set(key, candidate);
            if (candidate.transfers > 0 && transfers.size > 8) {
              const worst = [...transfers.values()].sort(compareCandidates).pop();
              const worstKey = [...transfers].find(([, value]) => value === worst)?.[0];
              if (worstKey) transfers.delete(worstKey);
            }
          }
        }
      }
      for (let toIndex = fromIndex + 1; toIndex < trip.calls.length; toIndex++) {
        scannedCalls++;
        if (scannedCalls % 20000 === 0) yield { phase: 'working' };
        const toCall = trip.calls[toIndex];
        if (!toCall.canAlight) continue;
        const rideMeters = Math.max(0, Number(toCall.distanceMeters) - Number(fromCall.distanceMeters));
        const ride = { trip, from: fromCall, to: toCall, fromIndex, toIndex };
        const nextWalkMeters = seed.walkMeters;
        const nextRideMeters = seed.rideMeters + rideMeters;
        const history = { parent: seed.history, ride };
        const label = { stopId: toCall.stopId, history, ridesCount: seed.ridesCount + 1, walks: seed.walks, walkMeters: nextWalkMeters,
          rideMeters: nextRideMeters, round: round + 1 };

      const egressMeters = distanceToDestination(toCall.stopId);
        const totalWalk = nextWalkMeters + egressMeters;
        if (egressMeters <= opts.maxWalkMeters && totalWalk <= totalLimit) {
          const egress = { fromCoord: coordFor(toCall.stopId), toCoord: destination, meters: egressMeters, purpose: 'egress' };
          const rides = historyRides(history);
          if (rides.length <= 1 || !hasForwardSameTripContinuation(rides)) {
            const id = identityOf(label);
            const rideMetersTotal = nextRideMeters;
            const totalTimeMinutes = rideMetersTotal / 1000 * 3 + totalWalk / 80;
            const candidate = { id, rides, walks: seed.walks, egress, transfers: rides.length - 1,
              totalWalkMeters: Math.round(totalWalk), totalRideKm: rideMetersTotal / 1000,
              totalTimeMinutes, rankingMinutes: totalTimeMinutes + 5 * (rides.length - 1) };
            const map = candidate.transfers === 0 ? direct : transfers;
            const key = candidateIdentity(rides);
            if (!map.has(key) || compareCandidates(candidate, map.get(key)) < 0) map.set(key, candidate);
            if (candidate.transfers > 0 && transfers.size > 8) {
              const worst = [...transfers.values()].sort(compareCandidates).pop();
              const worstKey = [...transfers].find(([, value]) => value === worst)?.[0];
              if (worstKey) transfers.delete(worstKey);
            }
          }
        }

        if (round < transferLimit && label.walkMeters <= totalLimit) addPareto(alightFrontier, label);
      }
      }
    }
    if (round === 0) {
      const directRoutes = rank(direct, 15);
      yield { phase: 'direct', plan: { status: 'calculating', directRoutes, transferRoutes: [], progressive: true,
        metadata: { networkVersion: index.version, eligibleTrips: eligible.length, scannedCalls, expandedLabels, prunedByBound,
          invalidTrips: index.rejectedTrips, flexibleProjectionSkips } } };
    }
    const nextByStop = new Map();
    for (const labels of alightFrontier.values()) for (const label of labels) {
      const alightCoord = coordFor(label.stopId);
      for (const nearby of nearbyByStop(label.stopId, opts.maxTransferWalkMeters)) {
        const interwalk = distanceMeters(alightCoord, [Number(nearby.stop.lat), Number(nearby.stop.lng)]);
        const alightStop = index.stopsById.get(label.stopId);
        if (alightStop?.transferAccessVerified === false || nearby.stop.transferAccessVerified === false) continue;
        if (label.walkMeters + interwalk > totalLimit || !(eligibleBoardings.get(nearby.stop.id) || []).length) continue;
        const nextSeed = { stopId: nearby.stop.id, history: label.history, ridesCount: label.ridesCount,
          walks: [...label.walks, { fromCoord: alightCoord, toCoord: [Number(nearby.stop.lat), Number(nearby.stop.lng)], meters: interwalk, purpose: 'transfer' }],
          walkMeters: label.walkMeters + interwalk, rideMeters: label.rideMeters };
        addPareto(nextByStop, nextSeed);
      }
    }
    seeds = [...nextByStop.values()].flat();
  }

  const directRoutes = rank(direct, 15);
  const transferRoutes = rank(transfers, 8);
  return { status: directRoutes.length || transferRoutes.length ? 'ok' : 'no-service', directRoutes, transferRoutes,
    metadata: { networkVersion: index.version, historical: index.network.metadata?.historical !== false,
      servicesVerified: index.network.metadata?.servicesVerified === true, eligibleTrips: eligible.length,
      scannedCalls, expandedLabels, prunedByBound, invalidTrips: index.rejectedTrips,
      flexibleProjectionSkips,
      transferPenaltyMinutes: 5, waitingTimeKnown: false } };
}

export function planJourney(originCoord, destinationCoord, network, options = {}) {
  const steps = planJourneySteps(originCoord, destinationCoord, network, options);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

export async function planJourneyProgressive(originCoord, destinationCoord, network, options = {}, { onProgress, signal } = {}) {
  const abortError = () => Object.assign(new Error('The planner search was cancelled'), { name: 'AbortError' });
  const steps = planJourneySteps(originCoord, destinationCoord, network, options, () => Boolean(signal?.aborted));
  while (true) {
    if (signal?.aborted) throw abortError();
    const step = steps.next();
    if (signal?.aborted) throw abortError();
    if (step.done) return step.value;
    if (typeof onProgress === 'function') onProgress(step.value);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
