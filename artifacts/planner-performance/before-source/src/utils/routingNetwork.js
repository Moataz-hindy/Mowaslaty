const INDEX_CACHE = new WeakMap();
const BUCKET_SIZE = 0.005;

export function validCoord(coord) {
  return Array.isArray(coord) && coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
    Number.isFinite(coord[0]) && Number.isFinite(coord[1]) && Math.abs(coord[0]) <= 90 && Math.abs(coord[1]) <= 180;
}

export function distanceMeters(a, b) {
  const rad = value => value * Math.PI / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const lat1 = rad(a[0]);
  const lat2 = rad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const bucketKey = (lat, lng) => `${Math.floor(lat / BUCKET_SIZE)}:${Math.floor(lng / BUCKET_SIZE)}`;

export function createRoutingIndex(network) {
  if (!network || !Array.isArray(network.stops) || !Array.isArray(network.trips)) throw new Error('Invalid routing network');
  const versionKey = String(network.version ?? 'unversioned');
  const cached = INDEX_CACHE.get(network);
  if (cached?.version === versionKey) return cached.index;

  const stopsById = new Map();
  const buckets = new Map();
  for (const stop of network.stops) {
    if (!stop?.id || !validCoord([stop.lat, stop.lng])) continue;
    stopsById.set(stop.id, stop);
    const key = bucketKey(Number(stop.lat), Number(stop.lng));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(stop);
  }

  const routesById = new Map((network.routes || []).map(route => [route.id, route]));
  const boardingByStop = new Map();
  const trips = [];
  const rejectedTrips = [];
  for (const trip of network.trips) {
    const route = trip?.route || routesById.get(trip?.appRouteId) || routesById.get(trip?.id);
    let reason = null;
    if (!trip?.id || !route?.id || !Array.isArray(trip.calls) || trip.calls.length < 2) reason = 'missing-identity-route-or-calls';
    let lastSequence = -Infinity;
    let lastDistance = -Infinity;
    if (!reason) for (const call of trip.calls) {
      if (!call || !stopsById.has(call.stopId)) { reason = 'unknown-stop'; break; }
      const sequence = Number(call.sequence);
      const distance = call.distanceMeters;
      if (!Number.isFinite(sequence) || sequence <= lastSequence) { reason = 'non-increasing-sequence'; break; }
      if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < lastDistance || distance < 0) { reason = 'invalid-cumulative-distance'; break; }
      if (typeof call.canBoard !== 'boolean' || typeof call.canAlight !== 'boolean') { reason = 'invalid-call-permission'; break; }
      lastSequence = sequence;
      lastDistance = distance;
    }
    if (reason) { rejectedTrips.push({ id: trip?.id || null, reason }); continue; }
    const calls = trip.calls;
    const indexed = { ...trip, calls, route };
    const tripIndex = trips.length;
    trips.push(indexed);
    calls.forEach((call, callIndex) => {
      if (!call.canBoard) return;
      if (!boardingByStop.has(call.stopId)) boardingByStop.set(call.stopId, []);
      boardingByStop.get(call.stopId).push({ tripIndex, callIndex, call });
    });
  }

  const index = { network, version: versionKey, stopsById, buckets, trips, boardingByStop, routesById, rejectedTrips };
  index.nearbyStops = (coord, radiusMeters) => {
    if (!validCoord(coord) || !Number.isFinite(radiusMeters) || radiusMeters < 0 || radiusMeters > 20000) return [];
    const latDelta = radiusMeters / 110900;
    const lngDelta = radiusMeters / Math.max(10000, 111000 * Math.cos(Number(coord[0]) * Math.PI / 180));
    const minLat = Math.floor((coord[0] - latDelta) / BUCKET_SIZE);
    const maxLat = Math.floor((coord[0] + latDelta) / BUCKET_SIZE);
    const minLng = Math.floor((coord[1] - lngDelta) / BUCKET_SIZE);
    const maxLng = Math.floor((coord[1] + lngDelta) / BUCKET_SIZE);
    const found = [];
    for (let lat = minLat; lat <= maxLat; lat++) for (let lng = minLng; lng <= maxLng; lng++) {
      for (const stop of buckets.get(`${lat}:${lng}`) || []) {
        const meters = distanceMeters(coord, [Number(stop.lat), Number(stop.lng)]);
        if (meters <= radiusMeters + 1e-6) found.push({ stop, meters });
      }
    }
    return found.sort((a, b) => a.meters - b.meters || a.stop.id.localeCompare(b.stop.id));
  };
  INDEX_CACHE.set(network, { version: versionKey, index });
  return index;
}
