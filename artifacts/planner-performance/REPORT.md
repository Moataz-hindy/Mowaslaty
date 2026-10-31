# Planner performance verification — 30 October 2026

Implemented by Luna; reviewed and verified by the primary agent. The existing round-based estimated-time algorithm remains in use.

## Changes

- Bounded geometry and projection preparation caches, conservative rejection of irrelevant flexible drop projections, and per-query coordinate/destination-distance reuse.
- A bounded final-result cache and shared in-flight requests keyed by dataset identity/version, coordinates and search options. Results are cloned for consumers.
- A dedicated planner worker with one idle worker retained for compatible datasets. Cancellation terminates the abandoned task without repeating it on the main thread; unexpected worker errors retain the fallback.
- Cooperative progressive search publishes direct journeys before transfers finish. Superseded standard and multi-stop searches abort, and final results retain an existing user selection when available.
- No changes to walking limits, allowed transfers, vehicle rules, BRT restrictions or result limits.

## Measurements

Local Node v24.14.0 measurements on the same shipped network, including BRT and decoded route geometry. These are compute benchmarks, not guarantees for every phone or browser.

| Full-network sample | Before, cold | After, cold |
| --- | ---: | ---: |
| Bus-filtered CTA 1078 endpoints | 9.63 s | 2.92 s |
| All transport, Attaba–Roxy | 32.05 s | 16.28 s |

The cooperative progressive ALL run returned direct results at about **666 ms**, completed at about **18.98 s**, and returned a repeated identical request from the final-result cache in about **3.79 ms**. Yielding keeps fallback searches responsive but adds some total runtime.

`compare.cjs` verifies deep equality of ordered result signatures: ride IDs, stop sequences, coordinates, walk/ride distances, ranking and times. The Bus and ALL cases retain exactly the same scanned-call counts. Metro and remote no-service comparisons also retain matching results; their small timing differences are not speedup claims.

## Verification

- `node scripts/test-planner-performance.cjs`: passes, including geometry edge cases, progressive equivalence, dataset-version invalidation, cancellation, shared subscribers, cloneable worker messages, idle worker reuse and fallback behavior.
- `node --test src/utils/*.test.js`: 30 passed.
- `node scripts/test-brt.cjs`: 7 passed.
- `python scripts/test_arabic_names.py`: 3 passed.
- `node artifacts/planner-performance/compare.cjs`: all five comparisons match.
- `npm run build` and `npm run native:build`: passed. Native web assets only; no APK or release update.
- `node scripts/test-routing.cjs`: retains its pre-existing repeated-stop-occurrence assertion failure (expects both 1–4 and 3–4 variants); all other checks pass. The test was not weakened.
- Independent Luna review found no remaining blocking correctness issue.
- Browser smoke test reached a live Metro search using the new worker, but browser automation disconnected before the final result/loading-state observation. Final visual verification is therefore incomplete.

## Limits and scope

Complex uncached all-transport searches still take seconds. The improvement is earlier usable direct results, less computation, fast repeat searches and effective cancellation; this is not an instant replacement for all transfer searches. Precomputing every transfer adjacency was not added because the measured geometry/allocation work was prioritized. The existing spatial index is retained and reused by the idle worker.

No deployment, release APK, dependency installation, commit or push was performed. Existing local user changes were preserved.
