// Offline walking router: A* over OpenStreetMap streets, built by
// scripts/build_osm.py into small tiles under /data/walk/.
// Only the tiles around the two points are downloaded (and cached).
import { decodePolyline } from './polyline';

const BASE = '/data/walk';
let indexPromise = null;
const tileCache = new Map();     // key -> Promise<tile json | null>

const loadIndex = () => {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}/tiles.json`).then(r => {
      if (!r.ok) throw new Error('walk index missing');
      return r.json();
    }).then(idx => ({ ...idx, set: new Set(idx.tiles) }));
  }
  return indexPromise;
};

const loadTile = (key) => {
  if (!tileCache.has(key)) {
    tileCache.set(key, fetch(`${BASE}/${key}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null));
  }
  return tileCache.get(key);
};

function metres(aLat, aLng, bLat, bLng) {
  const p = Math.PI / 180;
  const x = Math.sin((bLat - aLat) * p / 2) ** 2 +
    Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin((bLng - aLng) * p / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(x));
}

// Minimal binary heap keyed by f-score
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

/**
 * Walking route between two [lat, lng] points.
 * Returns { path: [[lat,lng],...], distanceMeters, durationMinutes } or null.
 */
export async function walkRoute(start, end, { snapLimit = 350 } = {}) {
  const idx = await loadIndex();
  const [sLat, sLng] = start;
  const [eLat, eLng] = end;
  const margin = 0.008; // ~900 m around the two points
  const minLat = Math.min(sLat, eLat) - margin, maxLat = Math.max(sLat, eLat) + margin;
  const minLng = Math.min(sLng, eLng) - margin, maxLng = Math.max(sLng, eLng) + margin;
  const t = idx.tile;
  const keys = [];
  for (let tx = Math.floor((minLng - idx.minLng) / t); tx <= Math.floor((maxLng - idx.minLng) / t); tx++) {
    for (let ty = Math.floor((minLat - idx.minLat) / t); ty <= Math.floor((maxLat - idx.minLat) / t); ty++) {
      const k = `${tx}_${ty}`;
      if (idx.set.has(k)) keys.push(k);
    }
  }
  if (keys.length === 0 || keys.length > 30) return null; // outside coverage / too far to walk

  const tiles = (await Promise.all(keys.map(loadTile))).filter(Boolean);
  const nodes = new Map();  // id -> [lat, lng]
  const adj = new Map();    // id -> [[to, len, geom, reversed]]
  const seen = new Set();
  for (const tile of tiles) {
    const n = tile.n;
    for (let i = 0; i < n.length; i += 3) nodes.set(n[i], [n[i + 1] / 1e5, n[i + 2] / 1e5]);
    const e = tile.e;
    for (let i = 0; i < e.length; i += 4) {
      const u = e[i], v = e[i + 1], len = e[i + 2], geom = e[i + 3];
      const key = `${u}:${v}:${len}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!adj.has(u)) adj.set(u, []);
      if (!adj.has(v)) adj.set(v, []);
      adj.get(u).push([v, len, geom, false]);
      adj.get(v).push([u, len, geom, true]);
    }
  }

  // snap both points to the nearest street vertex
  const nearest = (lat, lng) => {
    let best = null, bestD = Infinity;
    for (const [id, [nl, ng]] of nodes) {
      if (Math.abs(nl - lat) > 0.006 || Math.abs(ng - lng) > 0.006) continue;
      const d = metres(lat, lng, nl, ng);
      if (d < bestD && adj.has(id)) { bestD = d; best = id; }
    }
    return best == null || bestD > snapLimit ? null : { id: best, d: bestD };
  };
  const a = nearest(sLat, sLng);
  const b = nearest(eLat, eLng);
  if (!a || !b) return null;

  // A*
  const [gLat, gLng] = nodes.get(b.id);
  const g = new Map([[a.id, 0]]);
  const prev = new Map();
  const heap = new Heap();
  heap.push([metres(...nodes.get(a.id), gLat, gLng), a.id]);
  const closed = new Set();
  let found = false;
  while (heap.size) {
    const [, u] = heap.pop();
    if (u === b.id) { found = true; break; }
    if (closed.has(u)) continue;
    closed.add(u);
    const gu = g.get(u);
    for (const [v, len, geom, rev] of adj.get(u) || []) {
      if (closed.has(v)) continue;
      const nv = gu + len;
      if (nv < (g.has(v) ? g.get(v) : Infinity)) {
        g.set(v, nv);
        prev.set(v, [u, geom, rev]);
        const p = nodes.get(v);
        heap.push([nv + (p ? metres(p[0], p[1], gLat, gLng) : 0), v]);
      }
    }
  }
  if (!found) return null;

  // rebuild the geometry
  const chain = [];
  for (let v = b.id; v !== a.id; v = prev.get(v)[0]) chain.push([prev.get(v), v]);
  chain.reverse();
  const path = [start, nodes.get(a.id)];
  for (const [[, geom, rev], v] of chain) {
    let mid = geom ? decodePolyline(geom) : [];
    if (rev) mid = mid.reverse();
    path.push(...mid, nodes.get(v));
  }
  path.push(end);
  const distanceMeters = Math.round(g.get(b.id) + a.d + b.d);
  return { path, distanceMeters, durationMinutes: Math.max(1, Math.round(distanceMeters / 75)) };
}
