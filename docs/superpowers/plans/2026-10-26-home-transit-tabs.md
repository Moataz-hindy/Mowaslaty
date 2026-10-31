# Home Transit Tabs Implementation Plan

**Goal:** Add home-page tabs for a searchable road-route directory and a readable metro station map, retaining the existing home/download experience and planner.

**Design:** Three Arabic tabs: الرئيسية, خطوط المواصلات, المترو. The route tab loads existing policy-filtered summaries only when opened. Filters: الكل, ميكروباص, أتوبيس هيئة CTA, ميني باص. Exclude Metro, Box, Tomnaya from this directory. Search route number, Arabic/English endpoints, and supplied via-stop names with Arabic normalization. Keep exact directional record identities; show direction clearly. Expand supplied stop names inside cards, without claiming the dataset's names are complete or verified. Paginate results to avoid rendering thousands of cards. No changes to source data or existing route exclusions.

**Navigation:** Each route offers an actual link /app?route=<encoded exact id>. App selects the exact policy-allowed record after async routes load. Support refresh/new-tab, URL changes, back/forward, and safe invalid IDs without default selection. Landing tabs may use hash state so browser back is useful. Native still launches the planner.

**Metro:** A real station-map image from the official Cairo Metro or operator Mobility Cairo maps page, credited and linked. Locate/inspect current source; preserve labels and date rather than inventing station names or generating a fake map. Responsive contained preview and full-size open/zoom option with image load failure fallback. No metro route cards, calculator, or data edits in this task. If source cannot be bundled, remote image with a clear official source fallback is acceptable; document provenance and limitations.

**Architecture:** Small home directory/metro components, pure directory filter/search/pagination helpers, landing CSS scoped from planner. Extend AppEntry's intercepted links to preserve route query; App consumes exact route selection after load with effect guards. Keep lazy planner loading, download-release validation and native startup intact.

**Implementation:** User explicitly requests gpt-6-luna. Use medium reasoning per existing preference. Reuse current dirty workspace; no commit/deploy, dataset edits, global tool installs or Android toolchain work.

- [x] Inspect landing/App selection, search helpers and policy filters.
- [x] Add focused tests for allowed vehicle categories, Arabic/digit search, stop-name matches, exclusions, pagination and exact-route URL selection including invalid ID/history behavior.
- [x] Implement home tab navigation, lazy directory fetch, loading/error/retry/empty states, searchable filterable paginated cards and expandable supplied stops. Ensure mobile controls and long labels wrap.
- [x] Add official metro station map with provenance, readable large view, error fallback and no unsupported station assertions.
- [x] Wire route deep links through existing planner with precise route ID and safe URL lifecycle.
- [x] Run focused tests and production build. Parent reviews and tests home tabs/filter/search/route links/back and mobile layout.

**Review focus:** Existing held routes stay hidden; metro absent from road directory; query navigation preserves exact ID/direction across reload/back; loading cannot select stale route or override user choices; long Arabic labels and many stops do not overflow; metro source is real and readable with failure fallback.

Verified: 12 focused/regression checks passed; production build passed. Browser QA: 390px/1280px, CTA-only filter, Arabic-digit 112 search, empty search, expandable stops, exact route map link + refresh, browser back, keyboard Home navigation and map image loading. Independent review blockers resolved. Preview localhost:3002. No deployment or dataset edits.

