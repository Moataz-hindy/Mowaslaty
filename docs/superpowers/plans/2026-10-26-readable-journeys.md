# Readable Journey Legs

**Goal:** Make trips involving multiple vehicles easy to scan in the planner and multi-destination results.

**Design:** Keep calculated legs/results intact. Replace long ride instruction sentences in shared JourneySteps with distinct ride blocks: vehicle/route label, separate boarding and alighting rows, compact duration/distance. Walking legs are lighter strips identifying access/transfer/egress and distance/time. Transfers remain explicit and in chronological leg order. Summaries avoid repeated total-time/transfer labels already in surrounding headers. Suggested alighting points remain clearly estimates with existing safety notice, not renamed official stops. Preserve Arabic/English, RTL/LTR, selected journey/map behavior and single-ride tracking action. No routing changes or invented values.

**Implementation:** Luna medium per continuing user preference. Shared JourneySteps.jsx + scoped index.css + i18n as needed, tiny caller changes only where duplicated summaries demand it. Preserve all other dirty work. No commits/deploy/new dependencies.

- [x] Inspect both callers and actual leg schema; implement semantic readable journey flow with sensible unknown-name fallback and long-label wrapping at 320/390px.
- [x] Verify direct, transfer, zero-distance walk, flexible drop and English data with focused rendering checks; avoid implementation-mirroring tests.
- [x] Run production build. Parent inspects mobile/desktop UI and reviews selection/tracking preservation. A temporary artifacts/ layout fixture importing the actual component is acceptable for deterministic UI QA, clearly marked as example and excluded from production build.

Verification: production build passed. Actual planner Attaba→AUC produced direct and transfer options; 3-ride transfer selected and map updated. Checked desktop 1280 and mobile 390 with no horizontal overflow. DEV fixtures checked Arabic two rides and English long labels/flexible drop/zero-distance walk. Full metrics preserved in multi-stop; Sidebar shows walk-only summary to avoid repeating header totals. Independent review estimate-qualifier finding fixed. Fixture assets are not in dist. No routing/data edits.

