import * as turf from '@turf/turf';

/**
 * Normalizes Arabic text for flexible matching
 */
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .trim();
}

/**
 * Parses user-provided location links (Google Maps URLs or raw coordinates)
 * Supports:
 * - https://www.google.com/maps/@lat,lng,17z
 * - https://maps.google.com/?q=lat,lng
 * - https://www.google.com/maps/place/.../!3dlat!4dlng
 * - Raw coordinates: "30.0444, 31.2357" or "30.0444 31.2357"
 * @param {string} input 
 * @returns {Array<number>|null} [lat, lng] or null
 */
export function parseLocationInput(input) {
  if (!input || typeof input !== 'string') return null;
  let str = input.trim();
  try {
    str = decodeURIComponent(str);
  } catch (e) {
    // Keep raw string if URI malformed
  }

  // 1. Google Maps @lat,lng (e.g. /@30.044421,31.235712,17z)
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return [lat, lng];
  }

  // 2. Query param q=lat,lng or ll=lat,lng or query=lat,lng or destination=lat,lng or daddr=lat,lng
  const qMatch = str.match(/[?&](?:q|ll|query|destination|daddr)=(?:loc:)?(-?\d+\.\d+)[,+](-?\d+\.\d+)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return [lat, lng];
  }

  // 3. Place Protobuf !3dlat!4dlng (Google Maps place URLs)
  const protoMatch = str.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (protoMatch) {
    const lat = parseFloat(protoMatch[1]);
    const lng = parseFloat(protoMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return [lat, lng];
  }

  // 4. OpenStreetMap URL format: #map=zoom/lat/lng or ?mlat=lat&mlon=lng
  const osmMatch = str.match(/#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/);
  if (osmMatch) {
    return [parseFloat(osmMatch[1]), parseFloat(osmMatch[2])];
  }
  const osmParamMatch = str.match(/[?&]mlat=(-?\d+\.\d+)&mlon=(-?\d+\.\d+)/);
  if (osmParamMatch) {
    return [parseFloat(osmParamMatch[1]), parseFloat(osmParamMatch[2])];
  }

  // 5. Direct path /place/lat,lng or /search/lat,lng
  const pathMatch = str.match(/\/(?:place|search)\/(-?\d+\.\d+)[,+](-?\d+\.\d+)/i);
  if (pathMatch) {
    return [parseFloat(pathMatch[1]), parseFloat(pathMatch[2])];
  }

  // 6. DMS coordinate format (e.g. 30°04'23.2"N 31°20'45.6"E)
  const dmsMatch = str.match(/(\d+)°(\d+)'([\d.]+)"\s*([NS])\s*[, ]*\s*(\d+)°(\d+)'([\d.]+)"\s*([EW])/i);
  if (dmsMatch) {
    let lat = parseInt(dmsMatch[1], 10) + parseInt(dmsMatch[2], 10) / 60 + parseFloat(dmsMatch[3]) / 3600;
    if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
    let lng = parseInt(dmsMatch[5], 10) + parseInt(dmsMatch[6], 10) / 60 + parseFloat(dmsMatch[7]) / 3600;
    if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;
    return [lat, lng];
  }

  // 7. Plain coordinate string: "30.0444, 31.2357" or "30.0444 31.2357"
  const coordMatch = str.match(/(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }

  return null;
}

/**
 * Resolves a location input string, attempting shortlink unshortening if needed.
 */
export async function resolveLocationInput(input) {
  if (!input || typeof input !== 'string') {
    return { coord: null, error: 'الرجاء إدخال رابط أو إحداثيات صالحة' };
  }

  // 1. Try immediate synchronous parsing
  const directCoord = parseLocationInput(input);
  if (directCoord) {
    return { coord: directCoord, error: null };
  }

  const trimmed = input.trim();

  // 2. If it's a shortened Google Maps link (maps.app.goo.gl or goo.gl/maps)
  if (trimmed.includes('maps.app.goo.gl') || trimmed.includes('goo.gl/maps')) {
    try {
      // Our own Cloudflare Pages Function (functions/api/expand.js)
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`/api/expand?url=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.coord)) return { coord: data.coord, error: null };
        const found = data.url ? parseLocationInput(data.url) : null;
        if (found) return { coord: found, error: null };
      }
    } catch (e) {
      // Proxy failed or network timeout
    }

    return {
      coord: null,
      isShortLink: true,
      error: 'هذا رابط مختصر (Short Link). يرجى فتحه في المتصفح ونسخ الرابط الكامل أو نسخ إحداثيات المكان (مثال: 30.0444, 31.2357).'
    };
  }

  return {
    coord: null,
    error: 'لم نتمكن من استخراج الإحداثيات. يرجى لصق رابط خرائط Google كامل أو كتابة الإحداثيات (مثال: 30.0444, 31.2357).'
  };
}

/**
 * Calculates nearest bus drop-off points for a given target coordinate [lat, lng]
 * 
 * @param {Array<number>} targetCoord [lat, lng]
 * @param {Array<Object>} routesSummary Array of route metadata
 * @param {Object} routesGeometry Map of trip_id -> [[lat, lng], ...]
 * @param {Array<Object>} stopsSummary Array of stops
 * @param {number} maxDistanceMeters Maximum walking radius to consider (e.g. 2000m)
 * @returns {Array<Object>} Ranked list of nearest route options
 */
export function findNearestDropPoints(targetCoord, routesSummary, routesGeometry, stopsSummary = [], maxDistanceMeters = 2000) {
  if (!targetCoord || !routesGeometry) return [];

  const [tLat, tLng] = targetCoord;
  const targetPoint = turf.point([tLng, tLat]);

  // Buffer in degrees (~0.02 deg is approx 2.2 km)
  const degBuffer = (maxDistanceMeters / 1000) * 0.01;

  const candidates = [];

  for (const route of routesSummary) {
    const bounds = route.bounds;
    if (!bounds) continue;

    // Fast Bounding Box pruning
    const minLat = bounds[0][0] - degBuffer;
    const minLng = bounds[0][1] - degBuffer;
    const maxLat = bounds[1][0] + degBuffer;
    const maxLng = bounds[1][1] + degBuffer;

    if (tLat < minLat || tLat > maxLat || tLng < minLng || tLng > maxLng) {
      continue;
    }

    const coords = routesGeometry[route.id];
    if (!coords || coords.length < 2) continue;

    // Turf expects coordinates in [lng, lat]
    const turfCoords = coords.map(c => [c[1], c[0]]);
    const line = turf.lineString(turfCoords);

    try {
      const nearest = turf.nearestPointOnLine(line, targetPoint, { units: 'kilometers' });
      let distMeters = Math.round(nearest.properties.dist * 1000);

      if (distMeters <= maxDistanceMeters) {
        let dropLng = nearest.geometry.coordinates[0];
        let dropLat = nearest.geometry.coordinates[1];

        // Smart Stop Snapping: snap to recognized bus stop along/near the line (< 250m)
        let nearestStopName = null;
        if (stopsSummary && stopsSummary.length > 0) {
          let closestStop = null;
          let closestStopDist = 250;
          for (const stop of stopsSummary) {
            if (Math.abs(stop.lat - dropLat) > 0.0035 || Math.abs(stop.lng - dropLng) > 0.0035) {
              continue;
            }
            const stopDist = turf.distance(
              turf.point([dropLng, dropLat]),
              turf.point([stop.lng, stop.lat]),
              { units: 'meters' }
            );
            if (stopDist < closestStopDist) {
              closestStopDist = stopDist;
              closestStop = stop;
            }
          }

          if (closestStop) {
            dropLat = closestStop.lat;
            dropLng = closestStop.lng;
            distMeters = Math.round(turf.distance(
              turf.point([dropLng, dropLat]),
              targetPoint,
              { units: 'meters' }
            ));
            nearestStopName = {
              ar: closestStop.name_ar,
              en: closestStop.name_en,
              id: closestStop.id,
              distMeters: 0,
              isOfficialStop: true
            };
          } else {
            // Find closest named stop for context (up to 400m)
            let refDist = 400;
            for (const stop of stopsSummary) {
              if (Math.abs(stop.lat - dropLat) > 0.005 || Math.abs(stop.lng - dropLng) > 0.005) continue;
              const d = turf.distance(
                turf.point([dropLng, dropLat]),
                turf.point([stop.lng, stop.lat]),
                { units: 'meters' }
              );
              if (d < refDist) {
                refDist = d;
                nearestStopName = {
                  ar: stop.name_ar,
                  en: stop.name_en,
                  id: stop.id,
                  distMeters: Math.round(d),
                  isOfficialStop: false
                };
              }
            }
          }
        }

        // Estimated walking speed: ~80 meters per minute (4.8 km/h)
        const walkMinutes = Math.max(1, Math.round(distMeters / 80));

        candidates.push({
          route,
          distanceMeters: distMeters,
          walkMinutes,
          dropCoord: [dropLat, dropLng],
          targetCoord: [tLat, tLng],
          nearestStop: nearestStopName
        });
      }
    } catch (e) {
      // Skip invalid geometries
    }
  }

  // Sort by shortest walking distance first
  candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);

  // Return top 25 closest lines
  return candidates.slice(0, 25);
}

/**
 * Calculates the exact closest drop-off point on a specific chosen route to the target destination
 * Snaps to recognized official bus stops within 250m when available.
 * 
 * @param {Array<number>} targetCoord [lat, lng]
 * @param {Object} route Route metadata object
 * @param {Array<Array<number>>} coords Array of [lat, lng] for the route geometry
 * @param {Array<Object>} stopsSummary Array of all stops
 * @returns {Object|null}
 */
export function calculateRouteDropPoint(targetCoord, route, coords, stopsSummary = []) {
  if (!targetCoord || !route || !coords || coords.length === 0) return null;

  try {
    const [tLat, tLng] = targetCoord;
    const targetPoint = turf.point([tLng, tLat]);

    // Turf expects coordinates in [lng, lat]
    const turfCoords = coords.map(c => [c[1], c[0]]);
    const line = turf.lineString(turfCoords);

    const nearest = turf.nearestPointOnLine(line, targetPoint, { units: 'kilometers' });
    let distMeters = Math.round(nearest.properties.dist * 1000);
    let dropLng = nearest.geometry.coordinates[0];
    let dropLat = nearest.geometry.coordinates[1];

    // Smart Stop Snapping (< 250m): if an official stop is near the drop coordinate, snap to it!
    let nearestStopName = null;
    if (stopsSummary && stopsSummary.length > 0) {
      let closestStop = null;
      let closestStopDist = 250;
      for (const stop of stopsSummary) {
        if (Math.abs(stop.lat - dropLat) > 0.0035 || Math.abs(stop.lng - dropLng) > 0.0035) {
          continue;
        }
        const stopDist = turf.distance(
          turf.point([dropLng, dropLat]),
          turf.point([stop.lng, stop.lat]),
          { units: 'meters' }
        );
        if (stopDist < closestStopDist) {
          closestStopDist = stopDist;
          closestStop = stop;
        }
      }

      if (closestStop) {
        dropLat = closestStop.lat;
        dropLng = closestStop.lng;
        distMeters = Math.round(turf.distance(
          turf.point([dropLng, dropLat]),
          targetPoint,
          { units: 'meters' }
        ));
        nearestStopName = {
          ar: closestStop.name_ar,
          en: closestStop.name_en,
          id: closestStop.id,
          distMeters: 0,
          isOfficialStop: true
        };
      } else {
        // Fallback: look within 500m for reference name only
        let refDist = 500;
        for (const stop of stopsSummary) {
          if (Math.abs(stop.lat - dropLat) > 0.006 || Math.abs(stop.lng - dropLng) > 0.006) continue;
          const d = turf.distance(
            turf.point([dropLng, dropLat]),
            turf.point([stop.lng, stop.lat]),
            { units: 'meters' }
          );
          if (d < refDist) {
            refDist = d;
            nearestStopName = {
              ar: stop.name_ar,
              en: stop.name_en,
              id: stop.id,
              distMeters: Math.round(d),
              isOfficialStop: false
            };
          }
        }
      }
    }

    const walkMinutes = Math.max(1, Math.round(distMeters / 80));

    return {
      route,
      distanceMeters: distMeters,
      estimatedStreetMeters: Math.round(distMeters * 1.25),
      walkMinutes,
      dropCoord: [dropLat, dropLng],
      targetCoord: [tLat, tLng],
      nearestStop: nearestStopName
    };
  } catch (e) {
    return null;
  }
}

const walkingCache = new Map();

/**
 * Fetches real pedestrian street walking route from public OSRM API.
 * Detects barrier/wall detour anomalies (e.g. enclosed parks like Al Azhar Park, university campuses)
 * where OSRM generates extreme perimeter detours, and provides a direct pedestrian access fallback.
 * 
 * @param {Array<number>} startCoord [lat, lng]
 * @param {Array<number>} endCoord [lat, lng]
 * @returns {Promise<{ path: Array<Array<number>>, distanceMeters: number, durationMinutes: number, isDetourAnomalous?: boolean, detourRatio?: number, straightDistanceMeters?: number, osrmDistanceMeters?: number, osrmPath?: Array<Array<number>> } | null>}
 */
export async function fetchWalkingRoute(startCoord, endCoord) {
  if (!startCoord || !endCoord) return null;
  const [sLat, sLng] = startCoord;
  const [eLat, eLng] = endCoord;

  const key = `${sLat.toFixed(5)},${sLng.toFixed(5)}->${eLat.toFixed(5)},${eLng.toFixed(5)}`;
  if (walkingCache.has(key)) {
    return walkingCache.get(key);
  }

  // Calculate straight-line Euclidean/geodesic distance in meters
  const straightDist = Math.round(
    turf.distance(turf.point([sLng, sLat]), turf.point([eLng, eLat]), { units: 'meters' })
  );

  // If already at or very close to destination (< 15 meters)
  if (straightDist < 15) {
    const res = {
      path: [startCoord, endCoord],
      distanceMeters: straightDist,
      durationMinutes: 1,
      straightDistanceMeters: straightDist,
      isDetourAnomalous: false
    };
    walkingCache.set(key, res);
    return res;
  }

  try {
    // Our own Cloudflare Pages Function (functions/api/walk.js), which calls
    // openrouteservice with a secret key and returns an OSRM-shaped response.
    const url = `/api/walk?from=${sLng},${sLat}&to=${eLng},${eLat}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        const r = data.routes[0];
        const osrmDist = Math.round(r.distance);
        const osrmPath = r.geometry.coordinates.map(c => [c[1], c[0]]); // Leaflet [lat, lng]
        const detourRatio = osrmDist / Math.max(straightDist, 1);

        // Detect barrier/wall detour anomaly:
        // E.g. straight line is 200m, but OSRM routes 2,800m or 6,200m around stone perimeter walls!
        // In urban walking, detours exceeding 2.0x AND > 350m extra are wall/perimeter anomalies.
        const isDetourAnomalous = osrmDist > Math.max(straightDist * 1.9, straightDist + 350);

        if (isDetourAnomalous) {
          // Provide clean direct pedestrian access as primary path, with detour alert
          const realisticDirectDist = Math.round(straightDist * 1.15);
          const result = {
            path: [startCoord, endCoord],
            osrmPath,
            distanceMeters: realisticDirectDist,
            durationMinutes: Math.max(1, Math.round(realisticDirectDist / 75)),
            straightDistanceMeters: straightDist,
            osrmDistanceMeters: osrmDist,
            detourRatio: parseFloat(detourRatio.toFixed(1)),
            isDetourAnomalous: true
          };
          walkingCache.set(key, result);
          return result;
        }

        const result = {
          path: osrmPath,
          distanceMeters: osrmDist,
          durationMinutes: Math.max(1, Math.round(r.duration / 60)),
          straightDistanceMeters: straightDist,
          isDetourAnomalous: false
        };
        walkingCache.set(key, result);
        return result;
      }
    }
  } catch (e) {
    // Network failure or timeout -> fallback gracefully
  }

  // Graceful direct fallback
  const fallbackDist = Math.round(straightDist * 1.2);
  const fallback = {
    path: [startCoord, endCoord],
    distanceMeters: fallbackDist,
    durationMinutes: Math.max(1, Math.round(fallbackDist / 75)),
    straightDistanceMeters: straightDist,
    isDirectFallback: true,
    isDetourAnomalous: false
  };
  walkingCache.set(key, fallback);
  return fallback;
}


