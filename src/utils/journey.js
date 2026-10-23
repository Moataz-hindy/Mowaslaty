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

export function relinkJourney(journey, routesById) {
  if (!journey) return journey;
  const getRoute = id => routesById?.get?.(id) || routesById?.[id];
  return { ...journey, legs: (journey.legs || []).map(leg => leg.kind === 'ride'
    ? { ...leg, route: getRoute(leg.route?.id) || leg.route }
    : { ...leg }) };
}
export function journeyRidePath(leg, geometries = {}) {
  const fallback = { path: leg?.path || [leg?.fromCoord, leg?.toCoord].filter(Boolean), estimated: true };
  const coords = geometries?.[leg?.route?.id];
  if (!Array.isArray(coords) || coords.length < 2 || !Array.isArray(leg?.fromCoord) || !Array.isArray(leg?.toCoord)) return fallback;
  try {
    const line = turf.lineString(coords.map(([lat, lng]) => [lng, lat]));
    const lengths = [0];
    for (let index = 1; index < line.geometry.coordinates.length; index++) {
      lengths.push(lengths[index - 1] + turf.distance(turf.point(line.geometry.coordinates[index - 1]), turf.point(line.geometry.coordinates[index]), { units: 'kilometers' }));
    }
    const ambiguousOccurrence = coord => {
      const endpoint = [coord[1], coord[0]];
      const occurrences = [];
      for (let index = 1; index < line.geometry.coordinates.length; index++) {
        const segment = turf.lineString([line.geometry.coordinates[index - 1], line.geometry.coordinates[index]]);
        const projection = turf.nearestPointOnLine(segment, endpoint, { units: 'kilometers' });
        if (Number(projection.properties.dist) <= 0.02) {
          occurrences.push(lengths[index - 1] + Number(projection.properties.location));
        }
      }
      return occurrences.some((location, index) => occurrences.slice(index + 1).some(other => Math.abs(other - location) > 0.1));
    };
    if (ambiguousOccurrence(leg.fromCoord) || ambiguousOccurrence(leg.toCoord)) return fallback;
    const from = turf.nearestPointOnLine(line, [leg.fromCoord[1], leg.fromCoord[0]], { units: 'kilometers' });
    const to = turf.nearestPointOnLine(line, [leg.toCoord[1], leg.toCoord[0]], { units: 'kilometers' });
    const fromKm = Number(from.properties.location);
    const toKm = Number(to.properties.location);
    if (!Number.isFinite(fromKm) || !Number.isFinite(toKm) || toKm <= fromKm || from.properties.dist > 0.2 || to.properties.dist > 0.2) return fallback;
    const segment = turf.lineSliceAlong(line, fromKm, toKm, { units: 'kilometers' });
    const path = (segment.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
    return path.length >= 2 ? { path, estimated: false } : fallback;
  } catch (_error) {
    return fallback;
  }
}

export function nearestPointOnRidePath(path, destinationCoord, fromCoord, expectedStartFraction = 0) {
  if (!Array.isArray(path) || path.length < 2 || !Array.isArray(destinationCoord) || !Array.isArray(fromCoord)) return null;
  try {
    const line = turf.lineString(path.map(([lat, lng]) => [lng, lat]));
    const coordinates = line.geometry.coordinates;
    const totalKm = turf.length(line, { units: 'kilometers' });
    if (!Number.isFinite(totalKm) || totalKm <= 0) return null;
    const startPoint = [fromCoord[1], fromCoord[0]];
    const segmentLengths = [0];
    for (let index = 1; index < coordinates.length; index++) {
      segmentLengths.push(segmentLengths[index - 1] + turf.distance(turf.point(coordinates[index - 1]), turf.point(coordinates[index]), { units: 'kilometers' }));
    }
    const startCandidates = [];
    for (let index = 1; index < coordinates.length; index++) {
      const segmentLine = turf.lineString([coordinates[index - 1], coordinates[index]]);
      const projection = turf.nearestPointOnLine(segmentLine, startPoint, { units: 'kilometers' });
      const distKm = Number(projection.properties.dist);
      if (Number.isFinite(distKm) && distKm <= 0.2) {
        startCandidates.push({ location: segmentLengths[index - 1] + Number(projection.properties.location), distKm });
      }
    }
    startCandidates.sort((a, b) => Math.abs(a.location / totalKm - expectedStartFraction) - Math.abs(b.location / totalKm - expectedStartFraction) || a.distKm - b.distKm);
    const startKm = startCandidates[0]?.location;
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
