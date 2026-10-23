# Multi-stop Journeys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The user chose Sol 6.1 for planning and Luna 6 for implementation. No further approval gate; do not commit existing or new changes.

**Goal:** Add an Arabic/English Multi-stop tab with an ordered place editor and independent transit options between consecutive places.

**Architecture:** App owns ordered points, picking and selected pair. A focused hook queues existing worker planner calls per pair; a new panel provides local place search and results. Adapt existing MapComponent journey props to the selected pair.

**Tech Stack:** React 18, Vite 6, existing Leaflet/lucide/Turf; no new packages.

**Spec:** `docs/superpowers/specs/2026-10-23-multi-stop-design.md`.

## Global Constraints

- Preserve all existing uncommitted changes. No commits, deployment, new backend, or changes to the planner algorithm are required.
- Use React/Vite, existing Leaflet/lucide/Turf, and no new dependencies.
- Tab key `multi`, visible label `عدة وجهات` / `Multi-stop`; 2 initial empty points, minimum 2, maximum 6 total points.
- Existing planner API and 1200m maxWalk remain unchanged.
- Stable IDs identify points; unresolved text is never a coordinate. Every consecutive pair remains visible, even without results.
- Mobile <=760px retains three primary tabs and More; Multi-stop appears first in More.

## Review Focus

1. An old worker response after a point is edited or removed must never display or select obsolete routes.
2. One impossible/rejected pair must leave the other pairs usable and show its own explanation.
3. Reordering the armed row must assign subsequent map picks to its ID; removing it must disarm picking.
4. Optional place-file failure must preserve local landmarks/stops and map entry; partial typed edits clear resolved coordinates.
5. Single-planner results arriving while Multi-stop is open must not steal its map route; filters can clear an active option safely.

## File map

Create `src/utils/multiStopPlanner.js` (pair definitions, option/filter keys, async runner), `src/utils/useMultiStopPlanner.js` (React lifecycle/cache/relinking), `src/components/MultiStopPlanner.jsx` (point editor/local search and per-pair results), `scripts/test-multi-stop.cjs` (focused assertions with existing esbuild).

Modify `src/App.jsx`, `src/components/Sidebar.jsx`, `src/components/MapSearchBar.jsx`, `src/components/MapComponent.jsx`, `src/utils/i18n.js`, `src/index.css`, `scripts/test-trip-tabs.cjs`. No changes required in `tripPlanner.js`, `transitWorkerClient.js`, or `transit.worker.js`.

### Task 1: Pair calculations with cancellation and caching

**Interfaces:** `buildMultiStopLegs(points)` returns ordered spec leg objects. `journeyOptionKey(journey)` returns `direct:<route.id>` or `transfer:<hub.id>:<leg1.route.id>:<leg2.route.id>`. `filterMultiStopPlan(plan, vehicle)` returns the same plan shape with filtered arrays. `runMultiStopPlans(legs, data, {compute, cache, isCancelled, onResult})` sequentially calls injected `compute(origin, dest, data, 1200)` only for complete distinct pairs, emits `{...leg,status,plan,error}`, and stops obsolete runs. Hook `useMultiStopPlanner({points,routes,geometries,stops})` returns `{legs,retry}` and owns cleanup/cache/dataset identity. `onResult` publication must also check cancellation in the hook.

- [ ] Read the spec, preserve current working changes, and inspect `transitWorkerClient.js`/`tripPlanner.js` return shapes.
- [ ] Add failing Node assertions in `scripts/test-multi-stop.cjs`, bundling helpers with existing esbuild: three points produce two ordered directed pairs; unresolved middle produces two incomplete pairs; identical adjacent coordinates are `same-point`; transfer vehicle filtering requires both routes, Microbus includes Box/Tomnaya.
- [ ] Run `node scripts/test-multi-stop.cjs`; confirm missing-module/exports failure before implementation.
- [ ] Implement helpers and injected async runner in `multiStopPlanner.js`; cache successful plans only, catch each pair error independently, yield with a zero-timeout between fallback-capable calls, stop scheduling when cancelled.
- [ ] Add async assertions using controlled promises: cancel while first call waits, resolve it, assert no result published and no second call scheduled; first rejection followed by second success yields error then ready; empty plan is ready; successful cache hit avoids compute; reversing coordinates does not hit forward cache.
- [ ] Implement `useMultiStopPlanner.js` with stable dataset dependencies, immediate current-key projections (never render previous-coordinate leg results during the effect delay), run generation cleanup, bounded current-pair cache and route relinking. Retry invalidates error legs, not successful cached pairs. Keep the hook independent of tab visibility.
- [ ] Run focused assertions and `npm run build`; fix actual failures before continuing.

### Task 2: Local place editor and independent result cards

**Files:** Create `src/components/MultiStopPlanner.jsx`; extend `scripts/test-multi-stop.cjs`; add bilingual keys in `src/utils/i18n.js`.

**Consumes:** Panel contract is the `multiStopProps` interface in the spec, plus `lang` and `t`. Existing `loadPlaces`, `normalizeText`, `CAIRO_LANDMARKS` exported by MapSearchBar, `lineLabel`, `VEHICLE_COLORS` are available. Optional place JSON uses `{ar,en,lat,lng,cat}`; stops use `{id,name_ar,name_en,lat,lng}`. Do not refactor the global search unnecessarily.

- [ ] Extend server-render assertions for two empty rows; three named points with ready direct, ready transfer, incomplete/error/empty pair fixtures; Arabic/English labels; Add disabled at 6 and remove disabled at 2. Assert text never contains undefined/NaN.
- [ ] Run the assertions and confirm the new panel/render coverage fails before adding UI.
- [ ] Implement rows keyed by point ID, controlled local query drafts, suggestion list with 2-character threshold, up/down/clear/remove/map controls. Editing chosen text calls `onChangePoint(id,{coord:null,label:''})` immediately; selecting suggestion commits its coordinate/name. Load places once via existing loader and cancellation-safe effect; keep landmarks/stops on load failure. Normalize and rank candidates, deduplicate, limit 8, support keyboard focus and Enter selection.
- [ ] Implement every ordered pair section with numbered endpoints and distinct incomplete/same-point/loading/error/empty/filtered-empty copy. Ready options show route badges, hub if transfer, total time and walk distance. Selected cards/buttons use keyboard-accessible native controls and call `onSelectJourney` then `onShowMap`; do not copy journey objects into single-planner state.
- [ ] Add local vehicle chips using `filterMultiStopPlan`. Labels/actions/status strings belong in both I18N dictionaries. Provide `role=status`/`aria-live=polite` for updates, numbered accessible labels for icon buttons, and no nested buttons.
- [ ] Run the focused render assertions and build.

### Task 3: App, navigation, search and map integration

**Files:** Modify `App.jsx`, `Sidebar.jsx`, `MapSearchBar.jsx`, `MapComponent.jsx`, `index.css`, `scripts/test-trip-tabs.cjs`.

**Produces:** End-to-end `multi` mode using App-owned points/picking/filter/selection and existing map journey rendering. `MapSearchBar` gains `multiStopTarget` and `onSetMultiStopLocation(location)`; `MapComponent` optionally takes `journeyPointNumbers: [number,number]`.

- [ ] Add render regression expectations to existing trip-tabs script: new nav button is available on desktop, has `mobile-secondary-mode`; More includes a first Multi-stop menu action in source/UI; original planner still has two selectors and nearest still has no boarding selector. Use source assertions only for non-rendered More behavior; final browser validation covers clicking it.
- [ ] Add App state with two stable IDs and CRUD callbacks enforcing 2..6; stable IDs survive movement. Clear picker on removal, choose only an armed row on map click in multi mode, and update coordinate labels. Call hook, derive filtered plans and selected multi journey by current pair/option keys. Invalidate selection for removed/changed pairs; initial/fallback selection picks the first available result without stealing a valid explicit selection. Preserve selected option per leg with a keyed map if needed, with `multiSelection` identifying the active one.
- [ ] Thread `multiStopProps` through Sidebar, render the panel only for multi, add tab and first More item, and include multi in More's active-state list. Use defaults so existing server-render tests do not require all callbacks. `onShowMap` sets `sheetExpanded(false)`; selecting tab uses existing `selectTab` expansion.
- [ ] Extend global search selected-location actions for multi with an explicit commit button using armed row number/name; if no row is armed show choose-row guidance/disabled action. Call `onSetMultiStopLocation` with the full preview location; App commits name and coord by ID and clears preview. No automatic assignment on `onSelectLocation`.
- [ ] Derive MapComponent `selectedRoute`, `originCoord`, `destCoord`, `activeJourney` from selected current multi option in multi mode. Pass null selectedRoute when absent, preventing obsolete route drawing. Broaden journey effect gate to planner/multi; display numeric multi endpoints via optional prop, include its values in effect dependencies. Keep arbitrary place names out of HTML markup.
- [ ] Guard the existing single-planner auto-select effect by `activeTab==='planner'`, adding activeTab dependency. Exclude multi from drawerDrop and suppress generic RouteDrawer while multi is active. Confirm selectedRoute wiring and independent nearest behavior retain existing edits.
- [ ] Append scoped panel CSS using existing tokens/logical properties. Override desktop navigation grid to 6 columns; ensure the later <=760px rule still produces exactly 4 columns with secondary buttons hidden. Include `.multi-stop-tab-container` in appropriate sheet-scroll layout rules; support dark theme, RTL, 44px controls and 390px width without horizontal page overflow.
- [ ] Run `node scripts/test-multi-stop.cjs`, `node scripts/test-trip-tabs.cjs`, and `npm run build`; all must exit 0.

### Task 4: Focused browser validation and handoff

- [ ] Run Vite using the project's available runtime and open the local page with the browser tooling available to the implementer. Choose local suggestions for Attaba, Tagamoa/New Cairo, Masr El Gedida/Heliopolis; verify exactly two independent pair sections and usable route choices or explicit no-route state for each.
- [ ] Verify explicit map picking, search preview commit, reorder then pick, remove armed row, partial text edit, add through six/disabled seventh, error/empty pair fixtures and filtering selection. Switch to ordinary planner and back; the multi itinerary remains and asynchronous ordinary planner results cannot replace its route.
- [ ] Validate direct and transfer map lines/endpoints; filter away active option and verify map clears/selects a valid option without obsolete line. At 390px reach Multi-stop via More and choose a route; sheet collapses, map remains usable. Check English and Arabic/dark theme, keyboard selection and focus labels.
- [ ] Inspect diff for unrelated changes and report changed files, test/build results, browser evidence, and any untested limits. Do not commit. If browser tooling is unavailable, explicitly report that limitation while completing the executable build/render/async checks.

## Self-review

Spec coverage: ordered editable places, local search and explicit global preview assignment are Task 2/3; pair isolation/cancellation/cache is Task 1; map reuse/navigation/filter invalidation is Task 3; visual and interaction validation is Task 4. Review-focus cases are exercised by Task 1's controlled promises, Task 2's fixtures, and Task 4's concrete interactions. Interfaces use `activeJourney` consistently with the real repository. No new approval or dependency is required.
