"""Build public/data/routing_network.v1.json from the pinned local GTFS feed.

Schema v1: {version, metadata, stops:[{id,nameEn,nameAr,lat,lng,source}],
trips:[{id,appRouteId,routeId,source,shapeId,calls:[{stopId,sequence,
canBoard,canAlight,distanceMeters,distanceEstimated}]}]}. Trip IDs are
application direction IDs; GTFS trip_id is retained as sourceTripId.
"""
import csv
import json
import math
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZIP_PATH = ROOT / "artifacts/data-audit/gtfs_gcr_bronze.zip"
ROUTES_PATH = ROOT / "public/data/routes_summary.v2.json"
STOPS_PATH = ROOT / "public/data/stops_summary.json"
ORDERED_PATH = ROOT / "artifacts/data-audit/gtfs-ordered-road-stops.json"
OUT_PATH = ROOT / "public/data/routing_network.v1.json"


def read_csv(zf, name):
    return list(csv.DictReader(line.decode("utf-8-sig") for line in zf.open(name)))


def valid_coord(lat, lng):
    try:
        lat, lng = float(lat), float(lng)
        return math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180
    except (TypeError, ValueError):
        return False


def distance_m(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371008.8 * 2 * math.asin(min(1, math.sqrt(h)))


def permission_for_call(call, route=None):
    # GTFS pickup/drop-off type 0 is the default scheduled-call permission.
    # Continuous pickup/drop-off applies between stops and is not used here.
    def allowed(key):
        value = str(call.get(key, "0") or "0")
        return value == "0"
    return allowed("pickup_type"), allowed("drop_off_type")


def ordered_calls(rows):
    rows = sorted(rows, key=lambda r: int(r.get("stop_sequence") or 0))
    return [{"stop_id": row["stop_id"], "sequence": int(row["stop_sequence"])} for row in rows]


def match_metro_station(name, line, stops):
    target = str(name or "").strip()
    candidates = [s for s in stops if s.get("type") == "metro" and line in s.get("lines", [])
                  and str(s.get("name_en", "")).removeprefix("Metro: ").strip() == target]
    if len(candidates) == 1:
        return {"stop": candidates[0], "reason": None}
    return {"stop": None, "reason": "missing" if not candidates else "ambiguous"}


def build_network():
    routes = json.loads(ROUTES_PATH.read_text(encoding="utf-8"))
    app_routes = {r["id"]: r for r in routes}
    public_stops = json.loads(STOPS_PATH.read_text(encoding="utf-8"))
    metro_stops = {s["id"]: s for s in public_stops if s.get("type") == "metro" and valid_coord(s.get("lat"), s.get("lng"))}
    ordered = json.loads(ORDERED_PATH.read_text(encoding="utf-8"))
    gtfs_stops = {}
    gtfs_trips = {}
    route_permissions = {}
    stop_calls = defaultdict(list)
    with zipfile.ZipFile(ZIP_PATH) as zf:
        feed_info = read_csv(zf, "feed_info.txt")
        for row in read_csv(zf, "stops.txt"):
            if valid_coord(row.get("stop_lat"), row.get("stop_lon")):
                gtfs_stops[row["stop_id"]] = row
        gtfs_trips = {r["trip_id"]: r for r in read_csv(zf, "trips.txt")}
        for row in read_csv(zf, "routes.txt"):
            route_permissions[row["route_id"]] = row
        for row in read_csv(zf, "stop_times.txt"):
            stop_calls[row["trip_id"]].append(row)

    network_stops = {}
    trips = []
    missing = []
    audit_by_id = {item["trip_id"]: item for item in ordered}
    for app_id, audit in audit_by_id.items():
        trip_id = audit["trip_id"]
        gtfs_trip = gtfs_trips.get(trip_id)
        if app_id not in app_routes or not gtfs_trip or not stop_calls.get(trip_id):
            missing.append({"id": app_id, "reason": "missing-app-route-or-gtfs-trip-calls"})
            continue
        call_rows = ordered_calls(stop_calls[trip_id])
        by_sequence = {int(r["stop_sequence"]): r for r in stop_calls[trip_id]}
        # Use ordered audit coordinates as the canonical call coordinate data.
        audit_calls = {str(c["id"]): c for c in audit.get("ordered_stops", [])}
        calls = []
        previous = None
        cumulative = 0.0
        malformed = False
        for raw in call_rows:
            stop_id = raw["stop_id"]
            source_stop = gtfs_stops.get(stop_id)
            if not source_stop:
                malformed = True
                break
            coord = [float(source_stop["stop_lat"]), float(source_stop["stop_lon"])]
            stop_key = f"road:{stop_id}"
            audit_stop = audit_calls.get(stop_id, {})
            network_stops.setdefault(stop_key, {"id": stop_key, "sourceId": stop_id,
                "nameEn": source_stop.get("stop_name") or audit_stop.get("name_en") or stop_id,
                "nameAr": next(iter(audit_stop.get("translations", [])), ""),
                "lat": coord[0], "lng": coord[1], "source": "gtfs"})
            if previous is not None:
                cumulative += distance_m(previous, coord)
            original = by_sequence[raw["sequence"]]
            can_board, can_alight = permission_for_call(original, route_permissions.get(gtfs_trip["route_id"]))
            calls.append({"stopId": stop_key, "sequence": raw["sequence"], "canBoard": can_board,
                          "canAlight": can_alight, "distanceMeters": round(cumulative, 1),
                          "distanceEstimated": True})
            previous = coord
        if malformed or len(calls) < 2:
            missing.append({"id": app_id, "reason": "single-call-trip" if len(calls) < 2 else "invalid-stop-call"})
            continue
        trips.append({"id": app_id, "sourceTripId": trip_id, "appRouteId": app_id,
                      "routeId": audit["route_id"], "source": "gtfs", "shapeId": audit.get("shape_id"),
                      "directionId": audit.get("direction_id"), "distanceEstimated": True, "calls": calls})

    metro_errors = []
    for route in routes:
        if route.get("vehicle") != "Metro":
            continue
        names = route.get("via_stops_en") or []
        matched = []
        for name in names:
            result = match_metro_station(name, route.get("num"), list(metro_stops.values()))
            if result["stop"] is None:
                metro_errors.append({"id": route["id"], "station": name, "reason": result["reason"]})
            else:
                matched.append(result["stop"])
        if len(matched) != len(names) or len(matched) < 2:
            continue
        calls = []
        cumulative = 0.0
        for index, stop in enumerate(matched):
            key = f"metro:{stop['id']}"
            network_stops.setdefault(key, {"id": key, "sourceId": stop["id"], "nameEn": stop.get("name_en", ""),
                "nameAr": stop.get("name_ar", ""), "lat": stop["lat"], "lng": stop["lng"], "source": "manual-metro"})
            if index:
                prev = matched[index - 1]
                cumulative += distance_m([prev["lat"], prev["lng"]], [stop["lat"], stop["lng"]])
            calls.append({"stopId": key, "sequence": index + 1, "canBoard": True, "canAlight": True,
                          "distanceMeters": round(cumulative, 1), "distanceEstimated": True})
        trips.append({"id": route["id"], "sourceTripId": route["id"], "appRouteId": route["id"],
                      "routeId": route.get("route_id"), "source": "metro-manual", "shapeId": None,
                      "directionId": route.get("dir"), "distanceEstimated": True, "calls": calls})

    route_labels = [{key: route.get(key) for key in ("id", "route_id", "num", "vehicle", "short_en", "short_ar", "long_en", "long_ar", "origin_en", "dest_en", "origin_ar", "dest_ar", "color", "agency") if route.get(key) is not None} for route in routes]
    return {"version": 1, "metadata": {"generatedAt": "2026-10-23", "source": "historical-gtfs-and-manual-metro",
        "feedStartDate": feed_info[0].get("feed_start_date") if feed_info else None,
        "feedEndDate": feed_info[0].get("feed_end_date") if feed_info else None,
        "historical": True, "servicesVerified": False, "rideDistanceMethod": "successive-stop-haversine-estimate",
        "roadTripCount": sum(t["source"] == "gtfs" for t in trips),
        "metroDirectionCount": sum(t["source"] == "metro-manual" for t in trips),
        "unmatchedRoadDirections": missing, "unmatchedMetroStations": metro_errors},
        "routes": route_labels, "stops": list(network_stops.values()), "trips": trips}


def main():
    network = build_network()
    OUT_PATH.write_text(json.dumps(network, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"output": str(OUT_PATH), "stops": len(network["stops"]), "trips": len(network["trips"]),
        "metadata": network["metadata"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
