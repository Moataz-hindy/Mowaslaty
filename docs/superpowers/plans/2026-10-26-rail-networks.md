# Rail Networks Plan

**Goal:** Extend the existing metro home section with LRT and monorail, under one compact rail tab.

**Design:** Rename the visible main tab to القطارات while preserving legacy #metro links. Inside, provide المترو / القطار الكهربائي LRT / المونوريل choices. Keep each network separate and readable at mobile widths; reuse the official metro image. Show source-backed station maps/images with full-size viewing, credits and image failure fallback. For monorail, separate east/west if source shows different project statuses; do not imply a planned service is running. Avoid schedules/fares and new routing-calculator claims. Existing road directory/planner unaffected.

**Sources to inspect:** Mobility Cairo maps https://www.mobilitycairo.com/ar/travel-information/maps for LRT (Capital Train) and existing PDF inset; Cairo Governorate monorail page https://www.cairo.gov.eg/ar/governorate-services/transportation-services/monorail/ for diagram/stations; NAT official news https://www.nat.gov.eg/NewsDetailsAr.aspx?id=1304 confirms full east-Nile operation June2026, https://www.nat.gov.eg/NewsDetailsAr.aspx?id=1310 September2026 update. Official map may be older: credit date, avoid calling it current. Use authentic published asset, not an AI-generated geographic map. If no reusable official monorail image is obtainable, a clearly labeled schematic station list based on official source is acceptable, preserving sequence and no invented station names.

**Implementation:** User's Luna preference continues: gpt-6-luna medium. One implementer handles components/data/scopedCSS and focused tests. No commits/deployment, dataset edits, new dependencies or Android tooling. Add hash/network selection with backward compatibility and browser back behavior if practical.

- [x] Inspect official sources/assets and document provenance.
- [x] Implement rail selector and LRT/monorail content with responsive layouts and full-size viewing/fallbacks.
- [x] Verify network selection, legacy metro entry, loading/errors, keyboard controls; production build.
- [x] Parent reviews and browser-tests phone/desktop and confirms route directory unchanged.

Verified: 8 focused checks pass; production build passes. LRT source PDF rendered to local capital-train-map-preview.png. Browser checked rail selection, legacy metro entry, refresh and browser back, mobile image load and no horizontal overflow. Independent review found no blocking issues. East monorail station names shown as partial chips, avoiding an unsupported travel order. No deployment.

