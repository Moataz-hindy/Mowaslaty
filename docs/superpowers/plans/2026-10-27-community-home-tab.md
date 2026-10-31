# Community Outside Planner

Move community into a fourth home-page tab at `/#community`. Remove its desktop planner tab, mobile More entry and Sidebar mount. Keep accounts/public writes disabled and all local drafts unchanged.

Lazy-load a home community wrapper that loads policy-filtered route summaries with loading/error/retry states. Render CommunityHub in page flow, using scoped page CSS so its former sidebar height/overflow rules do not create nested full-height scrolling. Preserve Arabic responsive home navigation, keyboard support, hash refresh/back/forward and existing rail URLs.

Community route links must be real `/app?route=<exact encoded id>` anchors, preserving normal and modifier/new-tab navigation. Use the existing onOpenPlanner interceptor. Missing or excluded route IDs remain unavailable, never substituted. Route data loads only after entering the community tab; no planner/geometries import on the home page.

Use Luna medium per continuing user preference. No dataset/backend/auth changes, no draft storage key changes, no deployment/commits. Existing native packaging still launches the planner; this request changes website home navigation only.

- [x] Implement home section/hash and lazy community wrapper, scoped layout and real map links.
- [x] Remove Sidebar community navigation/mount and unused imports; adjust five-mode desktop grid without breaking mobile layout.
- [x] Update focused navigation checks; run community checks and production build.
- [x] Parent checks desktop/mobile tab, direct URL/refresh/back, stored drafts and exact map-link handoff; saves preview.

Verification: 16 focused checks and production build pass. Independent review found no blocker. Browser tested direct/#community, refresh, four mobile tabs without horizontal overflow, preserved draft save, exact return-direction anchor into planner, browser back and cleanup of owned test draft. Planner has no community entry. Home community imports route summaries only and retains local draft access while summaries are unavailable. No deployment.

