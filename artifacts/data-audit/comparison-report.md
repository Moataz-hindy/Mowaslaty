# TfC GTFS comparison

Generated: 2026-10-23T09:08:00.932561+00:00

Downloaded source: [https://data.transportforcairo.com/documents/88/download](https://data.transportforcairo.com/documents/88/download)

## Main finding

The downloaded GTFS has the same road route IDs and trip IDs as the current app's source export. It is not an independent reference for proving whether those services actually operate.

| Comparison | Result |
|---|---:|
| GTFS road routes | 1,011 |
| App road routes | 1,011 |
| Matched road trip/direction IDs | 1,784 |
| App-only road trips | 0 |
| GTFS-only road trips | 0 |
| Trip entries whose English long label differs from the GTFS route-level label | 39 |
| App English long labels matching the current raw export | 1,784 / 1,784 |
| Source shapes identical at 5 decimal places | 1,784 / 1,784 |
| App shapes preserving endpoints | 1,615 / 1,784 |
| App shapes that are ordered subsets of GTFS vertices | 764 / 1,784 |
| App shapes matching simplified GTFS with rounding tolerance | 1,784 / 1,784 |
| Largest source vertex distance to corresponding simplified app segment | 6.279 m |
| Matched road stops | 2,997 |
| Largest app stop coordinate difference | 0.735 m |
| Trips containing app stop labels absent from GTFS trip's sequence | 1,705 |
| Trips with GTFS stop calls not represented by app labels | 1,372 |
| Trips reaching the app's 30-label cap | 795 |

## Dates and limitations

The archive's feed_info and both service calendars run from 2025-01-01 to 2025-12-31. The portal's recent listing date does not make these schedules current. Expired calendars alone do not prove a route stopped operating.

The app's build_data.py generates via_stops by finding any stop near shape vertices within 0.00075 degrees and stopping at 30 distinct labels. This does not preserve GTFS stop-to-trip assignments. Arabic endpoint inference also uses those generated labels (scripts/add_arabic_ends.py).

The 39 English long-name differences are between per-trip labels in the raw export and route-level labels in GTFS. All app English long labels match the raw export; route IDs, agencies, short names, directions and destination headsigns match GTFS. These are labeling discrepancies, not evidence of invented services.

The Madinaty generator exists in scripts/add_madinaty.cjs, but its MBS_* additions are absent from the currently shipped road-route summary; it is not evidence of invented routes in the active data.

- Compare road transport only; the app's 10 metro trip entries are outside document 88's scope.
- Exact source-coordinate comparisons are at five decimals (GTFS shape precision).
- App geometry is checked with exact precision-5 matching, then with one precision-5 unit of rounding tolerance per coordinate and ordered retained vertices. The maximum source vertex distance to the corresponding simplified segment is reported in metres using a local planar projection.
- Stop-list comparisons match English names, GTFS translations, and source-export Arabic labels for the same stop ID. App via_stops lacks stop IDs, so this cannot detect same-named stops at different locations or fully validate stop order.
- Absent labels mean absent from this GTFS trip sequence, not proof that boarding there is impossible; GTFS enables continuous pickup/drop-off.
- Matching a published feed cannot establish current real-world operation or disprove mistakes shared by both exports.
- Basic GTFS reference checks only, not a full GTFS validator report.

## Examples of stop-list differences

### Route 305 — 3ZA9yhKgNaHbbYLy2R_Ch

GTFS lists 33 stop calls for this direction; the app contains 30 generated labels. 10 of those labels are absent from this trip's GTFS sequence, and 12 GTFS stop calls lack a matching app label.

GTFS stops missing from the app's label list: Al Sahel Fire Department; Triumph Hotel; Souq Al Asr (Khalifa Al Mamoun St.); Alex Bank (Al Hegaz); Heliopolis Hospital; Al Hegaz Square; National Institute for Occupational Safety and Health (Al Amn Al Senaey); Al Sayeda Khadija Mosque

### Route 305 — Aiq7p6R3Jnp6Bok0aX9Re

GTFS lists 31 stop calls for this direction; the app contains 30 generated labels. 14 of those labels are absent from this trip's GTFS sequence, and 13 GTFS stop calls lack a matching app label.

GTFS stops missing from the app's label list: Shams Club Squash Courts; Alex Bank (Al Hegaz); Manshiyat Al Gamal; Al Zawya Al Hamra; Abou Wafya Bridge; Al Sahel Youth Center; Al Fath Mosque (Mansheyyet Al Gamal St.); Al Khalafawy Square

### Qalyoub Exit - Wizarat District - New Administrative Capital — 49Lt1kKFfGCSPZKc8R4LQ_R

GTFS stop calls: 5; app labels: 30.

App labels not in the GTFS trip sequence: الخصوص; السلام; العاشر من رمضان; العاشر من رمضان (طريق الإسماعيلية الصحراوي); العثمان للسيارات (الطريق الدائري); بداية نفق السلام الطريق الدائري; جسر مسطرد (الطريق الدائري); خطوات ابو صير (الطريق الدائرى)

### Church (Kayan) - New Administrative Capital - Qalyoub Exit — bBGSiORySswlj4oOCxk3H_R

GTFS stop calls: 5; app labels: 30.

App labels not in the GTFS trip sequence: الخصوص; السلام; العاشر من رمضان; العاشر من رمضان (طريق الإسماعيلية الصحراوي); العثمان للسيارات (الطريق الدائري); بداية نفق السلام الطريق الدائري; جسر مسطرد (الطريق الدائري); خطوات ابو صير (الطريق الدائرى)

### Qalyoub Exit - Wizarat District - New Administrative Capital — 49Lt1kKFfGCSPZKc8R4LQ_O

GTFS stop calls: 4; app labels: 30.

App labels not in the GTFS trip sequence: الخصوص; السلام; العاشر من رمضان; العثمان للسيارات (الطريق الدائري); المرج الجديد; بهتيم; جسر مسطرد (الطريق الدائري); جسرعثمان للمشاة (الطريق الدائري)

### Badr City - Qalyoub Exit — PWCFW_a8c-PDr7QO6PoJe_O

GTFS stop calls: 8; app labels: 30.

App labels not in the GTFS trip sequence: الخصوص; السلام; العاشر من رمضان; العثمان للسيارات (الطريق الدائري); المرج الجديد; بهتيم; جسر مسطرد (الطريق الدائري); جسرعثمان للمشاة (الطريق الدائري)

### Badr City - Qalyoub Exit — PWCFW_a8c-PDr7QO6PoJe_R

GTFS stop calls: 9; app labels: 30.

App labels not in the GTFS trip sequence: الخصوص; السلام; العاشر من رمضان; العاشر من رمضان (طريق الإسماعيلية الصحراوي); العثمان للسيارات (الطريق الدائري); بداية نفق السلام الطريق الدائري; جسر مسطرد (الطريق الدائري); خطوات ابو صير (الطريق الدائرى)

## Files

- `comparison-summary.json`: counts, mismatches, feed dates, SHA-256, integrity checks.
- `trip-comparison.csv`: one row per matched road trip, including full name-list differences.
- `stop-comparison.csv`: stop ID/name and coordinate comparisons.
- `gtfs-ordered-road-stops.json`: actual GTFS stop IDs and order for every road trip.
- `tfc-road-transport-document-88.zip`: original downloaded archive.
- `gtfs_gcr_bronze.zip`: nested GTFS feed extracted as a single ZIP file.

## Recommended next steps

1. Build trip-specific stop IDs and ordered stop lists from stop_times.txt instead of proximity-derived via_stops.
2. Preserve publisher, download URL, feed version and validity dates with imported data.
3. Review the 39 route-label discrepancies without assuming either label reflects current operation.
4. Ask TfC for route-level corrections or a newer field-verified revision; both current exports can share the same factual errors.

No application data was replaced or modified. Reproduce with `python -X utf8 scripts/compare_tfc_gtfs.py`.
