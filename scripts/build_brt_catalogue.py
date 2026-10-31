"""Build the app's BRT catalogue from the reviewed community GeoJSON candidate.

Coordinates are community reference geography. The SIS operating boundary and
dated press reports provide service context; station entrances remain unverified.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "artifacts/brt-research/brt-community-candidate.geojson"
OUT_PATH = ROOT / "public/data/brt_catalogue.v1.json"
COMMUNITY_URL = "https://earth.google.com/earth/d/1O7T1TETomHyJHKgIyAIKkQpWjoXuzrun"

ENGLISH = {
    "الاسكندرية الزراعى": "Alexandria Agricultural Road", "العقيد احمد عبدالرحيم": "Colonel Ahmed Abdel Rahim",
    "شبرا بنها": "Shubra–Benha", "بهتيم": "Bahtim", "مسطرد": "Mostorod", "الخصوص": "El-Khosous",
    "المرج": "El-Marg", "محمد نجيب": "Mohamed Naguib", "مؤسسة الزكاة": "Mossaset El-Zakah",
    "الفريق ابراهيم عرابي": "General Ibrahim Orabi", "السلام": "El-Salam", "عدلى منصور": "Adly Mansour",
    "طريق السويس": "Suez Road", "أكاديمية الشرطة": "Police Academy", "المشير طنطاوى": "Field Marshal Tantawy",
    "الجولف": "Golf", "طريق السخنة": "Ain Sokhna Road", "المعادي": "Maadi", "زهراء المعادي": "Zahraa Al Maadi",
    "المقطم": "Mokattam", "الاوتوستراد": "Autostrad", "محور الجزائر": "Algeria Axis",
    "الإمامين": "El-Emamein", "الزهراء": "El-Zahraa", "البحر الاعظم": "El-Bahr El-Aazam",
    "العمرانية": "El-Omraniya", "الطالبية": "El-Talbia", "المريوطية": "El-Maryoutia",
    "المنصورية": "Mansouriya", "صن كابيتال": "Sun Capital", "زويل": "Zewail", "المتحف المصري الكبير": "Grand Egyptian Museum"
}
EXCLUDED = {"زهراء المعادي": "Opening reported as subsequent; no later confirmation found in the research review.",
            "الاوتوستراد": "Opening reported as subsequent; no later confirmation found in the research review.",
            "المنصورية": "Opening reported as subsequent; no later confirmation found in the research review."}
FUTURE = {"زويل", "المتحف المصري الكبير"}
ALIAS_REVIEW = {"محمد نجيب": {"alias": "القلج", "note": "Community placemark says Mohamed Naguib; the early station list says Al Qalag. Alias has not been resolved."}}


def project(point, a, b):
    lat0 = math.radians(point[1])
    scale_x = math.cos(lat0) * 111320
    scale_y = 110574
    px, py = point[0] * scale_x, point[1] * scale_y
    ax, ay, bx, by = a[0] * scale_x, a[1] * scale_y, b[0] * scale_x, b[1] * scale_y
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2)) if length2 else 0.0
    return math.hypot(px - ax - t * dx, py - ay - t * dy), t


def distance(a, b):
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, math.radians(b[0] - a[0])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371008.8 * 2 * math.asin(min(1.0, math.sqrt(h)))


def build():
    geo = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    line_feature = next(f for f in geo["features"] if f["geometry"]["type"] == "LineString")
    points = [f for f in geo["features"] if f["geometry"]["type"] == "Point"]
    by_name = {f["properties"]["name"]: f["geometry"]["coordinates"] for f in points}
    line = line_feature["geometry"]["coordinates"]
    end_point = by_name["صن كابيتال"]
    candidates = []
    for i in range(1, len(line)):
        miss, t = project(end_point, line[i - 1], line[i])
        candidates.append((miss, i, t))
    miss, end_index, t = min(candidates)
    trimmed = line[:end_index] + [[line[end_index - 1][0] + t * (line[end_index][0] - line[end_index - 1][0]),
                                   line[end_index - 1][1] + t * (line[end_index][1] - line[end_index - 1][1])]]
    cumulative = [0.0]
    for a, b in zip(trimmed, trimmed[1:]):
        cumulative.append(cumulative[-1] + distance(a, b))
    stations = []
    for index, (name, coord) in enumerate(by_name.items()):
        if name in FUTURE:
            status = "future-extension"
        elif name in EXCLUDED:
            status = "excluded-unconfirmed-opening"
        else:
            status = "active-corridor-candidate"
        best = None
        for i in range(1, len(trimmed)):
            deviation, fraction = project(coord, trimmed[i - 1], trimmed[i])
            along = cumulative[i - 1] + fraction * (cumulative[i] - cumulative[i - 1])
            if best is None or deviation < best[0]:
                best = (deviation, along)
        aliases = [ENGLISH[name], name]
        if name in ALIAS_REVIEW:
            aliases.append(ALIAS_REVIEW[name]["alias"])
        stations.append({"id": f"brt:station:{index + 1:02d}", "sourceName": name,
            "nameAr": name, "nameEn": ENGLISH[name], "aliases": aliases,
            "lat": coord[1], "lng": coord[0], "status": status,
            "distanceMeters": round(best[1], 1), "geometryOffsetMeters": round(best[0], 1),
            "stationAccessVerified": False, "transferAccessVerified": False,
            "nameVerification": "alias-review" if name in ALIAS_REVIEW else "unverified-community-name",
            **({"nameReviewNote": ALIAS_REVIEW[name]["note"]} if name in ALIAS_REVIEW else {}),
            **({"exclusionReason": EXCLUDED[name]} if name in EXCLUDED else {})})
    station_by_name = {s["sourceName"]: s for s in stations}
    return {"version": 1,
        "source": {"name": "The Great Cairo Transportation community Google Earth project", "url": COMMUNITY_URL,
            "verification": "unverified-community-reference", "checkedDate": "2026-10-30"},
        "service": {"status": "provisional-reported", "startStationId": station_by_name["الاسكندرية الزراعى"]["id"],
            "endStationId": station_by_name["صن كابيتال"]["id"], "boardingMode": "fixed-station",
            "corridorStatusSource": "https://sis.gov.eg/ar/المركز-الإعلامي/الأخبار/بدء-تشغيل-المرحلة-الثانية-للأتوبيس-الترددي-السريع-brt-وتوافد-المواطنين-على-محطاتها/",
            "patternSources": [
                {"url": "https://www.elwatannews.com/news/details/8386151", "publishedAt": "2026-10-28T20:47", "description": "Report quoting operator on agricultural-road to Sun Capital service in both directions."},
                {"url": "https://www.almasryalyoum.com/news/details/4395669", "publishedAt": "2026-10-28T23:12", "description": "Report quoting operator on agricultural-road to Sun Capital service in both directions."}],
            "caveat": "Reported current full-corridor pattern; service calls and individual station status have not been verified directly with the operator. The Mohamed Naguib / Al Qalag alias remains under review."},
        "geometry": {"source": COMMUNITY_URL, "verification": "unverified-community-reference",
            "coordinates": trimmed, "trimmedAtStationId": station_by_name["صن كابيتال"]["id"],
            "endpointProjectionMeters": round(miss, 1)},
        "stations": stations}


if __name__ == "__main__":
    catalogue = build()
    OUT_PATH.write_text(json.dumps(catalogue, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"output": str(OUT_PATH), "stations": len(catalogue["stations"]),
        "geometryVertices": len(catalogue["geometry"]["coordinates"]),
        "operatingStationCandidates": sum(s["status"] == "active-corridor-candidate" for s in catalogue["stations"]),
        "endpointProjectionMeters": catalogue["geometry"]["endpointProjectionMeters"]}, ensure_ascii=False))
