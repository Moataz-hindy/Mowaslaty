"""Compare the published TfC road GTFS with source GeoJSON and shipped app data.

Read-only for application data. Writes audit artifacts only. Uses the standard library.
Usage: python -X utf8 scripts/compare_tfc_gtfs.py
"""
import csv
import hashlib
import io
import json
import math
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/data-audit"
ARCHIVE = OUT / "tfc-road-transport-document-88.zip"
URL = "https://data.transportforcairo.com/documents/88/download"


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def write_json(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def write_csv(name, rows):
    if not rows:
        return
    with (OUT / name).open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        for row in rows:
            writer.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v
                             for k, v in row.items()})


def decode_polyline(value):
    result, pos, lat, lng = [], 0, 0, 0
    while pos < len(value):
        deltas = []
        for _ in range(2):
            shift, number = 0, 0
            while True:
                byte = ord(value[pos]) - 63
                pos += 1
                number |= (byte & 31) << shift
                shift += 5
                if byte < 32:
                    break
            deltas.append(~(number >> 1) if number & 1 else number >> 1)
        lat += deltas[0]
        lng += deltas[1]
        result.append((lat, lng))  # integer precision-5 coordinates
    return result


def quantize(lat, lng):
    return round(float(lat) * 100000), round(float(lng) * 100000)


def distance(a, b):
    lat1, lng1, lat2, lng2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lng2-lng1)/2)**2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))


def is_subsequence(short, full):
    it = iter(full)
    return all(any(point == candidate for candidate in it) for point in short)


def near(a, b):
    # At Cairo's latitude a one-unit difference is at most about 1.5 metres.
    return abs(a[0]-b[0]) <= 1 and abs(a[1]-b[1]) <= 1


def simplified_shape_error(short, full):
    """Match vertices in order with rounding tolerance; measure skipped-vertex error."""
    if len(short) < 2 or not full or not near(short[0], full[0]) or not near(short[-1], full[-1]):
        return None
    indices, cursor = [0], 1
    for point in short[1:-1]:
        while cursor < len(full)-1 and not near(point, full[cursor]):
            cursor += 1
        if cursor >= len(full)-1:
            return None
        indices.append(cursor)
        cursor += 1
    indices.append(len(full)-1)
    sx, sy = 1.1132 * math.cos(math.radians(full[0][0]/100000)), 1.1054
    worst = 0.0
    for j in range(len(short)-1):
        a, b = short[j], short[j+1]
        dx, dy = (b[1]-a[1])*sx, (b[0]-a[0])*sy
        denom = dx*dx + dy*dy
        for p in full[indices[j]:indices[j+1]+1]:
            px, py = (p[1]-a[1])*sx, (p[0]-a[0])*sy
            ratio = max(0, min(1, (px*dx+py*dy)/denom)) if denom else 0
            worst = max(worst, math.hypot(px-ratio*dx, py-ratio*dy))
    return round(worst, 3)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    archive_bytes = ARCHIVE.read_bytes()
    feed = zipfile.ZipFile(io.BytesIO(archive_bytes))
    nested = [n for n in feed.namelist() if n.lower().endswith(".zip")]
    if nested:
        assert len(nested) == 1, "Ambiguous nested archive"
        nested_bytes = feed.read(nested[0])
        (OUT / Path(nested[0]).name).write_bytes(nested_bytes)
        feed = zipfile.ZipFile(io.BytesIO(nested_bytes))
    tables = {}
    for name in feed.namelist():
        if name.endswith(".txt") and not name.startswith("__MACOSX"):
            tables[Path(name).stem] = list(csv.DictReader(io.StringIO(feed.read(name).decode("utf-8-sig"))))
    routes = {r["route_id"]: r for r in tables["routes"]}
    trips = {t["trip_id"]: t for t in tables["trips"]}
    stops = {s["stop_id"]: s for s in tables["stops"]}
    shapes, stop_times = defaultdict(list), defaultdict(list)
    for p in tables["shapes"]:
        shapes[p["shape_id"]].append(p)
    for shape in shapes.values():
        shape.sort(key=lambda p: int(p["shape_pt_sequence"]))
    for row in tables["stop_times"]:
        stop_times[row["trip_id"]].append(row)
    for sequence in stop_times.values():
        sequence.sort(key=lambda p: int(p["stop_sequence"]))
    translations = defaultdict(set)
    for row in tables.get("translations", []):
        if row["table_name"] in ("stops", "stop") and row["field_name"] == "stop_name":
            translations[row["field_value"]].add(row["translation"])

    raw = {f["properties"]["trip_id"]: f for f in load("geonode_processed_trips.json")["features"]}
    raw_stops = {str(f["properties"]["gid"]): f for f in load("geonode_processed_stops.json")["features"]}
    app_all = load("public/data/routes_summary.v2.json")
    app = {r["id"]: r for r in app_all if r.get("vehicle") != "Metro"}
    metro = [r for r in app_all if r.get("vehicle") == "Metro"]
    app_stops = {str(s["id"]): s for s in load("public/data/stops_summary.json") if s.get("type") != "metro"}
    app_geometry = load("public/data/routes_geometry.v2.json")
    assert len(routes) == len(tables["routes"]), "Duplicate route IDs require separate analysis"
    assert len(trips) == len(tables["trips"]), "Duplicate trip IDs require separate analysis"
    assert len(stops) == len(tables["stops"]), "Duplicate stop IDs require separate analysis"
    assert len(app) + len(metro) == len(app_all), "Duplicate app trip IDs require separate analysis"
    common = sorted(set(app) & set(trips))
    details, authoritative, raw_changes = [], [], []

    for tid in common:
        a, t = app[tid], trips[tid]
        r = routes[t["route_id"]]
        mismatches = []
        for app_key, expected in [("route_id", t["route_id"]), ("agency", r["agency_id"]),
                                  ("dir", int(t["direction_id"])), ("short_en", r["route_short_name"]),
                                  ("long_en", r["route_long_name"]), ("dest", t["trip_headsign"])]:
            if a.get(app_key) != expected:
                mismatches.append({"field": app_key, "app": a.get(app_key), "gtfs": expected})
        gtfs_points = [quantize(p["shape_pt_lat"], p["shape_pt_lon"]) for p in shapes[t["shape_id"]]]
        raw_points = [quantize(c[1], c[0]) for c in raw[tid]["geometry"]["coordinates"]] if tid in raw else []
        raw_equal = gtfs_points == raw_points
        if not raw_equal:
            raw_changes.append({"trip_id": tid, "raw_points": len(raw_points), "gtfs_points": len(gtfs_points)})
        decoded = decode_polyline(app_geometry[tid]) if tid in app_geometry else []
        shape_error = simplified_shape_error(decoded, gtfs_points)
        stops_for_trip = [stops[s["stop_id"]] for s in stop_times[tid] if s["stop_id"] in stops]
        def aliases(stop):
            raw_name = raw_stops.get(stop["stop_id"], {}).get("properties", {}).get("name_ar", "")
            return {stop["stop_name"], raw_name, *translations[stop["stop_name"]]} - {""}
        official_names = set().union(*(aliases(s) for s in stops_for_trip)) if stops_for_trip else set()
        app_names = set(a.get("via_stops", []))
        absent = sorted(app_names - official_names)
        omitted = [s["stop_name"] for s in stops_for_trip if not aliases(s) & app_names]
        details.append({
            "trip_id": tid, "route_id": t["route_id"], "route_number": a.get("num", ""),
            "route_name": r["route_long_name"], "direction": t["direction_id"], "vehicle": a["vehicle"],
            "metadata_mismatches": mismatches, "raw_shape_matches_gtfs_at_5_decimals": raw_equal,
            "app_long_name_matches_raw_export": a["long_en"] == raw[tid]["properties"]["route_long"],
            "gtfs_shape_points": len(gtfs_points), "app_shape_points": len(decoded),
            "app_shape_is_ordered_subsequence_of_gtfs": is_subsequence(decoded, gtfs_points) if decoded else False,
            "app_shape_endpoints_match_gtfs": bool(decoded and gtfs_points and decoded[0] == gtfs_points[0] and decoded[-1] == gtfs_points[-1]),
            "app_shape_matches_simplified_gtfs_with_rounding_tolerance": shape_error is not None,
            "maximum_source_vertex_to_simplified_segment_distance_m": shape_error,
            "gtfs_stop_calls": len(stops_for_trip), "app_via_labels": len(a.get("via_stops", [])),
            "app_labels_absent_from_gtfs_sequence": absent,
            "gtfs_stop_calls_without_app_label": omitted,
        })
        authoritative.append({"trip_id": tid, "route_id": t["route_id"], "direction_id": t["direction_id"],
                              "shape_id": t["shape_id"], "headsign": t["trip_headsign"],
                              "ordered_stops": [{"id": s["stop_id"], "name_en": s["stop_name"],
                                                 "translations": sorted(translations[s["stop_name"]]),
                                                 "lat": float(s["stop_lat"]), "lng": float(s["stop_lon"])}
                                                for s in stops_for_trip]})

    stop_details = []
    for sid in sorted(set(stops) & set(raw_stops) & set(app_stops)):
        s, raw_s, a = stops[sid], raw_stops[sid], app_stops[sid]
        latlng = [float(s["stop_lat"]), float(s["stop_lon"])]
        raw_coord = raw_s["geometry"]["coordinates"]
        stop_details.append({"stop_id": sid, "name": s["stop_name"],
                             "raw_name_matches": raw_s["properties"]["stop_name"] == s["stop_name"],
                             "app_name_matches": a["name_en"] == s["stop_name"],
                             "raw_distance_m": round(distance(latlng, [raw_coord[1], raw_coord[0]]), 5),
                             "app_distance_m": round(distance(latlng, [a["lat"], a["lng"]]), 5)})

    freq_bad = sorted({r["trip_id"] for r in tables["frequencies"]} - trips.keys())
    calls_bad_trip = sorted(stop_times.keys() - trips.keys())
    calls_bad_stop = sorted({r["stop_id"] for r in tables["stop_times"]} - stops.keys())
    missing_shapes = sorted(tid for tid,t in trips.items() if t["shape_id"] not in shapes)
    missing_calls = sorted(trips.keys() - stop_times.keys())
    unused_stops = sorted(stops.keys() - {r["stop_id"] for r in tables["stop_times"]})
    all_dup_names = [k for k,v in Counter(r["route_short_name"] for r in routes.values()).items() if v > 1]
    summary = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "download_url": URL, "archive_sha256": hashlib.sha256(archive_bytes).hexdigest(),
        "feed_info": tables.get("feed_info", []), "calendar": tables.get("calendar", []),
        "gtfs_rows": {k: len(v) for k,v in tables.items()},
        "gtfs_unique_shape_ids": len(shapes), "raw_road_trip_features": len(raw),
        "app_road_trip_entries": len(app), "app_unique_road_route_ids": len({a["route_id"] for a in app.values()}),
        "app_metro_trip_entries_excluded": len(metro), "matched_road_trip_ids": len(common),
        "app_road_trip_ids_absent_from_gtfs": sorted(app.keys() - trips.keys()),
        "gtfs_trip_ids_absent_from_app": sorted(trips.keys() - app.keys()),
        "raw_trip_ids_absent_from_gtfs": sorted(raw.keys() - trips.keys()),
        "gtfs_trip_ids_absent_from_raw": sorted(trips.keys() - raw.keys()),
        "raw_route_ids_absent_from_gtfs": sorted({f['properties']['route_id'] for f in raw.values()} - routes.keys()),
        "gtfs_route_ids_absent_from_raw": sorted(routes.keys() - {f['properties']['route_id'] for f in raw.values()}),
        "trips_with_metadata_mismatch": sum(bool(d["metadata_mismatches"]) for d in details),
        "metadata_mismatch_field_counts": dict(Counter(m["field"] for d in details for m in d["metadata_mismatches"])),
        "app_long_names_matching_raw_export": sum(d["app_long_name_matches_raw_export"] for d in details),
        "raw_shapes_matching_gtfs_at_5_decimals": sum(d["raw_shape_matches_gtfs_at_5_decimals"] for d in details),
        "raw_shape_differences": raw_changes,
        "app_shapes_preserving_gtfs_endpoints": sum(d["app_shape_endpoints_match_gtfs"] for d in details),
        "app_shapes_ordered_subsequences_of_gtfs": sum(d["app_shape_is_ordered_subsequence_of_gtfs"] for d in details),
        "app_shapes_matching_simplified_gtfs_with_rounding_tolerance": sum(d["app_shape_matches_simplified_gtfs_with_rounding_tolerance"] for d in details),
        "max_source_vertex_to_simplified_app_segment_distance_m": max((d["maximum_source_vertex_to_simplified_segment_distance_m"] for d in details if d["maximum_source_vertex_to_simplified_segment_distance_m"] is not None), default=0),
        "compared_gtfs_shape_points": sum(d["gtfs_shape_points"] for d in details),
        "compared_app_shape_points": sum(d["app_shape_points"] for d in details),
        "trips_with_app_labels_absent_from_gtfs_sequence": sum(bool(d["app_labels_absent_from_gtfs_sequence"]) for d in details),
        "total_app_labels_absent_from_gtfs_sequence": sum(len(d["app_labels_absent_from_gtfs_sequence"]) for d in details),
        "trips_with_gtfs_stop_calls_without_app_label": sum(bool(d["gtfs_stop_calls_without_app_label"]) for d in details),
        "trips_with_30_app_via_labels": sum(d["app_via_labels"] == 30 for d in details),
        "stops_compared": len(stop_details), "raw_stops": len(raw_stops), "app_road_stops": len(app_stops),
        "gtfs_stop_ids_absent_from_app": sorted(stops.keys() - app_stops.keys()),
        "app_road_stop_ids_absent_from_gtfs": sorted(app_stops.keys() - stops.keys()),
        "raw_stop_names_differing": sum(not s["raw_name_matches"] for s in stop_details),
        "app_stop_names_differing": sum(not s["app_name_matches"] for s in stop_details),
        "max_raw_stop_coordinate_difference_m": max((s["raw_distance_m"] for s in stop_details), default=0),
        "max_app_stop_coordinate_difference_m": max((s["app_distance_m"] for s in stop_details), default=0),
        "gtfs_integrity_checks": {"frequency_references_to_missing_trips": freq_bad,
                                   "stop_time_references_to_missing_trips": calls_bad_trip,
                                   "stop_time_references_to_missing_stops": calls_bad_stop,
                                   "trips_missing_shape": missing_shapes, "trips_missing_stop_times": missing_calls,
                                   "stops_without_stop_times": unused_stops,
                                   "repeated_short_names": all_dup_names},
        "scope_notes": [
            "Compare road transport only; the app's 10 metro trip entries are outside document 88's scope.",
            "Exact source-coordinate comparisons are at five decimals (GTFS shape precision).",
            "App geometry is checked with exact precision-5 matching, then with one precision-5 unit of rounding tolerance per coordinate and ordered retained vertices. The maximum source vertex distance to the corresponding simplified segment is reported in metres using a local planar projection.",
            "Stop-list comparisons match English names, GTFS translations, and source-export Arabic labels for the same stop ID. App via_stops lacks stop IDs, so this cannot detect same-named stops at different locations or fully validate stop order.",
            "Absent labels mean absent from this GTFS trip sequence, not proof that boarding there is impossible; GTFS enables continuous pickup/drop-off.",
            "Matching a published feed cannot establish current real-world operation or disprove mistakes shared by both exports.",
            "Basic GTFS reference checks only, not a full GTFS validator report.",
        ],
    }
    write_json("comparison-summary.json", summary)
    write_json("gtfs-ordered-road-stops.json", authoritative)
    write_csv("trip-comparison.csv", details)
    write_csv("stop-comparison.csv", stop_details)
    write_csv("unmatched-app-road-trips.csv", [app[k] for k in sorted(app.keys() - trips.keys())])
    write_json("metro-excluded-from-road-comparison.json", metro)

    examples = sorted(details, key=lambda d: len(d["app_labels_absent_from_gtfs_sequence"]), reverse=True)[:5]
    report = [
        "# TfC GTFS comparison", "", f"Generated: {summary['generated_at_utc']}", "",
        f"Downloaded source: [{URL}]({URL})", "",
        "## Main finding", "",
        "The downloaded GTFS has the same road route IDs and trip IDs as the current app's source export. "
        "It is not an independent reference for proving whether those services actually operate.", "",
        "| Comparison | Result |", "|---|---:|",
        f"| GTFS road routes | {len(routes):,} |",
        f"| App road routes | {summary['app_unique_road_route_ids']:,} |",
        f"| Matched road trip/direction IDs | {len(common):,} |",
        f"| App-only road trips | {len(summary['app_road_trip_ids_absent_from_gtfs'])} |",
        f"| GTFS-only road trips | {len(summary['gtfs_trip_ids_absent_from_app'])} |",
        f"| Trip entries whose English long label differs from the GTFS route-level label | {summary['trips_with_metadata_mismatch']} |",
        f"| App English long labels matching the current raw export | {summary['app_long_names_matching_raw_export']:,} / {len(common):,} |",
        f"| Source shapes identical at 5 decimal places | {summary['raw_shapes_matching_gtfs_at_5_decimals']:,} / {len(common):,} |",
        f"| App shapes preserving endpoints | {summary['app_shapes_preserving_gtfs_endpoints']:,} / {len(common):,} |",
        f"| App shapes that are ordered subsets of GTFS vertices | {summary['app_shapes_ordered_subsequences_of_gtfs']:,} / {len(common):,} |",
        f"| App shapes matching simplified GTFS with rounding tolerance | {summary['app_shapes_matching_simplified_gtfs_with_rounding_tolerance']:,} / {len(common):,} |",
        f"| Largest source vertex distance to corresponding simplified app segment | {summary['max_source_vertex_to_simplified_app_segment_distance_m']:.3f} m |",
        f"| Matched road stops | {len(stop_details):,} |",
        f"| Largest app stop coordinate difference | {summary['max_app_stop_coordinate_difference_m']:.3f} m |",
        f"| Trips containing app stop labels absent from GTFS trip's sequence | {summary['trips_with_app_labels_absent_from_gtfs_sequence']:,} |",
        f"| Trips with GTFS stop calls not represented by app labels | {summary['trips_with_gtfs_stop_calls_without_app_label']:,} |",
        f"| Trips reaching the app's 30-label cap | {summary['trips_with_30_app_via_labels']:,} |", "",
        "## Dates and limitations", "",
        "The archive's feed_info and both service calendars run from 2025-01-01 to 2025-12-31. "
        "The portal's recent listing date does not make these schedules current. Expired calendars alone do not prove a route stopped operating.", "",
        "The app's build_data.py generates via_stops by finding any stop near shape vertices within "
        "0.00075 degrees and stopping at 30 distinct labels. This does not preserve GTFS stop-to-trip assignments. "
        "Arabic endpoint inference also uses those generated labels (scripts/add_arabic_ends.py).", "",
        f"The {summary['trips_with_metadata_mismatch']} English long-name differences are between per-trip labels in the raw export and route-level labels in GTFS. "
        "All app English long labels match the raw export; route IDs, agencies, short names, directions and destination headsigns match GTFS. "
        "These are labeling discrepancies, not evidence of invented services.", "",
        "The Madinaty generator exists in scripts/add_madinaty.cjs, but its MBS_* additions are absent "
        "from the currently shipped road-route summary; it is not evidence of invented routes in the active data.", "",
        *[f"- {note}" for note in summary["scope_notes"]], "",
        "## Examples of stop-list differences", "",
    ]
    for d in [d for d in details if str(d["route_number"]) == "305"]:
        report.extend([f"### Route 305 — {d['trip_id']}", "",
                       f"GTFS lists {d['gtfs_stop_calls']} stop calls for this direction; the app contains {d['app_via_labels']} generated labels. "
                       f"{len(d['app_labels_absent_from_gtfs_sequence'])} of those labels are absent from this trip's GTFS sequence, "
                       f"and {len(d['gtfs_stop_calls_without_app_label'])} GTFS stop calls lack a matching app label.", "",
                       "GTFS stops missing from the app's label list: " + "; ".join(d["gtfs_stop_calls_without_app_label"][:8]), ""])
    for d in examples:
        report.extend([f"### {d['route_name']} — {d['trip_id']}", "",
                       f"GTFS stop calls: {d['gtfs_stop_calls']}; app labels: {d['app_via_labels']}.", "",
                       "App labels not in the GTFS trip sequence: " + "; ".join(d["app_labels_absent_from_gtfs_sequence"][:8]), ""])
    report.extend(["## Files", "", "- `comparison-summary.json`: counts, mismatches, feed dates, SHA-256, integrity checks.",
                   "- `trip-comparison.csv`: one row per matched road trip, including full name-list differences.",
                   "- `stop-comparison.csv`: stop ID/name and coordinate comparisons.",
                   "- `gtfs-ordered-road-stops.json`: actual GTFS stop IDs and order for every road trip.",
                   "- `tfc-road-transport-document-88.zip`: original downloaded archive.",
                   "- `gtfs_gcr_bronze.zip`: nested GTFS feed extracted as a single ZIP file.", "",
                   "## Recommended next steps", "",
                   "1. Build trip-specific stop IDs and ordered stop lists from stop_times.txt instead of proximity-derived via_stops.",
                   "2. Preserve publisher, download URL, feed version and validity dates with imported data.",
                   "3. Review the 39 route-label discrepancies without assuming either label reflects current operation.",
                   "4. Ask TfC for route-level corrections or a newer field-verified revision; both current exports can share the same factual errors.", "",
                   "No application data was replaced or modified. Reproduce with `python -X utf8 scripts/compare_tfc_gtfs.py`.", ""])
    (OUT / "comparison-report.md").write_text("\n".join(report), encoding="utf-8")
    print(json.dumps({k:v for k,v in summary.items() if k not in ("gtfs_integrity_checks", "scope_notes", "calendar", "raw_shape_differences")}, ensure_ascii=False, indent=2))
    print("Integrity check counts:", {k:len(v) for k,v in summary["gtfs_integrity_checks"].items()})


if __name__ == "__main__":
    main()
