# Community visual redesign implementation plan

> Implement with gpt-6-luna, medium reasoning. Use the existing checkout and preserve all current uncommitted work. User explicitly requested design followed by implementation; no intermediate approval needed.

**Goal:** Give the current community home screen a strong hierarchy and coherent grouping, replacing small grey floating text and excessive stacked margins.

**Design:** A compact black/amber editorial interface on the existing warm paper landing page. Prefer a single main column (maximum approximately920px), a bold28–32px heading and16px readable introduction, a concise cream/amber account availability notice, a segmented navigation/action toolbar, a white bordered search/filter panel, and defined white feed/draft cards. Body copy14–16px, metadata at least12px and sufficiently dark. Arabic letter-spacing normal. Black is the primary reading color; amber is an accent and selected/focus cue. Avoid gradients, giant hero decoration, fake sample reports and unnecessary repeated actions. Existing global site identity stays recognizable.

**Layout:** Reduce the community panel's cumulative top gap (home panel padding + hub margin). Group views and New draft in one desktop toolbar; stack gracefully on mobile. Search comes before category chips within their shared panel. All controls remain accessible; chip labels may wrap rather than show a visible horizontal scrollbar. Empty feed becomes a designed card with a small Lucide icon, a clear heading and supporting sentence, tailored to no reports vs no filter matches vs no drafts. Loading/error/account-disabled notices remain truthful. Composer and account/own/moderator/comment controls get consistent input/button/card treatment, not only the public empty screen.

**Scope:** src/components/CommunityHub.jsx (presentation wrappers, icons, copy and classes only), CommunityHub.css (rewrite tidy component styles), optionally one scoped #community-panel spacing rule in src/landing.css. Do not restyle other homepage tabs/planner, change auth/session epochs, API contract, backend, route policy, local draft state, or permissions. Community page uses a local light palette consistent with landing even when planner dark-mode variables persist; no global theme changes. No new dependencies or fonts.

**Responsive acceptance:** At390px and desktop1280px, no document horizontal overflow or clipped route names/actions; prominent headings, comfortable line-height, 44px primary controls, mobile input text16px to avoid iPhone autozoom; visible keyboard focus. Local drafts, route picker, cancel/edit/delete and all existing session guards remain operational. Long Arabic words/routes/body text wrap within cards. Icons are aria-hidden unless labelled controls.

## Tasks

- [x] Luna implements presentation-only redesign, preserving handler/event/state logic. Use meaningful new classes for statuses and styling plain own-edit textareas/selects. Keep semantic heading order and visible labels.
- [x] Run existing community/helper tests and production build; no new tests mirroring CSS. Test actual draft save/edit/delete manually through the browser, including disabled submission when unconfigured.
- [x] Parent browser checks real local Pages preview at3003 (production assets need rebuild), mobile390px and desktop1280px, screenshot final result, reset viewport. Existing local migrated DB is empty; no fake published content/auth bypass.
- [x] Independent scoped code review for accidental behavior changes/a11y regressions; fix any findings using Luna.

**Verification:** node --test src/community/*.test.js src/utils/communityDrafts.test.js; npm run build. Parent owns browser QA, plan/progress documentation. Do not deploy, commit, reset, create cloud resources, or touch user drafts other than explicitly created QA drafts.
