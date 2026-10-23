# Android App and Landing Page Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute the two tasks below. User explicitly requests Luna with medium reasoning for implementation.

**Goal:** Ship a working landing/browser experience and a Capacitor Android project prepared for direct signed-APK distribution.

**Architecture:** A light experience entry selects landing versus a lazy planner, while Capacitor always launches the planner. A native adapter adds foreground location/back handling. A signed release publication workflow enables landing downloads only when a real release exists.

**Tech Stack:** Existing React 18, Vite 6, Leaflet, Capacitor 8, Android Gradle project, Node scripts.

**Spec:** `docs/superpowers/specs/2026-10-23-android-landing.md`.

## Global constraints

- Preserve all existing uncommitted routing, audit and UI work; no commits, deployment or broad refactoring.
- All implementation uses `gpt-6-luna`, reasoning `medium`.
- Website `/` is landing; `/app` and `/app/` are planner; native always planner.
- Native package ID `dev.mowaslaty.app`, web asset directory `dist-android`.
- No fake download, no release signing secrets in source, no automatic signing-key creation.
- Original datasets and exclusions remain intact.

## Task 1: Landing and experience entry (Luna)

Ownership: `src/main.jsx`, new `src/AppEntry.jsx`, `src/components/LandingPage.jsx`, `src/landing.css`, pure entry/release manifest helpers with focused tests, `public/downloads/android-release.json` initial unavailable manifest.

- [x] Implement pathname/native selection, lazy App, popstate/history and loading state. Import `Capacitor` from core; include the native bridge component only for native app.
- [x] Build responsive Arabic-first landing using existing wordmark/palette and code-native route illustration; prominent download/browser choices, real feature summaries, installation instructions, accessible controls.
- [x] Fetch/validate manifest; available release requires a same-origin APK path and meaningful release metadata. Unavailable/malformed/network-failed manifest never renders a broken download. Manifest schema shared with task 2.
- [x] Bundle Leaflet stylesheet via local import in main, coordinating task 2 removal of CDN stylesheet in index.html.
- [x] Verify selection/history/release states with focused behavior checks, production build after dependencies are installed, and mobile/desktop browser checks by parent.

Manifest contract: `available: false` initially. A true manifest has `version` (string), `versionCode` (integer), `url` (same-origin `/downloads/*.apk`), `sizeBytes` (positive integer), `sha256` (64 hex characters), `releasedAt` (ISO string). Shared metadata path `/downloads/android-release.json`.

## Task 2: Capacitor/native and release workflow (Luna)

Ownership: package files, Vite config, capacitor config, generated `android/`, `.gitignore`, native bridge/helpers/location hook, App.jsx for native back integration if needed, index.html, build/publish scripts, Android distribution documentation. Do not modify task 1 files.

- [x] Install aligned Capacitor 8 core/android/CLI plus app and geolocation plugins; use generated official Android project and package ID.
- [x] Configure native assets from `dist-android`, no remote development server in release config; separate web/native builds, exclude download APKs from native assets.
- [x] Add foreground geolocation adapter preserving browser behavior; handle native permission errors, repeated start, stop-before-async-start, unmount cleanup.
- [x] Export `src/components/NativeAppBridge.jsx` for task 1 entry. Handle native back/history, bar layout/safe-area insets and external navigation where required; use clean listener removal. Inspect App.jsx before any changes to avoid disrupting routing/tracking.
- [x] Remove Leaflet CDN stylesheet from index.html after task 1 imports local CSS; add `viewport-fit=cover` as needed.
- [x] Add Android build/sync/open/debug/release commands. Release signing is local env-driven and required for release; ignore credentials/output. Publish only after `apksigner` verification, write versioned APK/manifest/checksum, validate metadata, explain rebuild order so new download ships on website but isn't bundled into native APK.
- [x] Add focused checks for async location lifecycle and release metadata/workflow where meaningful. Build web and native assets, run cap sync, inspect generated configuration. Detect installed toolchain; don't claim APK success without actual compilation.
- [x] Document missing local SDK/JDK, exact build/signing/update instructions, map/search internet dependency, foreground-only location scope, and physical-device checks.

## Integration/review

- [x] Parent reviews both tasks for scope, runtime integration, safe signing and honest release state.
- [x] Resolve compatibility issues using Luna. Check `/`, `/app`, available/unavailable release paths, browser navigation, mobile overflow, native output omits downloads, and source exclusions preserved.
- [x] Verify final builds/checks once after changes, show landing preview, and report any APK compilation blocker with no misleading download.

Verification: 11 focused checks passed; website and native asset builds passed; Capacitor Android sync passed. Browser QA passed at 390px and 1280px with no horizontal overflow. APK compilation and physical-device validation remain blocked by missing Android SDK/JDK 21 and release signing inputs. No key was created and nothing was deployed.

