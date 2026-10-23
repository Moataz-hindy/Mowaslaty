# Standalone Routing Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Implementation execution method is Luna, already authorized by the user; no further approval gate or commits.

**Goal:** Reliable stop-based journeys with at most two transfers, shared by both planner tabs.

**Architecture:** Generate a compact versioned network from local GTFS plus explicit manual metro associations. Cache a spatially indexed three-round directed stop search in the worker and expose generic ride/walk legs to all consumers.

**Tech Stack:** Existing Python standard library, JavaScript, React, Vite, Turf, Leaflet, esbuild-based Node assertions. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-23-routing-engine.md`

## Global Constraints

- Preserve existing uncommitted work; no dependencies, commits, deployment, AI parser, agent, RAG integration, or API key.
- At most three vehicles; access/egress 1,200 m each, transfer walk 600 m each; total walking cap 3,600 m; all walking included.
- Historical road feed ends 2025-12-31; manual metro and operational status unverified.
- Never infer road stop membership from via_stops or create transfers from crossing polylines.
- Search all candidates, filter within search, limit only final results to 15 direct/8 transfer.

## Review Focus

- Repeated stop IDs in one trip retain separate call occurrences and forward travel order (Task 1/2 tests).
- Same-name metro stations and branch routes must match exact station identity/line and reject ambiguity (Task 1 tests).
- Worker failure and route dataset/version changes cannot reuse stale data or options (Task 3 tests).
- Vehicle-filtered routes beyond the display limit must remain discoverable (Task 2/4 tests).
- A third ride must survive structured cloning, route relinking, selection, labels and map rendering (Task 3/4 tests).

---

### Task 1: Generate the real stop network

**Files:** Create `scripts/build_routing_network.py`, `public/data/routing_network.v1.json`, `scripts/test-routing-data.py`; modify `src/utils/dataLoader.js`.

**Interfaces:** `loadRoutingNetwork():Promise<Network>`; shared cached promise resets on rejection. `Network={version,metadata,stops,trips}`; stops keyed by source-prefixed stable ID with names/coordinates; trips keyed by app direction ID with source and ordered calls `{stopId,sequence,canBoard,canAlight,distanceMeters}`. Write exact JSON schema in a source comment and fixture; each downstream task uses it.

- [ ] Write failing Python tests: road IDs map exactly to 1,784 app IDs, 10 metro directions map to exact manual station sequences; malformed/ambiguous associations are reported; repeated calls preserved; optional permission restrictions survive; absent restrictions use defaults; no road via_stops assignments.
- [ ] Run `python scripts/test-routing-data.py` and confirm the tests fail because the builder is absent.
- [ ] Implement builder using `zipfile,csv,json` against the local ZIP and existing summary/stops. Include feed dates, historical/manual source flags, coverage counts and missing association details. Keep original stop order; derive cumulative shape distances conservatively with explicit fallback estimates. Expose builder helpers for fixture tests without changing audit artifacts.
- [ ] Implement `loadRoutingNetwork`, versioned URL and rejected-promise retry; no fetch at module import.
- [ ] Run `python scripts/test-routing-data.py`, then `python scripts/build_routing_network.py`; confirm all shipped directional identities are covered or report exact excluded identities and reasons to the parent before proceeding with any assumption.

### Task 2: Directed three-vehicle calculator

**Files:** Replace `src/utils/tripPlanner.js`; create `src/utils/routingNetwork.js`, `src/utils/journey.js`, `scripts/test-routing.cjs`.

**Interfaces:** `createRoutingIndex(network)` caches immutable indexes by network identity/version. `planJourney(origin,destination,network,options={})` returns the spec contract. Shared `journeyId(journey)`, `rideLegs(journey)`, `relinkJourney(journey,routesById)`, `matchesVehicle(route,vehicle)` live in `journey.js` and preserve metadata/identity.

- [ ] Write fixture assertions for: valid forward direct route and invalid reverse; exactly two transfers found; four-vehicle-only path absent; all access/interchange/egress distances contribute; zero-distance walk time is zero; transfer distance over 600 m rejected; each access/egress over 1,200 m rejected; configured total walking cap enforced; transfer penalty affects ranking but is excluded from displayed travel time and waiting time is unknown; sixth candidate uniquely succeeds; transfer considered despite three direct options; no crossing-only transfer; filter before final limit; repeated stop calls retain valid forward occurrence; invalid input/disconnected/same-point statuses; no boarding/alighting at forbidden calls.
- [ ] Run `node scripts/test-routing.cjs` and confirm expected failing assertions.
- [ ] Implement spatial stop buckets and stop-to-call indexes; route scans in three boarding rounds with parent reconstruction and safe same-state dominance. Walking links only between actual stop coordinates; no walk chaining within a round, no pre-search arbitrary route truncation, no massive path-product enumeration. Filter vehicle types before search. Follow the spec estimates/ranking/IDs and generic leg contract; ride geometry must cover only the boarded segment and be computed lazily on selection; never project all stops over full polylines in the browser index.
- [ ] Run routing/data tests until passing. Add a shipped-data benchmark to the same script using generated network and at least 20 dispersed queries; print build/query timing and network/index size, assert index reuse and no fourth ride rather than a flaky strict hardware-time limit. Investigate excessive scans or seconds-long repeated queries before integration.

### Task 3: Worker and both planner state flows

**Files:** Modify `src/workers/transit.worker.js`, `src/utils/transitWorkerClient.js`, `src/App.jsx`, `src/utils/multiStopPlanner.js`, `src/utils/useMultiStopPlanner.js`; extend `scripts/test-multi-stop.cjs`, `scripts/test-routing.cjs`.

**Interfaces:** Preserve `computePlan(origin,destination,data,maxWalk=1200,options={})`; worker and fallback use `loadRoutingNetwork` and identical `planJourney` options. `data` remains existing routes/geometries/stops for nearby search and route relinking. Planner payload includes options and version. Generic `relinkJourney` maps every ride route through app routesById. `journeyOptionKey` returns stable `journey.id`.

- [ ] Write failing assertions for third-ride relink, multi-stop stable IDs differing by boarding occurrence, same-point skip, cache separation for vehicle/options/version, network-load retry and stale-result cancellation. Preserve prior multi-stop reorder/remove tests.
- [ ] Implement plan-only network loading/index reuse in worker and fallback without making nearby or walk tasks fail due to routing-data load. Pass active vehicle filter to search; do not rely on display-only filtering. Reset rejected loading promises. Normalize every result through shared relinking, preserve statuses/metadata, and select the first ride for existing route selection.
- [ ] Update multi-stop cache keys/invalidation and hook dependencies for options/version/filter; ensure all ride legs are tested by helpers rather than two fixed routes. Maintain existing cancellation sequence guards.
- [ ] Run `node scripts/test-multi-stop.cjs` and `node scripts/test-routing.cjs`; compare worker/fallback fixture results through an injectable test seam, including full third ride and metadata.

### Task 4: Generic journey display, map and honest data labels

**Files:** Modify `src/components/Sidebar.jsx`, `src/components/MultiStopPlanner.jsx`, `src/components/MapComponent.jsx`, `src/utils/routeEnds.js`, `src/utils/i18n.js`, `src/index.css`; create `src/components/JourneySteps.jsx` if useful for shared step rendering; extend `scripts/test-trip-tabs.cjs` and `scripts/test-routing.cjs`.

**Interfaces:** Render `journey.legs`, use `rideLegs(journey)` and `journey.id` everywhere. Add shared `vehicleRouteLabel(route,lang)` for the vehicle type plus line number/name. Both tabs preserve grouping arrays but have no fixed leg1/leg2/hub assumptions.

- [ ] Write failing static-render assertions in Arabic/English: three named vehicle rides, two interchange walks, transfer count two, total walking/minutes, approximate walk and unverified historical-service notices; Bus/Minibus/Microbus/Box/Tomnaya/Metro have correct labels. Test loading-error/retry versus empty-network copy. Verify direct tracking is available and transfer action cannot imply end-to-end tracking.
- [ ] Implement shared generic steps in ordinary and multi-stop results; vehicle filter triggers computation, not only truncation-filtered arrays. Ensure third route and stop IDs participate in selection. Remove existing unsupported generic 'bus' language for other vehicles in these planner steps.
- [ ] Replace active journey map branching with per-leg ride/walk layers, individual boarding/alighting markers and actual leg bounds; suppress duplicate full selected-route overlay while journey active. Refactor the layer-description generation into a pure helper if needed to assert a three-ride/four-walk fixture and segment endpoints without browser automation.
- [ ] Run `python scripts/test-routing-data.py`, `node scripts/test-routing.cjs`, `node scripts/test-multi-stop.cjs`, `node scripts/test-trip-tabs.cjs`, and `npm run build`. Review diff for accidental unrelated changes; report benchmark, source coverage and estimated/unverified limitations. No commit/deploy step.
