# Cairo BRT feasibility — 30 October 2026

## Conclusion

BRT can be added to the existing planner without an official GeoJSON. Verified ordered stations, direction patterns, access points and plausible cumulative distances are the essential routing inputs. A route shape improves map display and distance estimates. The app already uses encoded polylines, so GeoJSON is an interchange format, not a runtime requirement.

The Facebook reference supplied by the user materially improves data availability: its shared Google Earth project permits KML export. A reference export was inspected locally and its BRT folder converted to `brt-community-candidate.geojson`. This is research data only; no application data, APK, release manifest or deployment was changed.

## What was found

- Community project **The Great Cairo Transportation**: 32 BRT station placemarks and one 313-vertex path, about **84.9 km** from Alexandria Agricultural Road to the Grand Egyptian Museum. Includes Sun Capital and Zewail. This is not proof that all included stations operate.
- All candidate station points are within approximately 5.1m of that community path. This checks internal consistency, not independent accuracy or station entrance positions.
- The project's OSM-derived `public/data/places.v1.json` already contains three explicitly BRT-labelled records: two around Adly Mansour and one at El Mosher Tantawy. These are additional candidate locations, not a complete verified station inventory.
- No official downloadable BRT GTFS or GeoJSON was located in the sources checked. The operator website did not load through the research tool. A live Overpass lookup returned HTTP 406; availability of a complete OSM BRT relation was therefore not established.

## Sources and operating status

- [Official SIS account of the 26 September 2026 opening](https://sis.gov.eg/ar/المركز-الإعلامي/الأخبار/بدء-تشغيل-المرحلة-الثانية-للأتوبيس-الترددي-السريع-brt-وتوافد-المواطنين-على-محطاتها/): service extended to Sun Capital; the ministry describes the operating corridor from Alexandria Agricultural Road as approximately 75km. Zahraa Al Maadi, Autostrad and Mansouriya were described as opening subsequently. Their later opening was not independently confirmed during this research.
- [Ministry announcement published by SIS, 24 September 2026](https://sis.gov.eg/ar/المركز-الإعلامي/الأخبار/وزير-النقل-يعلن-بدء-تشغيل-المرحلة-الثانية-من-الأتوبيس-الترددى-السبت-المقبل/): identifies the phase-two service boundary and staggered station openings. Use newer operating announcements ahead of old full-project diagrams.
- [Cairo Governorate BRT information](https://cairo.gov.eg/en/governorate-services/transportation-services/bus-rapid-transit/): useful project context and station access via bridges/tunnels; not sufficient by itself to establish every station's current status.
- [User-supplied Facebook post](https://www.facebook.com/share/p/1F9Wfmz282/), by a lawyers' community page, displayed date **27 September**: station links and a shared map, not an operator publication. The attached graphic mixes a 48-station/full-ring heading with 32 listed stations, whole-project length information and future Metro 4/6 interchanges. Do not import these claims as operating facts.
- [Shared Google Earth project](https://earth.google.com/earth/d/1O7T1TETomHyJHKgIyAIKkQpWjoXuzrun?usp=sharing): useful candidate geography. Preserve source attribution and establish reuse terms before distributing derived community artwork/data in a release.

## Verification needed before planner activation

1. Verify official names, aliases, coordinates and platform/entrance locations. The KML uses Mohamed Naguib where the post/official early station list uses Al Qalag; confirm the intended alias rather than silently merging names.
2. Assign dated operating statuses to individual stations and service patterns. Exclude unconfirmed sections from journey results. Do not close the route into a full Ring Road loop or assume a through bus across phases without operational confirmation.
3. Check community path against road geography; trim to the verified service endpoints. Create separate direction records and check station order and ramps/carriageway differences.
4. Verify walking access and transfers via actual entrances, bridges and tunnels. A near map location is not an accessible interchange. For example, the candidate Alexandria Agricultural Road point is about **3.3km straight-line** from our stored nearest Metro M2 station, Shubra El Kheima. The post's generic M2 interchange label must not become a direct transfer edge automatically.
5. Confirm current timetable/headways and fare rules separately. No exact real-time arrivals, newly assumed headways or phase-wide flat fares should be fabricated from an old poster. Mark estimated ride times/distances explicitly.

## Project integration

- Keep a source catalogue (stations, aliases, operating status, source URL, checked date, coordinates and entrance metadata) separate from generated app assets.
- Generate BRT route summaries and direction-specific encoded shapes alongside the current data, using a distinct `vehicle: BRT` classification and route IDs. Include it in filters, labels, colours, search and selected-route display.
- Extend the network builder (`scripts/build_routing_network.py`) with a BRT source adapter. Produce stops and trips with ordered `calls`, strictly increasing `sequence`, cumulative `distanceMeters`, and explicit boarding/alighting permissions. No live timetable is necessary for basic estimated connectivity planning.
- The planner (`src/utils/routingNetwork.js`, `src/utils/tripPlanner.js`) already searches ordered calls and nearby transfers. It can therefore propose BRT-only and mixed BRT/bus/metro journeys with verified access connections.
- **Fixed-stop rule:** `flexiblePathFor` currently excludes only Metro from arbitrary along-path drop-offs. BRT must also be excluded, preferably through a route capability such as station-only boarding/alighting rather than another hardcoded vehicle exception. The nearest/drop-off and search tools need the same rule.
- Use the community shape only after review. If no acceptable path is available, derive a provisional line from ordered stations and the appropriate Ring Road sections in OSM, retaining provenance and estimated status. Existing local `osm/egypt-261013.osm.pbf` provides a potential road-data source, but BRT lane completeness was not checked.
- A geometry-free prototype can display a clearly marked schematic station chain, but straight station chords are not a road-accurate route or a sound source of ride distance. `journeyRidePath` has a fallback, while selected-line display currently requires geometry; provide intentional estimated rendering rather than relying on that fallback silently.
- Current journey durations use a generic ride-speed estimate and global historical-data warnings. BRT should carry source/quality metadata through the pipeline so estimates are labelled correctly and fresh BRT records are not automatically described as historical GTFS.
- Test station-only boarding/alighting, both directions, operational boundaries, safe transfers, geometry provenance, no invented loop, estimated timing, route filters and Android offline assets before eventual release.

## Recommended delivery order

1. Validate the candidate station catalogue and operating section.
2. Add a local BRT reference/network view with provenance.
3. Enable verified station-based planner connections and estimated travel times.
4. Add/review the road-aligned shape and improve timing/fare metadata when sourced.

All implementation and release work remains pending; this folder contains research references only.
