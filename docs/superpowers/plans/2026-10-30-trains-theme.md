# Trains Theme and Navigation Implementation Plan

**Goal:** Match the trains tab to the homepage theme and correct the clipped station indicator and overextended navigation line visible in the screenshot.

**Architecture:** Keep existing React panels, source content, maps, tab selection and keyboard navigation. Use scoped CSS with minimal semantic markup changes. No new libraries, backend changes, or transport-data changes.

**Tech Stack:** React, existing lucide-react icons, CSS, Vite.

- [ ] In src/landing.css, scope header navigation changes to .landing-screen. Use evenly sized tab columns and a station track between the first and last dot centers. Leave enough inset above enlarged selected circles to prevent clipping; retain responsive RTL and visible focus. Allow all four labels to fit narrow screens or scroll accessibly without clipping markers.
- [ ] In src/landing.css and, only as needed, src/components/MetroMapPanel.jsx and RailNetworkPanel.jsx, style trains heading, network selector, map cards, captions, credits, monorail status and station lists using existing cream/black/ochre tokens, rounded cards and pill actions. Add consistent vertical spacing and responsive heading stacking. Preserve image error states, original-source links, maps, content and facts.
- [ ] Review DOM and screenshots for homepage navigation and each trains network at available viewport sizes; check map image links, tab selection and keyboard navigation. Run npm run build and existing railNetworkNavigation tests. Inspect git diff --check. Do not commit or deploy.

**Screenshot interpretation:** Fix the obvious clipped selected marker and excessive track overhang; preserve the station-line navigation concept.
