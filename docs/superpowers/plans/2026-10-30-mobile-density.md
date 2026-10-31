# Mobile Readability and Density Plan

**Goal:** Reduce the crowded appearance of phone layouts shared by the website and Android app.

**Scope:** Local source changes only. Do not build or replace a release APK, alter public/downloads, increment versions, deploy, commit, or push. Preserve current release 1.0.2.

**Approach:** Keep the cream/ink/ochre theme and existing functionality. Apply a coherent phone typography scale and spacing to existing components, scoped to mobile media queries. Avoid global zoom, scaling, hidden content, or unreadably small text. Desktop layouts keep their existing styles.

- [ ] Homepage and shared navigation: reduce headline and decorative-number sizes; simplify card padding; make service cards, steps, calls to action and route board more balanced. Preserve bottom dock safe-area clearance.
- [ ] Route directory and trains: use smaller headings, route endpoint text and metadata; allow labels and source actions to wrap/stack. Keep map proportions, source credits and full route details accessible.
- [ ] Community: reduce oversized title, nested surface padding and metadata; keep post bodies ordinary text and legible. Prevent toolbar/filter/button overlap.
- [ ] Planner: inspect existing mobile route cards, journey steps, headings and filters; reduce oversized type and crowded spacing without changing map/sheet interaction or navigation.
- [ ] Readability constraints: body copy generally 14–16px, supporting text 12–13px; inputs remain 16px to avoid focus zoom; touch targets remain about 44px. Preserve visible focus, RTL wrapping, text zoom and full content.
- [ ] Verify a local web build and responsive browser views around 360–430px plus desktop. Check horizontal overflow, bottom-dock obstruction, route search, community controls and trains. Record any unavailable browser/device validation. No release commands or deployment.
