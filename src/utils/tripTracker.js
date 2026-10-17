// Trip tracking along one transit line: where am I on the line, which stop
// is next, how far to the drop-off, am I going the wrong way / off the line.
// Pure functions, runs on every GPS fix (cheap: one line only).
import { normalizeText } from './geoUtils';

const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;

function haversine(a, b) {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Project point p onto the polyline -> { along (m from start), offset (m), point }
function project(track, p) {
  const { coords, cum } = track;
  const kx = Math.cos(toRad(p[0])) * 111320;
  const ky = 110540;
  let best = { offset: Infinity, along: 0, point: coords[0] };
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky;
    const bx = (b[1] - p[1]) * kx, by = (b[0] - p[0]) * ky;
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy;
    let t = L2 > 0 ? -(ax * dx + ay * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * dx, qy = ay + t * dy;
    const off = Math.hypot(qx, qy);
    if (off < best.offset) {
      const segLen = cum[i + 1] - cum[i];
      best = {
        offset: off,
        along: cum[i] + t * segLen,
        point: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
      };
    }
  }
  return best;
}

/**
 * Prepare a trip. route: route summary, coords: [[lat,lng]] line geometry,
 * stops: stops_summary, dropCoord: [lat,lng], dropName: label.
 */
export function buildTrack(route, coords, stops, dropCoord, dropName) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  const track = { route, coords, cum, length: cum[cum.length - 1] };

  // Stops of this line in order: match via_stops names to known stop
  // positions that lie on the line (within 80 m).
  const byName = new Map();
  for (const s of stops || []) {
    const key = normalizeText(s.name_ar || s.name_en);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(s);
  }
  const stopsAlong = [];
  for (const name of route.via_stops || []) {
    const cands = byName.get(normalizeText(name)) || [];
    let best = null;
    for (const s of cands) {
      const pr = project(track, [s.lat, s.lng]);
      if (pr.offset <= 80 && (!best || pr.offset < best.offset)) best = { name, along: pr.along, offset: pr.offset };
    }
    if (best) stopsAlong.push(best);
  }
  stopsAlong.sort((a, b) => a.along - b.along);

  const dropProj = project(track, dropCoord);
  return {
    ...track,
    stopsAlong,
    drop: { coord: dropCoord, name: dropName, along: dropProj.along }
  };
}

/**
 * Update the trip with a new GPS fix.
 * prev: previous state (or null). fix: { coord, accuracy, speed, timestamp }
 */
export function updateTrack(track, fix, prev) {
  const pr = project(track, fix.coord);
  const now = fix.timestamp || Date.now();
  const history = [...((prev && prev.history) || []), { along: pr.along, t: now }]
    .filter(h => now - h.t <= 90000);   // last 90 s

  // movement along the line over the recent window
  const first = history[0];
  const moved = pr.along - first.along;
  const span = (now - first.t) / 1000;

  const accuracy = fix.accuracy || 30;
  const offLimit = Math.max(150, accuracy * 1.5);
  const offRoute = pr.offset > offLimit;
  const wrongWay = !offRoute && span >= 20 && moved < -120;

  // speed: GPS speed if sensible, else from history, else a typical bus speed
  let speed = fix.speed && fix.speed > 1 ? fix.speed : (span >= 20 && moved > 30 ? moved / span : null);
  const assumedSpeed = 5;                       // ~18 km/h in Cairo traffic
  // blend with the typical speed and clamp: GPS speed jumps around in traffic
  const useSpeed = speed ? Math.min(12, Math.max(2, (speed + assumedSpeed) / 2)) : assumedSpeed;
  const remaining = Math.max(0, track.drop.along - pr.along);
  const etaMin = Math.max(1, Math.round(remaining / useSpeed / 60));

  const nextStop = track.stopsAlong.find(s => s.along > pr.along + 20 && s.along <= track.drop.along + 30) || null;
  const stopsLeft = track.stopsAlong.filter(s => s.along > pr.along + 20 && s.along <= track.drop.along + 30).length;

  let phase = 'riding';
  if (pr.along > track.drop.along + 150) phase = 'passed';
  else if (remaining <= 80) phase = 'arrived';
  else if (remaining <= 450) phase = 'approaching';

  const startAlong = (prev && prev.startAlong != null) ? prev.startAlong : Math.min(pr.along, track.drop.along);
  const total = Math.max(1, track.drop.along - startAlong);
  const progress = Math.max(0, Math.min(1, 1 - remaining / total));

  return {
    history, startAlong, progress,
    snapped: pr.point, offset: Math.round(pr.offset), along: pr.along,
    remaining: Math.round(remaining), etaMin, speed,
    nextStop, stopsLeft, phase, offRoute, wrongWay
  };
}

/**
 * Stops of a line with positions: via_stops names matched to known stops
 * that lie on the line (within 80 m), in travel order.
 */
export function matchRouteStops(route, coords, stops) {
  if (!route || !coords || coords.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  const track = { coords, cum };
  const byName = new Map();
  for (const s of stops || []) {
    const key = normalizeText(s.name_ar || s.name_en);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(s);
  }
  const out = [];
  for (const name of route.via_stops || []) {
    let best = null;
    for (const s of byName.get(normalizeText(name)) || []) {
      const pr = project(track, [s.lat, s.lng]);
      if (pr.offset <= 80 && (!best || pr.offset < best.offset)) best = { name, coord: [s.lat, s.lng], along: pr.along, offset: pr.offset };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => a.along - b.along);
}
