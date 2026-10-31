"""Complete Arabic route labels from existing bilingual evidence, preserving English.

Run after rebuilding transit assets: python scripts/localize_arabic_names.py
This changes display names only, never IDs, stop order, coordinates or geometry.
"""
from collections import Counter, defaultdict
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
LATIN = re.compile(r'[A-Za-z]')
ENDPOINT_OVERRIDES = {
    'Al Bassous': 'الباسوس',
    'Cairo University Metro': 'مترو جامعة القاهرة',
    'Hamada Emam': 'حمادة إمام',
    'Haram Talbeya': 'الطالبية (الهرم)',
}
STOP_REPLACEMENTS = {
    'QNB': 'كيو إن بي',
    ' (MSA)': '',
    ' (FUE)': '',
    ' (MIU)': '',
}


def arabic_label(value):
    if not isinstance(value, str):
        return value
    for original, replacement in STOP_REPLACEMENTS.items():
        value = value.replace(original, replacement)
    return value


def localize(routes, stops, network):
    evidence = defaultdict(Counter)
    for route in routes:
        for field in ('origin', 'dest'):
            english = route.get(field + '_en') or route.get(field)
            arabic = route.get(field + '_ar')
            if english and arabic and not LATIN.search(arabic):
                evidence[english][arabic] += 1
    translations = {english: variants.most_common(1)[0][0] for english, variants in evidence.items()}
    translations.update(ENDPOINT_OVERRIDES)
    # Resolve every name before mutating or writing anything; an unknown label
    # needs review, rather than a generic placeholder or a guessed destination.
    resolved = []
    for route in routes:
        endpoints = {}
        for field in ('origin', 'dest'):
            raw = route.get(field)
            english = route.get(field + '_en') or (raw if raw and LATIN.search(raw) else None)
            arabic = route.get(field + '_ar') or (raw if raw and not LATIN.search(raw) else None)
            if not arabic and english:
                arabic = translations.get(english)
            if not arabic or LATIN.search(arabic):
                raise ValueError(f'Arabic endpoint requires review: {route.get("id")} / {english or raw}')
            endpoints[field] = (english, arabic)
        resolved.append(endpoints)
    for route, endpoints in zip(routes, resolved):
        for field, (english, arabic) in endpoints.items():
            if english:
                route.setdefault(field + '_en', english)
            route[field + '_ar'] = arabic
            route[field] = arabic
        route['via_stops'] = [arabic_label(value) for value in route.get('via_stops', [])]
    by_id = {route['id']: route for route in routes}
    for route in network.get('routes', []):
        summary = by_id.get(route.get('id'))
        if summary:
            for field in ('origin', 'dest', 'origin_ar', 'dest_ar', 'origin_en', 'dest_en'):
                if field in summary:
                    route[field] = summary[field]
    for stop in stops:
        stop['name_ar'] = arabic_label(stop.get('name_ar'))
    for stop in network.get('stops', []):
        stop['nameAr'] = arabic_label(stop.get('nameAr'))


def main():
    paths = [ROOT / 'public/data' / name for name in (
        'routes_summary.v2.json', 'stops_summary.json', 'routing_network.v1.json')]
    originals = [path.read_text(encoding='utf-8') for path in paths]
    routes, stops, network = [json.loads(text) for text in originals]
    localize(routes, stops, network)
    for path, original, data in zip(paths, originals, (routes, stops, network)):
        pretty = original.count('\n') > 1
        result = json.dumps(data, ensure_ascii=False, indent=2 if pretty else None,
                            separators=None if pretty else (',', ':'))
        if original.endswith('\n'):
            result += '\n'
        if result != original:
            path.write_text(result, encoding='utf-8')
    print(f'Arabic endpoints complete for {len(routes)} routes; English labels preserved.')


if __name__ == '__main__':
    main()
