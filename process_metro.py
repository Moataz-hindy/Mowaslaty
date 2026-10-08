import json
import os
import numpy as np
from scipy.spatial import cKDTree

METRO_STATIONS_AR = {
    'Abbassiya': 'العباسية',
    'Abdou Pasha': 'عبده باشا',
    'Adly Mansour': 'عدلي منصور',
    'Ain Helwan': 'عين حلوان',
    'Ain Shams': 'عين شمس',
    'Al Bohi': 'البوهي',
    'Al Daaery': 'الطريق الدائري',
    'Al Tawfiqeyya': 'التوفيقية',
    'Al-Ahram': 'الأهرام (مصر الجديدة)',
    'Al-Sayeda Zeinab': 'السيدة زينب',
    'Al-Shohadaa': 'الشهداء (رمسيس)',
    'Alf Maskan': 'ألف مسكن',
    'Arab Leauge': 'جامعة الدول العربية',
    'Attaba': 'العتبة',
    'Bab El-Shaaria': 'باب الشعرية',
    'Bohooth': 'البحوث',
    'Boulaq Dakrour': 'بولاق الدكرور',
    'Cairo University': 'جامعة القاهرة',
    'Dar El-Salam': 'دار السلام',
    'Dokki': 'الدقي',
    'El-Demerdash': 'الدمرداش',
    'El-Geish': 'الجيش',
    'El-Giza': 'الجيزة',
    'El-Maasara': 'المعصرة',
    'El-Malek El-Saleh': 'الملك الصالح',
    'El-Marg': 'المرج',
    'El-Matareyya': 'المطرية',
    'El-Mounib': 'المنيب',
    'El-Zahraa': 'الزهراء',
    'Ezbet El-Nakhl': 'عزبة النخل',
    'Fair Zone': 'أرض المعارض',
    'Faisal': 'فيصل',
    'Ghamra': 'غمرة',
    'Hadayek El-Maadi': 'حدائق المعادي',
    'Hadayek Helwan': 'حدائق حلوان',
    'Hadayeq El-Zaitoun': 'حدائق الزيتون',
    'Hammamat El-Qobba': 'حمامات القبة',
    'Haroun': 'هارون',
    'Heliopolis': 'هليوبوليس',
    'Helmeyet El-Zaitoun': 'حلمية الزيتون',
    'Helwan': 'حلوان',
    'Helwan University': 'جامعة حلوان',
    'Hesham Barakat': 'هشام بركات',
    'Hikestep': 'الهايكستب',
    'Imbaba': 'إمبابة',
    'Kebaa': 'قباء',
    'Khalafawy': 'الخلفاوي',
    'Kit Kat': 'الكيت كات',
    'Kobri El-Qobba': 'كوبري القبة',
    'Koleyet El-Banat': 'كلية البنات',
    'Kolleyyet El-Zeraa': 'كلية الزراعة',
    'Kozzika': 'كوتسيكا',
    'Maadi': 'المعادي',
    'Manshiet El-Sadr': 'منشية الصدر',
    'Mar Girgis': 'مار جرجس',
    'Masarra': 'مسرة',
    'Maspero': 'ماسبيرو',
    'Mezallat': 'المظلات',
    'Mohamed Naguib': 'محمد نجيب',
    'Nasser': 'جمال عبد الناصر',
    'New El-Marg': 'المرج الجديدة',
    'Nozha 1': 'النزهة',
    'Omar Ibn El Khataab': 'عمر بن الخطاب',
    'Omm El-Misryeen': 'أم المصريين',
    'Opera': 'الأوبرا',
    'Orabi': 'عرابي',
    'Qawmeya Arabiya': 'القومية العربية',
    'Road Al Farag Axis': 'محور روض الفرج',
    'Rod El Farag': 'روض الفرج',
    'Saad Zaghloul': 'سعد زغلول',
    'Sadat': 'السادات (التحرير)',
    'Safaa Hegazy': 'صفاء حجازي (الزمالك)',
    'Sakanat El-Maadi': 'ثكنات المعادي',
    'Sakiat Mekki': 'ساقية مكي',
    'Saray El-Qobba': 'سراي القبة',
    'Shams Club': 'نادي الشمس',
    'Shubra El-Kheima': 'شبرا الخيمة',
    'St. Teresa': 'سانت تريزا',
    'Stadium': 'الاستاد',
    'Sudan': 'السودان',
    'Tora El-Asmant': 'طرة الأسمنت',
    'Tora El-Balad': 'طرة البلد',
    'Wadi Al Nile': 'وادي النيل',
    'Wadi Hof': 'وادي حوف'
}

INTERCHANGES = {
    'Sadat': ['M1', 'M2'],
    'Al-Shohadaa': ['M1', 'M2'],
    'Attaba': ['M2', 'M3'],
    'Nasser': ['M1', 'M3'],
    'Cairo University': ['M2', 'M3'],
    'Kit Kat': ['M3_Main', 'M3_Branch_North', 'M3_Branch_South'],
    'Adly Mansour': ['M3', 'LRT']
}

def process_metro():
    print("Processing Cairo Metro GeoJSON data...")
    with open('geonode_metro_trips.json', 'r', encoding='utf-8') as f:
        trips_raw = json.load(f)

    with open('geonode_metro_stops.json', 'r', encoding='utf-8') as f:
        stops_raw = json.load(f)

    # 1. Process unique stations
    stations_by_name = {}
    for feat in stops_raw['features']:
        props = feat['properties']
        geom = feat['geometry']
        c = geom['coordinates'] # [lng, lat]
        name_en = props.get('stop_name')
        if not name_en:
            continue
        name_ar = METRO_STATIONS_AR.get(name_en, name_en)
        if name_en not in stations_by_name:
            stations_by_name[name_en] = {
                "id": f"metro_stop_{props.get('ogc_fid')}",
                "name_en": name_en,
                "name_ar": name_ar,
                "lat": round(c[1], 5),
                "lng": round(c[0], 5),
                "lines": [],
                "is_interchange": name_en in INTERCHANGES,
                "interchange_lines": INTERCHANGES.get(name_en, [])
            }

    unique_stations_list = list(stations_by_name.values())
    stop_coords = np.array([[s['lat'], s['lng']] for s in unique_stations_list])
    stop_tree = cKDTree(stop_coords)

    # 2. Process Trips into standardized Route Objects
    metro_routes = []
    metro_geometries = {}

    for feat in trips_raw['features']:
        p = feat['properties']
        coords = feat['geometry']['coordinates'] # [lng, lat]
        lat_lng_coords = [[round(c[1], 5), round(c[0], 5)] for c in coords]
        
        trip_id = f"metro_{p.get('trip_id') or p.get('ogc_fid')}"
        metro_geometries[trip_id] = lat_lng_coords
        
        route_shor = p.get('route_shor') # M1, M2, M3
        line_num = route_shor
        
        # Determine stops along this trip
        ordered_stops_ar = []
        ordered_stops_en = []
        seen = set()
        for pt in lat_lng_coords:
            indices = stop_tree.query_ball_point(pt, r=0.002) # ~200m
            for idx in indices:
                st = unique_stations_list[idx]
                if st['name_en'] not in seen:
                    seen.add(st['name_en'])
                    ordered_stops_en.append(st['name_en'])
                    ordered_stops_ar.append(st['name_ar'])
                    if route_shor not in st['lines']:
                        st['lines'].append(route_shor)

        origin_en = ordered_stops_en[0] if ordered_stops_en else (p.get('route_desc') or '').split(' - ')[0]
        dest_en = ordered_stops_en[-1] if ordered_stops_en else p.get('trip_heads')
        origin_ar = METRO_STATIONS_AR.get(origin_en, origin_en)
        dest_ar = METRO_STATIONS_AR.get(dest_en, dest_en)

        line_titles = {
            'M1': ('مترو الخط 1 (حلوان - المرج)', 'Metro Line 1 (Helwan - El Marg)'),
            'M2': ('مترو الخط 2 (شبرا - المنيب)', 'Metro Line 2 (Shubra - El Mounib)'),
            'M3': ('مترو الخط 3 (عدلي منصور - الكيت كات)', 'Metro Line 3 (Adly Mansour - Kit Kat)')
        }
        
        default_ar, default_en = line_titles.get(route_shor, ('مترو القاهرة', 'Cairo Metro'))
        desc_long_ar = f"{default_ar} ({origin_ar} ➔ {dest_ar})"
        desc_long_en = f"{default_en} ({origin_en} ➔ {dest_en})"

        color = f"#{p.get('route_colo') or '06b6d4'}"

        lngs = [c[1] for c in lat_lng_coords]
        lats = [c[0] for c in lat_lng_coords]
        bounds = [
            [round(min(lats), 5), round(min(lngs), 5)],
            [round(max(lats), 5), round(max(lngs), 5)]
        ]

        # Calculate approximate length in km
        # Approximate: haversine or straight segment sum
        len_km = 0.0
        for k in range(len(lat_lng_coords) - 1):
            p1 = lat_lng_coords[k]
            p2 = lat_lng_coords[k+1]
            dlat = (p2[0] - p1[0]) * 111.0
            dlng = (p2[1] - p1[1]) * 96.0
            len_km += (dlat**2 + dlng**2)**0.5
        len_km = round(len_km, 1)

        item = {
            "id": trip_id,
            "fid": p.get('ogc_fid'),
            "route_id": p.get('route_id'),
            "num": line_num,
            "short_en": p.get('route_long') or f"Metro {route_shor}",
            "short_ar": f"مترو الخط {route_shor.replace('M', '')}",
            "long_en": desc_long_en,
            "long_ar": desc_long_ar,
            "vehicle": "Metro",
            "agency": "NAT",
            "dir": int(p.get('direction_') or 0),
            "origin": origin_ar,
            "dest": dest_ar,
            "origin_en": origin_en,
            "dest_en": dest_en,
            "len_km": len_km,
            "fare": "8 - 20 ج.م",
            "capacity": 2500,
            "color": color,
            "bounds": bounds,
            "start_pt": lat_lng_coords[0],
            "end_pt": lat_lng_coords[-1],
            "points_count": len(lat_lng_coords),
            "sub_districts": ["شبكة مترو القاهرة الكبرى"],
            "via_stops": ordered_stops_ar,
            "via_stops_en": ordered_stops_en
        }
        metro_routes.append(item)

    print(f"Generated {len(metro_routes)} Metro trip variants across Lines 1, 2, 3.")

    # 3. Save standalone metro_network.json
    metro_network = {
        "summary": {
            "lines_count": 3,
            "stations_count": len(unique_stations_list),
            "interchanges": INTERCHANGES,
            "ticket_pricing": [
                {"zone": "1 منطقة (1 - 9 محطات)", "price_egp": 8},
                {"zone": "2 منطقتين (10 - 16 محطة)", "price_egp": 10},
                {"zone": "3 مناطق (17 - 23 محطة)", "price_egp": 15},
                {"zone": "أكثر من 23 محطة", "price_egp": 20}
            ]
        },
        "lines": [
            {
                "id": "M1",
                "name_ar": "الخط الأول (حلوان - المرج الجديدة)",
                "name_en": "Line 1 (Helwan - New El-Marg)",
                "color": "#2E4A78",
                "stations_count": 35,
                "terminals": ["حلوان", "المرج الجديدة"]
            },
            {
                "id": "M2",
                "name_ar": "الخط الثاني (شبرا الخيمة - المنيب)",
                "name_en": "Line 2 (Shubra El-Kheima - El Mounib)",
                "color": "#A63457",
                "stations_count": 20,
                "terminals": ["شبرا الخيمة", "المنيب"]
            },
            {
                "id": "M3",
                "name_ar": "الخط الثالث (عدلي منصور - الكيت كات / روض الفرج / جامعة القاهرة)",
                "name_en": "Line 3 (Adly Mansour - Kit Kat / Rod El Farag / Cairo Univ.)",
                "color": "#325F3B",
                "stations_count": 34,
                "terminals": ["عدلي منصور", "الكيت كات", "محور روض الفرج", "جامعة القاهرة"]
            }
        ],
        "stations": unique_stations_list
    }

    for d in ['data', 'public/data']:
        os.makedirs(d, exist_ok=True)
        with open(f'{d}/metro_network.json', 'w', encoding='utf-8') as f:
            json.dump(metro_network, f, ensure_ascii=False, indent=2)

    # 4. Integrate into routes_summary.json and routes_geometry.json
    for d in ['data', 'public/data']:
        routes_path = f'{d}/routes_summary.json'
        geom_path = f'{d}/routes_geometry.json'
        
        with open(routes_path, 'r', encoding='utf-8') as f:
            existing_routes = json.load(f)
            
        with open(geom_path, 'r', encoding='utf-8') as f:
            existing_geom = json.load(f)

        # Remove previous metro entries if any
        clean_routes = [r for r in existing_routes if r.get('vehicle') != 'Metro']
        for k in list(existing_geom.keys()):
            if k.startswith('metro_'):
                del existing_geom[k]

        # Put metro routes at the very beginning so they appear prominently
        merged_routes = metro_routes + clean_routes
        for k, v in metro_geometries.items():
            existing_geom[k] = v

        with open(routes_path, 'w', encoding='utf-8') as f:
            json.dump(merged_routes, f, ensure_ascii=False)
            
        with open(geom_path, 'w', encoding='utf-8') as f:
            json.dump(existing_geom, f, ensure_ascii=False)
            
        print(f"Updated {routes_path} (total: {len(merged_routes)} routes, including {len(metro_routes)} Metro routes)")
        print(f"Updated {geom_path} (total geometries: {len(existing_geom)})")

    # 5. Integrate Metro Stations into stops_summary.json
    for d in ['data', 'public/data']:
        stops_path = f'{d}/stops_summary.json'
        with open(stops_path, 'r', encoding='utf-8') as f:
            existing_stops = json.load(f)

        clean_stops = [s for s in existing_stops if not str(s.get('id', '')).startswith('metro_')]
        metro_stops_formatted = []
        for st in unique_stations_list:
            metro_stops_formatted.append({
                "id": st["id"],
                "name_en": f"Metro: {st['name_en']}",
                "name_ar": f"مترو: {st['name_ar']}",
                "lat": st["lat"],
                "lng": st["lng"],
                "type": "metro",
                "lines": st["lines"],
                "is_interchange": st["is_interchange"]
            })

        merged_stops = metro_stops_formatted + clean_stops
        with open(stops_path, 'w', encoding='utf-8') as f:
            json.dump(merged_stops, f, ensure_ascii=False)
        print(f"Updated {stops_path} (total stops: {len(merged_stops)}, including {len(metro_stops_formatted)} Metro stations)")

    print("Metro data processing completed successfully!")

if __name__ == '__main__':
    process_metro()
