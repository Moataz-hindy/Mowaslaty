// Cloudflare Pages Function: GET /api/walk?from=lng,lat&to=lng,lat
// Walking route with the API key kept server-side.
// Uses Geoapify (secret GEOAPIFY_KEY) or, if that is not set, openrouteservice
// (secret ORS_API_KEY). Set them in Cloudflare Pages -> Settings -> Variables and Secrets.
// Responds in the OSRM shape the app already understands:
//   { code: 'Ok', routes: [{ distance, duration, geometry: { coordinates } }] }

const CAIRO_BOUNDS = { minLng: 30.5, maxLng: 32.2, minLat: 29.5, maxLat: 30.6 };

function parsePoint(value) {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  if (parts.length !== 2 || parts.some(n => !Number.isFinite(n))) return null;
  const [lng, lat] = parts;
  const b = CAIRO_BOUNDS;
  if (lng < b.minLng || lng > b.maxLng || lat < b.minLat || lat > b.maxLat) return null;
  // round to ~1 m so near-identical requests share a cache entry
  return [Number(lng.toFixed(5)), Number(lat.toFixed(5))];
}

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra }
  });

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const from = parsePoint(url.searchParams.get('from'));
  const to = parsePoint(url.searchParams.get('to'));
  if (!from || !to) return json({ code: 'InvalidInput' }, 400);
  if (!env.GEOAPIFY_KEY && !env.ORS_API_KEY) return json({ code: 'NotConfigured' }, 503);

  // Edge cache: same pair of points -> served without calling ORS again
  const cacheKey = new Request(`${url.origin}/__cache/walk/${from.join(',')}/${to.join(',')}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let route;
  try {
    route = env.GEOAPIFY_KEY
      ? await viaGeoapify(from, to, env.GEOAPIFY_KEY)
      : await viaOpenRouteService(from, to, env.ORS_API_KEY);
  } catch (e) {
    // quota used up (429) or upstream down: the app falls back to a straight line
    return json({ code: 'UpstreamError', message: String(e.message || e) }, 502);
  }
  if (!route) return json({ code: 'NoRoute' }, 404);

  const response = json(
    {
      code: 'Ok',
      routes: [route]
    },
    200,
    { 'cache-control': 'public, max-age=86400' }
  );
  waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

// Geoapify Routing API, mode=walk. Waypoints are lat,lon separated by "|".
async function viaGeoapify([fLng, fLat], [tLng, tLat], key) {
  const url = `https://api.geoapify.com/v1/routing?waypoints=${fLat},${fLng}|${tLat},${tLng}&mode=walk&apiKey=${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`geoapify ${res.status}`);
  const data = await res.json();
  const f = data.features && data.features[0];
  if (!f) return null;
  // geometry is a MultiLineString (one line per leg) -> flatten to one line
  const g = f.geometry || {};
  const coordinates = g.type === 'MultiLineString' ? g.coordinates.flat() : (g.coordinates || []);
  return {
    distance: f.properties?.distance || 0,   // metres
    duration: f.properties?.time || 0,       // seconds
    geometry: { coordinates }                // [lng, lat]
  };
}

// openrouteservice Directions API, profile foot-walking.
async function viaOpenRouteService(from, to, key) {
  const url = `https://api.openrouteservice.org/v2/directions/foot-walking?start=${from.join(',')}&end=${to.join(',')}`;
  const res = await fetch(url, { headers: { Authorization: key, Accept: 'application/geo+json' } });
  if (!res.ok) throw new Error(`ors ${res.status}`);
  const data = await res.json();
  const f = data.features && data.features[0];
  if (!f) return null;
  const summary = (f.properties && f.properties.summary) || {};
  return {
    distance: summary.distance || 0,
    duration: summary.duration || 0,
    geometry: { coordinates: f.geometry.coordinates }
  };
}
