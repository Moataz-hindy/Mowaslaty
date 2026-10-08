import * as turf from '@turf/turf';

// Major Cairo Transit Transfer Hubs for multi-leg journeys
export const CAIRO_TRANSFER_HUBS = [
  { id: 'ramses', name_ar: 'ميدان رمسيس', name_en: 'Ramses Square', coord: [30.0622, 31.2468] },
  { id: 'tahrir', name_ar: 'ميدان التحرير / عبد المنعم رياض', name_en: 'Tahrir / Abd El Moneim Riad', coord: [30.0444, 31.2357] },
  { id: 'giza_sq', name_ar: 'ميدان الجيزة', name_en: 'Giza Square', coord: [30.0124, 31.2085] },
  { id: 'abbasseya', name_ar: 'ميدان العباسية', name_en: 'Abbasseya Square', coord: [30.0682, 31.2825] },
  { id: 'ataba', name_ar: 'ميدان العتبة', name_en: 'Ataba Square', coord: [30.0523, 31.2482] },
  { id: 'roxy', name_ar: 'ميدان روكسي (مصر الجديدة)', name_en: 'Roxy Square', coord: [30.0936, 31.3144] },
  { id: 'salam', name_ar: 'موقف السلام (موقف العاشر)', name_en: 'Salam Station (10th of Ramadan)', coord: [30.1542, 31.4095] },
  { id: 'kitkat', name_ar: 'ميدان الكيت كات (إمبابة)', name_en: 'Kit Kat Square', coord: [30.0657, 31.2135] }
];

/**
 * Fast Bounding Box check helper
 */
function boundsCoverPoint(bounds, lat, lng, bufferDeg) {
  if (!bounds) return false;
  return (
    lat >= bounds[0][0] - bufferDeg &&
    lat <= bounds[1][0] + bufferDeg &&
    lng >= bounds[0][1] - bufferDeg &&
    lng <= bounds[1][1] + bufferDeg
  );
}

/**
 * Ultra-fast A-to-B journey planner with strict O(N) bounding-box pre-filtering
 */
export function planJourney(originCoord, destCoord, routesSummary, routesGeometry, stopsSummary = [], maxWalkDistance = 1200) {
  if (!originCoord || !destCoord || !routesGeometry || routesSummary.length === 0) {
    return { directRoutes: [], transferRoutes: [] };
  }

  const [oLat, oLng] = originCoord;
  const [dLat, dLng] = destCoord;

  const originPoint = turf.point([oLng, oLat]);
  const destPoint = turf.point([dLng, dLat]);

  const degBuffer = (maxWalkDistance / 1000) * 0.01;

  const directResults = [];

  // 1. Direct Routes Search (only routes whose bounding box covers BOTH Origin and Dest)
  for (const route of routesSummary) {
    const coversOrigin = boundsCoverPoint(route.bounds, oLat, oLng, degBuffer);
    const coversDest = boundsCoverPoint(route.bounds, dLat, dLng, degBuffer);

    if (!coversOrigin || !coversDest) continue;

    const coords = routesGeometry[route.id];
    if (!coords || coords.length < 2) continue;

    try {
      const turfCoords = coords.map(c => [c[1], c[0]]);
      const line = turf.lineString(turfCoords);

      const pickupNearest = turf.nearestPointOnLine(line, originPoint, { units: 'kilometers' });
      const dropNearest = turf.nearestPointOnLine(line, destPoint, { units: 'kilometers' });

      const walkToPickup = Math.round(pickupNearest.properties.dist * 1000);
      const walkFromDrop = Math.round(dropNearest.properties.dist * 1000);

      if (walkToPickup > maxWalkDistance || walkFromDrop > maxWalkDistance) continue;

      const pickupIndex = pickupNearest.properties.location;
      const dropIndex = dropNearest.properties.location;

      // Must be traveled in correct direction
      if (pickupIndex >= dropIndex) continue;

      const rideDistanceKm = Math.round((dropIndex - pickupIndex) * 10) / 10;
      const estRideMinutes = Math.max(5, Math.round(rideDistanceKm * 3));
      const walkToPickupMinutes = Math.max(1, Math.round(walkToPickup / 80));
      const walkFromDropMinutes = Math.max(1, Math.round(walkFromDrop / 80));
      const totalTimeMinutes = walkToPickupMinutes + estRideMinutes + walkFromDropMinutes;

      directResults.push({
        type: 'direct',
        route,
        pickupCoord: [pickupNearest.geometry.coordinates[1], pickupNearest.geometry.coordinates[0]],
        dropCoord: [dropNearest.geometry.coordinates[1], dropNearest.geometry.coordinates[0]],
        walkToPickupMeters: walkToPickup,
        walkFromDropMeters: walkFromDrop,
        totalWalkMeters: walkToPickup + walkFromDrop,
        rideDistanceKm,
        walkToPickupMinutes,
        walkFromDropMinutes,
        estRideMinutes,
        totalTimeMinutes
      });
    } catch (e) {}
  }

  directResults.sort((a, b) => a.totalWalkMeters - b.totalWalkMeters);

  // 2. Transfer Routes (Only if direct routes are few, and strictly bounding-box pruned!)
  const transferResults = [];

  if (directResults.length < 3) {
    const hubBuffer = 0.008; // ~800m buffer for hubs

    for (const hub of CAIRO_TRANSFER_HUBS) {
      const [hLat, hLng] = hub.coord;
      const hubPoint = turf.point([hLng, hLat]);

      // Only check routes that cover Origin AND Hub for Leg 1
      const leg1Candidates = routesSummary.filter(r => 
        boundsCoverPoint(r.bounds, oLat, oLng, degBuffer) &&
        boundsCoverPoint(r.bounds, hLat, hLng, hubBuffer)
      );

      // Only check routes that cover Hub AND Dest for Leg 2
      const leg2Candidates = routesSummary.filter(r => 
        boundsCoverPoint(r.bounds, hLat, hLng, hubBuffer) &&
        boundsCoverPoint(r.bounds, dLat, dLng, degBuffer)
      );

      if (leg1Candidates.length === 0 || leg2Candidates.length === 0) continue;

      // Evaluate best leg 1
      let bestLeg1 = null;
      for (const r of leg1Candidates.slice(0, 5)) {
        const coords = routesGeometry[r.id];
        if (!coords) continue;
        try {
          const line = turf.lineString(coords.map(c => [c[1], c[0]]));
          const pOrig = turf.nearestPointOnLine(line, originPoint, { units: 'kilometers' });
          const pHub = turf.nearestPointOnLine(line, hubPoint, { units: 'kilometers' });

          if (pOrig.properties.dist * 1000 <= maxWalkDistance && pHub.properties.dist * 1000 <= 600) {
            if (pOrig.properties.location < pHub.properties.location) {
              bestLeg1 = {
                route: r,
                pickupCoord: [pOrig.geometry.coordinates[1], pOrig.geometry.coordinates[0]],
                walkMeters: Math.round(pOrig.properties.dist * 1000),
                rideKm: Math.round((pHub.properties.location - pOrig.properties.location) * 10) / 10
              };
              break;
            }
          }
        } catch (e) {}
      }

      // Evaluate best leg 2
      let bestLeg2 = null;
      for (const r of leg2Candidates.slice(0, 5)) {
        const coords = routesGeometry[r.id];
        if (!coords) continue;
        try {
          const line = turf.lineString(coords.map(c => [c[1], c[0]]));
          const pHub = turf.nearestPointOnLine(line, hubPoint, { units: 'kilometers' });
          const pDest = turf.nearestPointOnLine(line, destPoint, { units: 'kilometers' });

          if (pHub.properties.dist * 1000 <= 600 && pDest.properties.dist * 1000 <= maxWalkDistance) {
            if (pHub.properties.location < pDest.properties.location) {
              bestLeg2 = {
                route: r,
                destDropCoord: [pDest.geometry.coordinates[1], pDest.geometry.coordinates[0]],
                walkMeters: Math.round(pDest.properties.dist * 1000),
                rideKm: Math.round((pDest.properties.location - pHub.properties.location) * 10) / 10
              };
              break;
            }
          }
        } catch (e) {}
      }

      if (bestLeg1 && bestLeg2 && bestLeg1.route.id !== bestLeg2.route.id) {
        const totalWalk = bestLeg1.walkMeters + bestLeg2.walkMeters;
        const totalRideKm = bestLeg1.rideKm + bestLeg2.rideKm;
        const totalTime = Math.round(totalWalk / 80) + Math.round(totalRideKm * 3) + 10;

        transferResults.push({
          type: 'transfer',
          hub,
          leg1: bestLeg1,
          leg2: bestLeg2,
          totalWalkMeters: totalWalk,
          totalRideKm,
          totalTimeMinutes: totalTime
        });
      }
    }

    transferResults.sort((a, b) => a.totalTimeMinutes - b.totalTimeMinutes);
  }

  return {
    directRoutes: directResults.slice(0, 15),
    transferRoutes: transferResults.slice(0, 4)
  };
}
