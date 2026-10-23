# Android app and landing page

User request: plan the existing React app's Android release and new download landing page, then implement using Luna with medium reasoning. The user wants website APK distribution, without Google Play. Earlier discussion selected Capacitor to reuse the application.

## Experience

- Website `/` presents an Arabic-first, responsive landing page in the existing paper/ink/amber style. Main choices: `تحميل تطبيق أندرويد` and `المتابعة من المتصفح`.
- `/app` and `/app/` open the existing planner, including direct refresh and browser back/forward. Load planner code/data only when entering it. Native Capacitor launches the planner directly and never shows the download landing page.
- Explain existing route discovery, journey planning, and multiple destinations concisely. No invented route coverage, user counts, live-service guarantees, offline-map promises, or background-alert promises.
- Download uses a same-origin release manifest. With no real published signed APK, display a truthful unavailable/preparing state and keep browser access prominent. When an artifact is published, provide its version, size, and download link plus short Android installation steps. Do not link a missing APK or a debug artifact as a production release.
- Android embeds the built application assets; no production `server.url` pointing at a website or localhost development server. Package ID: `dev.mowaslaty.app`; app name: `مواصلاتي`.
- Use native foreground GPS on Android and retain browser geolocation on web. Request permissions only after user location action. Preserve cancellation, permission denial, cleanup, and start/stop behavior.
- Support Android system back and suitable screen/status/navigation-bar layout; location tracking while screen locked is not promised in this phase. Preserve the existing tracking and route calculator behavior.

## Structure and distribution

- Keep the existing React/Vite/Leaflet app. Use Capacitor 8 compatible packages from npm; Node 24 is available. Generate Android sources with the official CLI.
- Keep website output `dist` separate from native output `dist-android`. Native output excludes website APK downloads, preventing APKs from embedding earlier APKs. All source datasets and route exclusions remain intact.
- Commit no keystore, password, local SDK path, build output, generated APK, or Android cache. Release signing reads local environment settings. Missing credentials must fail a release build clearly rather than silently producing unsigned/debug downloads.
- Release preparation verifies the signed APK using Android tooling, publishes a versioned APK and machine-readable metadata (including SHA-256/size), and documents updating the website build. No public deployment during this task.
- Include reproducible commands for web builds, native sync/open/debug builds, release signing/publication, required SDK/JDK, and a physical Android smoke checklist. Do not generate signing credentials on behalf of the user.

## Environment limitation

Inspection found only Java 8, no Android SDK/Android Studio at configured or standard locations. Finish all implementation and web/native-project validation possible; report actual APK compiler blockers honestly. Do not represent scaffold/sync as a compiled APK or an untested device build as tested.

## Acceptance

Responsive landing works at 390px and desktop without horizontal overflow; browser CTA opens planner and history works. Download unavailable state is honest, available state is driven by validated metadata. Native startup bypasses landing, native GPS remains permission-driven and cleans up async watches. Generated native project syncs; relevant automated checks and web/native Vite builds pass. APK compilation is attempted only with suitable local tools; remaining toolchain prerequisites are recorded if absent.
