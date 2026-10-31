import * as turf from '@turf/turf';

export function rideLegs(journey) {
  return (journey?.legs || []).filter(leg => leg.kind === 'ride');
}

export function journeyId(journey) {
  if (journey?.id) return journey.id;
  return rideLegs(journey).map(leg => `${leg.tripId}:${leg.fromSequence}-${leg.toSequence}`).join('|');
}

export function matchesVehicle(route, vehicle = 'ALL') {
  if (vehicle === 'ALL') return true;
  if (vehicle === 'Microbus') return ['Microbus', 'Box', 'Tomnaya'].includes(route?.vehicle);
  return route?.vehicle === vehicle;
}

export function supportsFlexibleAlighting(route) {
  return route?.supportsFlexibleAlighting !== false && route?.boardingMode !== 'fixed-station' && route?.vehicle !== 'Metro';
}

export function relinkJourney(journey, routesById) {
  if (!journey) return journey;
  const getRoute = id => routesById?.get?.(id) || routesById?.[id];
  return { ...journey, legs: (journey.legs || []).map(leg => leg.kind === 'ride'
    ? { ...leg, route: getRoute(leg.route?.id) || leg.route }
    : { ...leg }) };
}

const GEOMETRY_CONTEXT_LIMIT = 24;
const PROJECTION_CACHE_LIMIT = 64;
const geometryContexts = new Map();
const GEOMETRY_BOUNDS_LIMIT = 256;
const geometryBounds = new Map();

function rememberBounded(map, key, value, limit = PROJECTION_CACHE_LIMIT) {
  map.delete(key);
  map.set(key, value);
  if (map.size > limit) map.delete(map.keys().next().value);
  return value;
}

export function getJourneyGeometryContext(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const cached = geometryContexts.get(coords);
  if (cached) {
    geometryContexts.delete(coords);
    geometryContexts.set(coords, cached);
    return cached;
  }
  const line = turf.lineString(coords.map(([lat, lng]) => [lng, lat]));
  const coordinates = line.geometry.coordinates;
  const lengths = [0];
  const segments = [];
  for (let index = 1; index < coordinates.length; index++) {
    segments.push(turf.lineString([coordinates[index - 1], coordinates[index]]));
    lengths.push(lengths[index - 1] + turf.distance(turf.point(coordinates[index - 1]), turf.point(coordinates[index]), { units: 'kilometers' }));
  }
  const context = { line, lengths, segments, ambiguousByCoord: new Map(), startCandidatesByCoord: new Map() };
  geometryContexts.set(coords, context);
  if (geometryContexts.size > GEOMETRY_CONTEXT_LIMIT) geometryContexts.delete(geometryContexts.keys().next().value);
  return context;
}

export function geometryMayBeWithinMeters(coords, point, radiusMeters) {
  if (!Array.isArray(coords) || !coords.length || !Array.isArray(point) || !Number.isFinite(radiusMeters) || radiusMeters < 0) return true;
  let bounds = geometryBounds.get(coords);
  if (!bounds) {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    let conservative = true;
    let maxSegmentMeters = 0;
    let previous = null;
    for (const coord of coords) {
      if (!Array.isArray(coord) || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) return true;
      minLat = Math.min(minLat, coord[0]); maxLat = Math.max(maxLat, coord[0]);
      minLng = Math.min(minLng, coord[1]); maxLng = Math.max(maxLng, coord[1]);
      if (Math.abs(coord[0]) > 80 || Math.abs(coord[1]) > 170) conservative = false;
      if (previous) {
        const segmentMeters = turf.distance(turf.point([previous[1], previous[0]]), turf.point([coord[1], coord[0]]), { units: 'kilometers' }) * 1000;
        maxSegmentMeters = Math.max(maxSegmentMeters, segmentMeters);
        if (segmentMeters > 10000) conservative = false;
      }
      previous = coord;
    }
    if (maxLng - minLng > 180) conservative = false;
    const arcSlackMeters = maxSegmentMeters ** 2 / (8 * 6371000) * 2 + 5;
    bounds = { minLat, maxLat, minLng, maxLng, conservative, arcSlackMeters };
    rememberBounded(geometryBounds, coords, bounds, GEOMETRY_BOUNDS_LIMIT);
  }
  if (!bounds.conservative) return true;
  const conservativeRadius = radiusMeters + bounds.arcSlackMeters;
  const latSlack = conservativeRadius / 110000;
  const lngSlack = conservativeRadius / Math.max(10000, 90000 * Math.cos(point[0] * Math.PI / 180));
  if (point[0] < bounds.minLat - latSlack || point[0] > bounds.maxLat + latSlack) return false;
  return [-360, 0, 360].some(offset => {
    const lng = point[1] + offset;
    return lng >= bounds.minLng - lngSlack && lng <= bounds.maxLng + lngSlack;
  });
}

export function journeyRidePath(leg, geometries = {}) {
  const fallback = { path: leg?.path || [leg?.fromCoord, leg?.toCoord].filter(Boolean), estimated: true };
  const coords = geometries?.[leg?.route?.id];
  if (!Array.isArray(coords) || coords.length < 2 || !Array.isArray(leg?.fromCoord) || !Array.isArray(leg?.toCoord)) return fallback;
  try {
    const context = getJourneyGeometryContext(coords);
    const { line, lengths, segments } = context;
    const ambiguousOccurrence = coord => {
      const key = `${coord[0]},${coord[1]}`;
      if (context.ambiguousByCoord.has(key)) return context.ambiguousByCoord.get(key);
      const endpoint = [coord[1], coord[0]];
      const occurrences = [];
      for (let index = 0; index < segments.length; index++) {
        const projection = turf.nearestPointOnLine(segments[index], endpoint, { units: 'kilometers' });
        if (Number(projection.properties.dist) <= 0.02) {
          occurrences.push(lengths[index] + Number(projection.properties.location));
        }
      }
      const ambiguous = occurrences.some((location, index) => occurrences.slice(index + 1).some(other => Math.abs(other - location) > 0.1));
      return rememberBounded(context.ambiguousByCoord, key, ambiguous);
    };
    if (ambiguousOccurrence(leg.fromCoord) || ambiguousOccurrence(leg.toCoord)) return fallback;
    const from = turf.nearestPointOnLine(line, [leg.fromCoord[1], leg.fromCoord[0]], { units: 'kilometers' });
    const to = turf.nearestPointOnLine(line, [leg.toCoord[1], leg.toCoord[0]], { units: 'kilometers' });
    const fromKm = Number(from.properties.location);
    const toKm = Number(to.properties.location);
    if (!Number.isFinite(fromKm) || !Number.isFinite(toKm) || toKm <= fromKm || from.properties.dist > 0.2 || to.properties.dist > 0.2) return fallback;
    const segment = turf.lineSliceAlong(line, fromKm, toKm, { units: 'kilometers' });
    const path = (segment.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
    return path.length >= 2 ? { path, estimated: leg.route?.geometryEstimated === true } : fallback;
  } catch (_error) {
    return fallback;
  }
}

export function nearestPointOnRidePath(path, destinationCoord, fromCoord, expectedStartFraction = 0) {
  if (!Array.isArray(path) || path.length < 2 || !Array.isArray(destinationCoord) || !Array.isArray(fromCoord)) return null;
  try {
    const context = getJourneyGeometryContext(path);
    const { line, lengths: segmentLengths, segments } = context;
    const coordinates = line.geometry.coordinates;
    const totalKm = turf.length(line, { units: 'kilometers' });
    if (!Number.isFinite(totalKm) || totalKm <= 0) return null;
    const startPoint = [fromCoord[1], fromCoord[0]];
    const startKey = `${fromCoord[0]},${fromCoord[1]}`;
    let startCandidates = context.startCandidatesByCoord.get(startKey);
    if (!startCandidates) {
      startCandidates = [];
      for (let index = 0; index < segments.length; index++) {
        const projection = turf.nearestPointOnLine(segments[index], startPoint, { units: 'kilometers' });
        const distKm = Number(projection.properties.dist);
        if (Number.isFinite(distKm) && distKm <= 0.2) {
          startCandidates.push({ location: segmentLengths[index] + Number(projection.properties.location), distKm });
        }
      }
      rememberBounded(context.startCandidatesByCoord, startKey, startCandidates);
    }
    const startKm = [...startCandidates].sort((a, b) => Math.abs(a.location / totalKm - expectedStartFraction) - Math.abs(b.location / totalKm - expectedStartFraction) || a.distKm - b.distKm)[0]?.location;
    if (!Number.isFinite(startKm) || startKm >= totalKm) return null;
    const remainingPath = turf.lineSliceAlong(line, startKm, totalKm, { units: 'kilometers' });
    const nearest = turf.nearestPointOnLine(remainingPath, [destinationCoord[1], destinationCoord[0]], { units: 'kilometers' });
    const alongKm = Number(nearest.properties.location);
    if (!Number.isFinite(alongKm) || alongKm <= 0) return null;
    const segment = turf.lineSliceAlong(remainingPath, 0, alongKm, { units: 'kilometers' });
    const ridePath = (segment.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
    if (ridePath.length < 2) return null;
    return {
      coord: [nearest.geometry.coordinates[1], nearest.geometry.coordinates[0]],
      distanceToDestinationMeters: Math.round(Number(nearest.properties.dist) * 1000),
      fraction: Math.min(1, Math.max(0, alongKm / (totalKm - startKm))),
      path: ridePath
    };
  } catch (_error) {
    return null;
  }
}
