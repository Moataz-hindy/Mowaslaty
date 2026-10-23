# Multi-stop journeys design

Date: 2026-10-23. Planning: Sol 6.1. Implementation: Luna 6, as requested by the user. The user has authorized implementation; this document is the concrete handoff, without another approval gate.

## Intent and scope

Add a separate `multi` tab named **عدة وجهات / Multi-stop**. A rider enters an ordered list such as Attaba → Tagamoa → Masr El Gedida and sees independent journey options for Attaba → Tagamoa and Tagamoa → Masr El Gedida. Each pair uses the existing direct/one-transfer planner; this is an ordered itinerary, not optimization of destination order.

Use React/Vite, existing Leaflet/lucide/Turf, and no new dependencies. Preserve all existing uncommitted changes. No commits, deployment, new backend, or changes to the planner algorithm are required.

## Approaches considered

1. Extend the existing two-point planner with via points: least UI initially, but conflicts with the requested separate tab and risks its working origin/destination flow.
2. Dedicated multi-stop editor and independent calls to `computePlan`: chosen implementation proposal. Reuses the tested planner and map format, bounds work to five adjacent pairs, and keeps unsupported legs visible.
3. A new global multi-leg graph solver: much wider scope and would change route guarantees. Deferred.

## User flow

- Start with two empty place rows, numbered 1 and 2. Add up to **6 total points**, remove down to **2**, move rows up/down using accessible buttons (no drag dependency).
- Each row has a practical local place search, a chosen-place label, clear, and an explicit map-pick button. Typing invalidates that row's previous coordinate immediately; text is never treated as a resolved place until a suggestion is selected. Adjacent unresolved pairs display a prompt rather than stale routes.
- Search Arabic/English names and aliases from existing `CAIRO_LANDMARKS`, loaded stops, and `loadPlaces()`'s local place index. Normalize with `normalizeText`, require two characters, rank prefix matches first, deduplicate and show at most 8 suggestions. Retain landmarks/stops when the optional places dataset fails. No Nominatim autocomplete or new online service.
- Selecting a row for map picking arms its stable ID. The next map click sets only that row, labels it with formatted coordinates, then disarms picking. A later click with no row armed leaves the itinerary intact. Adding a row may arm its map picker; explicitly explain this in the row UI.
- Global map search retains its preview behavior. In the multi tab, its selected-location action explicitly reads “استخدم للنقطة N / Use for stop N”, or prompts the rider to select a row first. Only that action commits the named location; opening a preview never silently assigns a point or switches to Nearest.
- Show every consecutive pair, including incomplete, loading, ready-with-no-results, and error states. A failing pair does not suppress other results. Equal adjacent coordinates display “اختر مكانين مختلفين / Choose two different places” and avoid a planner call.
- Each successful pair lists direct and transfer options with route labels, estimated time, walking distance, and hub for transfers. Choose an option to show that pair on the existing map; indicate the active pair. The initial ready pair can be selected automatically, but later results must never steal selection from the rider.
- One itinerary vehicle filter (`ALL`, `Metro`, `Minibus`, `Bus`, `Microbus`) filters results locally. Microbus includes Tomnaya/Box; both routes in a transfer must match. Empty filtered results use distinct copy from no routes found. Filtering does not trigger route calculations. Preserve existing per-leg selection when still visible, otherwise choose the first visible option or clear that leg's selection.
- On desktop/tablet show the new tab alongside existing tabs. At <=760px keep the existing three primary tabs plus More, put Multi-stop first in More, and mark More active for `multi`. Use the existing expandable sheet; selecting a journey collapses it so the map stays usable.

## State and interfaces

Keep itinerary state in `App.jsx` so switching tabs does not discard it:

`multiStops: Array<{ id: string, coord: [number, number] | null, label: string }>` (two initial stable IDs), `multiPickingId: string | null`, `multiVehicleFilter: string`, and `multiSelection: { legKey: string, optionKey: string } | null`.

Keep row draft queries in `MultiStopPlanner.jsx`, keyed by ID. Setters update by ID, not current array index. Removing the armed row clears the picker. Reordering retains place identity and changes the adjacent pair order.

`useMultiStopPlanner({ points, routes, geometries, stops })` returns ordered legs. Each leg is `{ key, from, to, status, plan, error }`, with `status` one of `incomplete`, `same-point`, `loading`, `ready`, `error`; `plan` has the existing `directRoutes`/`transferRoutes` shape. Directed keys include both point IDs and their coordinates. No results may be exposed under a key for different coordinates.

`Sidebar` receives a single `multiStopProps` object and renders `<MultiStopPlanner {...multiStopProps} lang={lang} t={t} />` when active. Its object contains `points`, `legs`, `pickingId`, `vehicleFilter`, `selection`, `stops`, `onChangePoint(id, {coord,label})`, `onAddPoint()`, `onRemovePoint(id)`, `onMovePoint(id, delta)`, `onPickPoint(id)`, `onFilterChange(value)`, `onSelectJourney(legKey, optionKey)` and `onShowMap()` (collapse sheet). Use safe defaults for Sidebar server-render regression tests.

`MapSearchBar` adds `multiStopTarget: { id, number } | null` and `onSetMultiStopLocation(location)`; uses these only in `multi` mode. It already owns the selected location with name and coordinate.

## Computation and stale work

Reuse `computePlan(from.coord, to.coord, {routes,geometries,stops}, 1200)` unchanged. No new worker message type is needed. Use a sequential queue within each current run (maximum five complete pairs), emitting each result as it arrives. Check a cancellation/generation token before scheduling each call and before publishing each result. Invalidate immediately after point edits, and ignore in-flight stale responses. A worker call cannot actually be aborted; do not claim otherwise.

Keep a per-hook result cache keyed by directed IDs/coordinates and dataset identity; clear it when routes/geometries/stops change. Cache only successful results, including successful empty plans. Reuse unchanged pairs after one row edit; prune cache to current pairs to bound memory. Relink copied worker route objects through current `routesById`, including both transfer legs. Expose failures per leg and retry via a small refresh action or another point edit. Yield between fallback computations so a worker-less browser can paint.

## Map and existing planner integration

The real existing prop is **`activeJourney`**, not `selectedJourney`. Derive the selected multi option from current legs, selection and filter; never copy it into single-planner `activeJourney` state. Pass the selected multi leg's `from.coord`, `to.coord`, and journey as MapComponent's existing `originCoord`, `destCoord`, `activeJourney` when `activeTab === 'multi'`. Pass its first route (`journey.route` or `journey.leg1.route`) as the map's `selectedRoute`; when no valid selected option pass null so an obsolete line cannot remain drawn. Other tabs retain existing state.

Extend the map visualizer gate to `planner` or `multi`. Existing direct/transfer rendering is enough; full transit line geometry is the current renderer's behavior. Numeric endpoint markers in multi mode should reflect original point positions rather than always Arabic A/B; add optional `journeyPointNumbers` prop. Do not inject free-form place names into Leaflet HTML strings.

Guard the existing App single-planner auto-selection effect with `activeTab === 'planner'` and include that dependency; otherwise late two-point results can overwrite route selection during multi-stop use. Exclude `multi` from `drawerDrop`, and hide the generic RouteDrawer in multi mode to avoid unrelated target dropoffs/direction switching corrupting its selected leg. Keep existing trip tracking behavior unchanged.

## Validation and limits

Use the existing Node/esbuild server-render test style and `npm run build`. Focus async tests on cancellation between and after requests, unaffected pairs/cache reuse, independent failure/empty results, and coordinate order. Render both languages and ensure all pairs remain visible. Browser-check local search, map assignment, reorder/remove, six-point limit, switching tabs, selected direct/transfer map, no-results per leg, vehicle-filter empty state, desktop plus 390px mobile More and keyboard operation.

Existing planner limitations apply independently to every pair: 1200m endpoint walks, transfers only via listed Cairo hubs, transfer search only when fewer than three direct routes, capped candidates/results, estimated timing rather than schedules. Present gaps honestly; do not fabricate connectivity, combine all pairs into a single timing guarantee, or broaden the algorithm as part of this feature.
