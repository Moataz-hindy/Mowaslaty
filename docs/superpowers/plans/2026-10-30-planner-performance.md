# Planner performance implementation plan

**Goal:** Reduce journey-search latency using Luna, as explicitly requested, without changing valid transit alternatives or deployment/release state.

**Architecture:** Optimize the existing round-based estimated-time planner. Profile first; reuse immutable network/geometry work, bound caches, and retain walking limits, directed calls, fixed stations and current ranking. Improve client search lifecycle so superseded work does not delay newer inputs, and surface direct results while transfers continue where practical. Avoid a timetable-based algorithm replacement because the dataset is not a trustworthy live timetable.

## Constraints

- Preserve all existing dirty files, BRT/localization/mobile/icon work.
- No deploy, release APK, dependency installation, commits or pushes.
- No arbitrary candidate/stop caps, reduced walking radii or reduced transfer count to claim a speed improvement.
- Keep up to two transfers, stop sequence semantics, pickup/alighting permissions, BRT station-only and unverified-transfer restrictions.
- Cache by relevant network, geometry and option identity; bound memory and reject invalid/stale entries. Cancellation must not trigger expensive fallback work.
- Known baseline `node scripts/test-routing.cjs` failure: repeated stop occurrences expects both 1-4 and 3-4. Record it; do not weaken tests to hide it.

## Tasks

- [x] Capture reproducible real-data benchmarks and pre-edit source snapshots in `artifacts/planner-performance/`.
- [x] Profile hotspots and add regression coverage before geometry/cache implementation; retain existing routing checks.
- [x] Optimize measured repeated geometry and destination-distance work; retain the reusable spatial index. Full transfer-adjacency preprocessing was deferred because profiling prioritized geometry/allocation costs.
- [x] Add bounded result/in-flight caching with dataset/version/options invalidation and cloned consumer results.
- [x] Add progressive direct results, standard/multi-stop cancellation, safe worker fallback, bounded idle worker reuse and stable user selection.
- [x] Compare full ordered signatures for Bus, ALL, Metro and no-service fixtures; preserve all tested outcomes.
- [x] Complete root and independent review, performance/utility/BRT/localization tests and website/native web builds. Record the pre-existing routing assertion and incomplete final browser visual observation in `artifacts/planner-performance/REPORT.md`.

## Review focus

1. A cancelled request must not rerun on the main thread through worker fallback.
2. Repeated stops and flexible minibus drop points must preserve directed travel order.
3. Cache keys must distinguish transfer/walk/filter settings and actual dataset changes.
4. Progressive results must not clear selected journeys repeatedly or restore stale routes.
5. Faster compute must retain valid BRT/Metro station rules and existing alternatives.
