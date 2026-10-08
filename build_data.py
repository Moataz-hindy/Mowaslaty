import json
import os
import numpy as np
from scipy.spatial import cKDTree

def process_data():
    os.makedirs('data', exist_ok=True)
    os.makedirs('public/data', exist_ok=True)
    
    print("Loading geonode_processed_trips.json...")
    with open('geonode_processed_trips.json', 'r', encoding='utf-8') as f:
        trips_raw = json.load(f)

    # Process stops first so we can map intermediate stops to routes
    stops_summary = []
    if os.path.exists('geonode_processed_stops.json'):
        print("Processing stops...")
        with open('geonode_processed_stops.json', 'r', encoding='utf-8') as f:
            stops_raw = json.load(f)
            
        for feat in stops_raw['features']:
            props = feat.get('properties', {})
            geom = feat.get('geometry', {})
            coords = geom.get('coordinates', [])
            if coords:
                stops_summary.append({
                    "id": props.get('gid') or props.get('ogc_fid'),
                    "name_en": props.get('stop_name') or '',
                    "name_ar": props.get('name_ar') or '',
                    "lat": round(coords[1], 5),
                    "lng": round(coords[0], 5)
                })
        print(f"Loaded {len(stops_summary)} stops.")
        for d in ['data', 'public/data']:
            with open(f'{d}/stops_summary.json', 'w', encoding='utf-8') as f:
                json.dump(stops_summary, f, ensure_ascii=False)

    # Build KDTree for stops
    stop_tree = None
    if stops_summary:
        stop_coords = np.array([[s['lat'], s['lng']] for s in stops_summary])
        stop_tree = cKDTree(stop_coords)
    r_threshold = 0.00075 # ~80m

    routes_summary = []
    routes_geometry = {}

    for feat in trips_raw['features']:
        props = feat.get('properties', {})
        geom = feat.get('geometry', {})
        coords = geom.get('coordinates', [])
        
        if not coords:
            continue
            
        trip_id = props.get('trip_id') or str(props.get('ogc_fid'))
        
        # Calculate bounding box
        lngs = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        bounds = [
            [round(min(lats), 5), round(min(lngs), 5)],
            [round(max(lats), 5), round(max(lngs), 5)]
        ]
        
        # Convert coords to [lat, lng] rounded to 5 decimals
        lat_lng_coords = [[round(c[1], 5), round(c[0], 5)] for c in coords]
        routes_geometry[trip_id] = lat_lng_coords
        
        route_short = props.get('route_short') or ''
        line_num = ""
        for part in route_short.split():
            if any(char.isdigit() for char in part):
                line_num = part
                break
        if not line_num:
            line_num = route_short

        # Extract sub-districts
        subs = []
        for k in ['o_sub_1', 'o_sub_2', 'd_sub_1', 'd_sub_2']:
            v = props.get(k)
            if v and v not in subs and str(v).lower() != 'none':
                subs.append(v)

        # Compute ordered intermediate stops
        via_stops = []
        if stop_tree is not None:
            seen_stops = set()
            for c in lat_lng_coords:
                indices = stop_tree.query_ball_point(c, r=r_threshold)
                for idx in indices:
                    s = stops_summary[idx]
                    name = s.get('name_ar') or s.get('name_en')
                    if name and name not in seen_stops:
                        seen_stops.add(name)
                        via_stops.append(name)
                        if len(via_stops) >= 30:
                            break
                if len(via_stops) >= 30:
                    break

        item = {
            "id": trip_id,
            "fid": props.get('ogc_fid'),
            "route_id": props.get('route_id'),
            "num": line_num,
            "short_en": props.get('route_short') or '',
            "short_ar": props.get('route_short_ar') or '',
            "long_en": props.get('route_long') or '',
            "long_ar": props.get('route_long_ar') or '',
            "vehicle": props.get('vehicle_name') or 'Bus',
            "agency": props.get('agency_id') or '',
            "dir": props.get('direction_id', 0),
            "origin": props.get('origin') or '',
            "dest": props.get('destination') or '',
            "len_km": round(props.get('len_km') or 0, 1),
            "fare": props.get('fare'),
            "capacity": props.get('passenger_capacity'),
            "bounds": bounds,
            "start_pt": lat_lng_coords[0],
            "end_pt": lat_lng_coords[-1],
            "points_count": len(coords),
            "sub_districts": subs,
            "via_stops": via_stops
        }
        routes_summary.append(item)

    print(f"Saving routes_summary.json ({len(routes_summary)} routes)...")
    for d in ['data', 'public/data']:
        with open(f'{d}/routes_summary.json', 'w', encoding='utf-8') as f:
            json.dump(routes_summary, f, ensure_ascii=False)

    print(f"Saving routes_geometry.json ({len(routes_geometry)} geometries)...")
    for d in ['data', 'public/data']:
        with open(f'{d}/routes_geometry.json', 'w', encoding='utf-8') as f:
            json.dump(routes_geometry, f, ensure_ascii=False)

    print("Data processing complete!")
    
    # Process Metro network
    if os.path.exists('geonode_metro_trips.json') and os.path.exists('geonode_metro_stops.json'):
        try:
            from process_metro import process_metro
            process_metro()
        except Exception as e:
            print(f"Error processing metro data: {e}")

if __name__ == '__main__':
    process_data()

