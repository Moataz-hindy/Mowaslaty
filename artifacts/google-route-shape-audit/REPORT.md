# Minibus and CTA route-shape audit — 30 October 2026

This checks the lines shown when a route is selected, not exact stop lists or fares. Application data and releases were not changed.

## Findings

- Active scope: **753 directions**, comprising **287 minibus directions** and **466 CTA bus directions**. Other vehicle types were excluded. Opposite directions count separately.
- Every selected direction has a shipped encoded shape matching its original stored trace, with ordered vertices and rounding tolerance. Maximum source-vertex deviation from the corresponding simplified segment: **5.000 metres**. Encoded endpoints match the stored endpoints.
- This proves fidelity to our own source, **not accuracy against Google or present-day operation**. Both datasets may contain old or shared source information.
- Ten directions were investigated in Google Maps. Two had whole-corridor visual comparisons, four had partial visual comparisons, and four remain unverified. The other **743 directions have not been compared visually with Google**.
- No clear major corridor mismatch was found in the six comparisons with an identifiable matching service/segment. This is not certification that all routes are correct.

## Google Maps comparisons

| Direction | Scope and result | Google reference |
|---|---|---|
| Minibus 305: Dawaran Shubra → Masaken Sheraton (`3ZA9yhKgNaHbbYLy2R_Ch`) | Whole-corridor visual agreement. Google selected **Minibus 305** from Rod Al Farag Metro Station to Masaken Sheraton. The northern Shubra/Qobba–Heliopolis–Sheraton corridor and terminal approach agree at overview scale. | [Google directions](https://www.google.com/maps/dir/?api=1&origin=30.0804,31.24539&destination=30.10531,31.38552&travelmode=transit) |
| CTA 1057: Hadayek Al Qobba → Badr (`7iYpqwhdq0PGUjw7jpi2g`) | Whole-corridor visual agreement after selecting the **CTA 1057** alternative rather than faster unrelated journeys. The northeastern highway corridor, Shorouk approach and Badr turns agree at overview scale. | [Google directions](https://www.google.com/maps/dir/?api=1&origin=30.0871,31.28979&destination=30.13584,31.73535&travelmode=transit) |
| CTA 370: Masaken Badr, Sheikh Zayed → Abbassia (`CTA_370_O`) | Partial agreement: **Tara Compound Entrance → Abbassia** on Google's CTA 370, including the 26 July corridor and central Cairo approach. The initial Masaken Badr → Tara section was not compared. | [Google directions](https://www.google.com/maps/dir/?api=1&origin=30.040054,31.013706&destination=30.07255,31.28439&travelmode=transit) |
| Minibus 54: Nasr City 7th District → Al Magzar, Mariouteya (`8yxAFuYBKWB0_1jRz1pKC`) | Partial agreement: Google selected **Minibus 54** toward Al Magzar but suggested alighting at **Magra Al Oyoun (Salah Salem)** and transferring. The inspected Nasr City–Salah Salem section agrees. The Giza/Mariouteya remainder is unverified. | [Google directions](https://www.google.com/maps/dir/?api=1&origin=30.04197,31.32961&destination=29.979,31.15984&travelmode=transit) |
| CTA 1056: Abd Al Moneim Riad → Shorouk (`fvqs8K9ltdvQL36HY1Uj1`) | Partial agreement: Google selected **CTA 1056** from **Hikestep Bridge Entrance → Shorouq City**. The eastern highway and Shorouk turns agree. Central Cairo → Hikestep remains unverified; Google suggested other modes for that section. A coordinate query initially snapped to a parking location with an implausibly long walking leg; using the named terminal resolved that access issue. | [Google directions](https://www.google.com/maps/dir/?api=1&origin=Abd+Al+Moneim+Riad+Cairo&destination=30.13873,31.65373&travelmode=transit) |
| Minibus 333: Ataba → Tagneed, Remaya (`buENjSeigoJzgROmbs1xz`) | Partial agreement: Google's explicitly selected **Minibus 333** leg runs **Ahmed Maher Teaching Hospital → Al Shabab (Al Tagneed)**. Its Giza/Haram corridor and Remaya approach agree visually. Initial Ataba access and final endpoint access were not verified as part of the bus shape. | [Google directions](https://www.google.com/maps/dir/?api=1&origin=30.05153,31.25042&destination=29.98197,31.11276&travelmode=transit) |
| Minibus 112: Abu El Reesh → Masaken Sheraton (`CTA_M_112_O`) | Unverified. Google suggested other services; an exact 112 shape was not isolated. This does not establish a mismatch or discontinued service. | [Google directions](https://www.google.com/maps/dir/?api=1&origin=30.0283,31.23708&destination=30.10552,31.38549&travelmode=transit) |
| CTA 8s: Ahmed Helmy → Akher Tersa (`gjJQWZi93W-mwaLf0GMEK`) | Unverified. No exact 8s path was isolated in the displayed alternatives. | [Google directions](https://www.google.com/maps/dir/?api=1&origin=30.06484,31.24619&destination=29.9853,31.15232&travelmode=transit) |
| CTA 1047: Masaken Badr, Sheikh Zayed → Abd Al Moneim Riad (`CTA_1047_R`) | Unverified as an exact 1047 shape. Google showed grouped CTA 370/1020/1047 alternatives and problematic final walking access; the specifically drawn leg was 370, so it was not counted as a 1047 match. | [Google directions](https://www.google.com/maps/dir/?api=1&origin=30.0554,30.9594&destination=30.04946,31.23193&travelmode=transit) |
| Minibus 201: Warraq → Tagneed, Remaya (`CTA_M_201_O`) | Unverified. The displayed alternatives did not isolate this exact service. | [Google directions](https://www.google.com/maps/dir/?api=1&origin=30.10708,31.21322&destination=29.98085,31.11245&travelmode=transit) |

## Error margin and interpretation

The Google comparisons above are **visual corridor checks**, not measured Google-polyline-to-app-polyline distances. A numerical claim such as “all routes stay within 200 metres of Google” would be unsupported. A complete numerical comparison needs corresponding Google route geometry for each direction, or an equivalent independently verifiable geometry dataset.

The 5-metre result applies only to **encoded app geometry versus our original trace**. Leaflet also simplifies displayed lines according to zoom; the selected-route rendering uses the geometry array directly and does not specify a custom `smoothFactor`. Overview screenshots can therefore look straighter than a street-level view.

Many shapes contain long straight vertex-to-vertex segments. Segment length alone is not an error: the source comparison found the skipped source vertices remain within 5 metres of those simplified segments. The underlying source can still be inaccurate or outdated.

Google displayed **“We don't have the most recent timetables for this area.”** Journey selection and transfer choices are not reliable evidence that an omitted service does not exist. Reverse directions have not been assumed to match automatically.

## Files

- `local-inventory.json`: all 753 selected directions and their endpoint coordinates.
- `local-shape-checks.json`: source/shipped point counts and measured simplification and endpoint errors for every direction.
- `direction-status.csv`: per-direction local results and explicit Google comparison coverage.

No route geometry correction is supported by a confirmed mismatch in this initial comparison. This report does not recommend deleting routes based on Google journey omissions.
