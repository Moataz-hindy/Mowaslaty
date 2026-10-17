#!/usr/bin/env python3
"""
Builds Mowaslaty's offline walking graph and place-search index from an
OpenStreetMap extract (e.g. Geofabrik's egypt-latest.osm.pbf).

Outputs (in public/data/):
  walk/tiles.json          -> tile size + list of tiles that exist
  walk/<tx>_<ty>.json      -> walking graph tiles (nodes + edges)
  places.v1.json           -> named places for the search bar

Usage:
  pip install osmium
  python scripts/build_osm.py osm/egypt-latest.osm.pbf

Data (c) OpenStreetMap contributors, ODbL. The app's map credit covers it.
"""
import json, math, os, re, sys, time
from collections import defaultdict
import osmium

# Greater Cairo (Giza, 6th of October, Sheikh Zayed, New Cairo, Shorouk, Obour,
# 10th of Ramadan edge, New Administrative Capital, Helwan)
MIN_LAT, MAX_LAT = 29.78, 30.33
MIN_LNG, MAX_LNG = 30.82, 31.86
TILE = 0.02  # degrees (~2.2 km)

WALKABLE = {
    'footway', 'path', 'pedestrian', 'living_street', 'residential', 'service',
    'unclassified', 'tertiary', 'tertiary_link', 'secondary', 'secondary_link',
    'primary', 'primary_link', 'trunk', 'trunk_link', 'steps', 'track',
    'cycleway', 'road', 'corridor', 'bridleway'
}
NO_ACCESS = {'no', 'private'}
FOOT_OK = {'yes', 'designated', 'permissive', 'official'}

STREET_TYPES = {'primary', 'secondary', 'tertiary', 'trunk', 'residential',
                'unclassified', 'pedestrian', 'living_street'}

PLACE_RULES = [
    # (tag, values or None for any, category)
    ('place', {'city', 'town', 'suburb', 'quarter', 'neighbourhood', 'village', 'hamlet'}, 'area'),
    ('place', {'square'}, 'square'),
    ('amenity', {'university', 'college'}, 'university'),
    ('amenity', {'school'}, 'school'),
    ('amenity', {'hospital'}, 'hospital'),
    ('amenity', {'place_of_worship'}, 'worship'),
    ('amenity', {'marketplace'}, 'market'),
    ('amenity', {'bus_station'}, 'station'),
    ('amenity', {'townhall', 'courthouse', 'library', 'theatre', 'cinema', 'embassy',
                 'police', 'post_office', 'arts_centre', 'community_centre'}, 'landmark'),
    ('office', {'government'}, 'landmark'),
    ('shop', {'mall', 'department_store'}, 'mall'),
    ('tourism', {'attraction', 'museum', 'zoo', 'theme_park', 'hotel', 'viewpoint'}, 'landmark'),
    ('historic', None, 'landmark'),
    ('leisure', {'park', 'stadium', 'sports_centre', 'garden'}, 'park'),
    ('railway', {'station', 'halt'}, 'station'),
    ('public_transport', {'station'}, 'station'),
    ('aeroway', {'aerodrome', 'terminal'}, 'landmark'),
]


def in_box(lat, lng):
    return MIN_LAT <= lat <= MAX_LAT and MIN_LNG <= lng <= MAX_LNG


def tile_of(lat, lng):
    return (int(math.floor((lng - MIN_LNG) / TILE)), int(math.floor((lat - MIN_LAT) / TILE)))


def haversine(a, b):
    lat1, lng1 = a
    lat2, lng2 = b
    p = math.pi / 180
    x = (math.sin((lat2 - lat1) * p / 2) ** 2 +
         math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lng2 - lng1) * p / 2) ** 2)
    return 12742000 * math.asin(math.sqrt(x))


def classify(tags):
    for key, values, cat in PLACE_RULES:
        v = tags.get(key)
        if v and (values is None or v in values):
            return cat
    return None


def names(tags):
    ar = tags.get('name:ar') or tags.get('name')
    en = tags.get('name:en')
    if ar and not re.search('[؀-ۿ]', ar):
        # 'name' is Latin-only: use it as English, no Arabic name
        en = en or ar
        ar = tags.get('name:ar')
    return ar, en


class Collector:
    def __init__(self):
        self.ways = []          # (node_ids, coords)
        self.places = []        # (ar, en, cat, lat, lng)
        self.streets = defaultdict(list)  # (ar, en) -> [(lat, lng)]

    def run(self, path):
        # Locations are tracked in C++ for every node; Python only sees objects
        # that carry one of these tags, which keeps this fast.
        fp = (osmium.FileProcessor(path, osmium.osm.NODE | osmium.osm.WAY)
              .with_locations()
              .with_filter(osmium.filter.KeyFilter('highway', 'name', 'name:ar')))
        for o in fp:
            if o.is_node():
                self.node(o)
            else:
                self.way(o)

    def node(self, n):
        if 'name' not in n.tags and 'name:ar' not in n.tags:
            return
        loc = n.location
        if not loc.valid() or not in_box(loc.lat, loc.lon):
            return
        tags = {t.k: t.v for t in n.tags}
        cat = classify(tags)
        if not cat:
            return
        ar, en = names(tags)
        if ar or en:
            self.places.append((ar, en, cat, loc.lat, loc.lon))

    def way(self, w):
        tags = w.tags
        hw = tags.get('highway')
        named = 'name' in tags or 'name:ar' in tags
        try:
            coords = [(nd.location.lat, nd.location.lon) for nd in w.nodes]
            ids = [nd.ref for nd in w.nodes]
        except osmium.InvalidLocationError:
            return
        if not coords:
            return
        mid = coords[len(coords) // 2]
        if not in_box(*mid):
            return

        # walking graph
        if hw in WALKABLE:
            access = tags.get('access')
            foot = tags.get('foot')
            if not ((foot in NO_ACCESS) or (access in NO_ACCESS and foot not in FOOT_OK)) \
                    and tags.get('area') != 'yes':
                self.ways.append((ids, coords))

        # place index
        if named:
            t = {k.k: k.v for k in tags}
            ar, en = names(t)
            if not (ar or en):
                return
            if hw in STREET_TYPES:
                self.streets[(ar, en)].append(mid)
            else:
                cat = classify(t)
                if cat:
                    lat = sum(c[0] for c in coords) / len(coords)
                    lng = sum(c[1] for c in coords) / len(coords)
                    self.places.append((ar, en, cat, lat, lng))


def build_graph(ways):
    use = defaultdict(int)
    for ids, _ in ways:
        for i, nid in enumerate(ids):
            use[nid] += 2 if i in (0, len(ids) - 1) else 1
    vid = {}
    vcoord = []
    edges = []  # (u, v, length_m, coords)

    def vertex(nid, c):
        if nid not in vid:
            vid[nid] = len(vcoord)
            vcoord.append(c)
        return vid[nid]

    for ids, coords in ways:
        start = 0
        for i in range(1, len(ids)):
            if use[ids[i]] >= 2 or i == len(ids) - 1:
                seg = coords[start:i + 1]
                if len(seg) >= 2 and ids[start] != ids[i]:
                    length = sum(haversine(seg[k], seg[k + 1]) for k in range(len(seg) - 1))
                    u = vertex(ids[start], coords[start])
                    v = vertex(ids[i], coords[i])
                    edges.append((u, v, length, seg))
                start = i
    return vcoord, edges


def enc_num(v):
    v = ~(v << 1) if v < 0 else (v << 1)
    out = []
    while v >= 0x20:
        out.append(chr((0x20 | (v & 0x1f)) + 63))
        v >>= 5
    out.append(chr(v + 63))
    return ''.join(out)


def encode(pts):
    res, plat, plng = [], 0, 0
    for lat, lng in pts:
        ilat, ilng = round(lat * 1e5), round(lng * 1e5)
        res.append(enc_num(ilat - plat))
        res.append(enc_num(ilng - plng))
        plat, plng = ilat, ilng
    return ''.join(res)


def norm(t):
    t = (t or '').lower()
    t = re.sub('[أإآ]', 'ا', t).replace('ة', 'ه').replace('ى', 'ي')
    t = re.sub('[ً-ٟ]', '', t)
    return re.sub(r'\s+', ' ', t).strip()


def cluster(points, radius_m=1500):
    groups = []
    for p in points:
        for g in groups:
            if haversine(g[0], p) <= radius_m:
                g.append(p)
                break
        else:
            groups.append([p])
    return groups


def main():
    src = sys.argv[1]
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
    out_dir = os.path.join(root, 'public', 'data')
    walk_dir = os.path.join(out_dir, 'walk')
    os.makedirs(walk_dir, exist_ok=True)

    t0 = time.time()
    # Stage 1 (slow part) can be cached so the build can be split into two runs:
    #   python scripts/build_osm.py <pbf> --collect   -> writes osm/collected.pickle
    #   python scripts/build_osm.py <pbf>             -> uses the cache if present
    import pickle
    cache = os.path.join(root, 'osm', 'collected.pickle')
    if '--collect' in sys.argv or not os.path.exists(cache):
        h = Collector()
        h.run(src)
        with open(cache, 'wb') as f:
            pickle.dump((h.ways, h.places, dict(h.streets)), f, protocol=pickle.HIGHEST_PROTOCOL)
        if '--collect' in sys.argv:
            print(f'collected in {time.time() - t0:.0f}s: {len(h.ways)} ways', flush=True)
            return
    else:
        h = Collector()
        with open(cache, 'rb') as f:
            h.ways, h.places, streets = pickle.load(f)
        h.streets = defaultdict(list, streets)
    print(f'read OSM in {time.time() - t0:.0f}s: {len(h.ways)} walkable ways, '
          f'{len(h.places)} places, {len(h.streets)} street names', flush=True)

    # ---- walking graph tiles ----
    vcoord, edges = build_graph(h.ways)
    print(f'graph: {len(vcoord)} vertices, {len(edges)} edges', flush=True)
    tiles = defaultdict(lambda: {'n': {}, 'e': []})
    for u, v, length, seg in edges:
        tu = tile_of(*vcoord[u])
        tv = tile_of(*vcoord[v])
        for t in {tu, tv}:
            tile = tiles[t]
            tile['n'][u] = vcoord[u]
            tile['n'][v] = vcoord[v]
            tile['e'].append((u, v, length, seg))
    total = 0
    for (tx, ty), tile in tiles.items():
        n_flat = []
        for nid, (lat, lng) in tile['n'].items():
            n_flat += [nid, round(lat * 1e5), round(lng * 1e5)]
        e_flat = []
        for u, v, length, seg in tile['e']:
            # interior geometry only (ends are the vertices); '' for straight edges
            e_flat += [u, v, round(length), encode(seg[1:-1]) if len(seg) > 2 else '']
        data = json.dumps({'n': n_flat, 'e': e_flat}, separators=(',', ':'))
        total += len(data)
        with open(os.path.join(walk_dir, f'{tx}_{ty}.json'), 'w', encoding='utf-8') as f:
            f.write(data)
    index = {
        'v': 1, 'tile': TILE, 'minLat': MIN_LAT, 'minLng': MIN_LNG,
        'tiles': sorted(f'{tx}_{ty}' for tx, ty in tiles)
    }
    with open(os.path.join(walk_dir, 'tiles.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, separators=(',', ':'))
    print(f'walk tiles: {len(tiles)} files, {total / 1e6:.1f} MB total', flush=True)

    # ---- places ----
    seen = {}
    out = []
    order = {'station': 0, 'university': 1, 'hospital': 2, 'mall': 3, 'landmark': 4, 'square': 5,
             'park': 6, 'area': 7, 'market': 8, 'worship': 9, 'school': 10, 'street': 11}

    GENERIC_EN = {'mosque', 'church', 'school', 'hospital', 'park', 'street', 'road', 'square',
                  'pharmacy', 'mall', 'garden', 'station', 'bus stop', 'market'}

    def add(ar, en, cat, lat, lng):
        key = norm(ar or en)
        if not key:
            return
        # skip unhelpful names: generic English words, "branch of X street", single letters
        if not ar and (en or '').strip().lower() in GENERIC_EN:
            return
        if 'متفرع من' in (ar or '') or len(key) < 3:
            return
        for (k_lat, k_lng, i) in seen.get(key, []):
            if haversine((k_lat, k_lng), (lat, lng)) < 400:
                if order[cat] < order[out[i][2]]:
                    out[i][2] = cat
                return
        seen.setdefault(key, []).append((lat, lng, len(out)))
        out.append([ar or '', en or '', cat, round(lat, 5), round(lng, 5)])

    for p in sorted(h.places, key=lambda p: order[p[2]]):
        add(*p)
    for (ar, en), pts in h.streets.items():
        for g in cluster(pts):
            lat = sum(p[0] for p in g) / len(g)
            lng = sum(p[1] for p in g) / len(g)
            add(ar, en, 'street', lat, lng)
    with open(os.path.join(out_dir, 'places.v1.json'), 'w', encoding='utf-8') as f:
        json.dump({'v': 1, 'fields': ['ar', 'en', 'cat', 'lat', 'lng'], 'places': out},
                  f, ensure_ascii=False, separators=(',', ':'))
    print(f'places: {len(out)} entries', flush=True)
    print(f'done in {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
