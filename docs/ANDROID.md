# Android distribution

Mowaslaty uses Capacitor to package the planner as an Android app. The package is `dev.mowaslaty.app`. The web app stays available at `/app`; the website landing page uses a release manifest to offer a direct APK download after a real signed release is published.

## Requirements

Install Node.js 24, Android Studio with the Android SDK and platform tools, and JDK 21. Select JDK 21 as the Gradle JDK in Android Studio, or install it there if needed. The Android Studio bundled runtime may be a newer Java version and may not work with this project's Gradle wrapper. For command-line builds, set `JAVA_HOME` to JDK 21. Set `ANDROID_SDK_ROOT` to the SDK directory and accept the SDK licenses. `npm run android:toolchain` reports the local prerequisites. Open `android/` in Android Studio once if you need to install the selected SDK platform/build tools.

## Build and run

```sh
npm install
npm run build                 # Website assets in dist/
npm run native:build          # Planner assets in dist-android/; excludes public/downloads
npm run android:sync          # Build native assets, then cap sync android
npm run android:open          # Open the generated Android project
npm run android:debug         # Sync and install/run on a connected device or emulator
```

The release config embeds local assets and has no `server.url`. Online route search and map tiles still need an internet connection. Location permission is requested only after the user taps the location action. Tracking is foreground-only; location while the screen is locked is not promised.

## Sign and publish an APK

On Windows, initialize the first local release key and compile the Android Java release sources with:

```powershell
npm run android:local:prepare
```

The helper creates a 4096-bit RSA release key once (`mowaslaty-release.jks`, alias `mowaslaty-release`) under `%LOCALAPPDATA%\Mowaslaty\Signing`, protects its generated passwords with Windows CurrentUser DPAPI, and restricts the directory ACL to your Windows account. It never displays the passwords or DPAPI data. Re-running it reuses a complete key state; incomplete or unexpected state is rejected without overwriting files. Keep a recoverable backup of the JKS and passwords: DPAPI data can only be decrypted by the same Windows user on the same Windows installation. For migration, decrypt the local values on that machine and re-protect them for the destination user rather than copying DPAPI files as a portable backup.

The helper fixes this first release at version `1.0.0` and version code `1`. `-PrepareOnly` does not assemble or publish an APK. After reviewing the native service adapter and release preparation, use `npm run android:local:release` to run the signed release workflow. It restores all signing environment variables to their previous process values when it exits. It never accepts Android SDK licenses automatically; handle any SDK license prompt through Android Studio or `sdkmanager` yourself.

For non-Windows builds, use a keystore created through your organization's normal key custody process. Set these values in your local shell or secret manager; do not commit them:

```text
ANDROID_KEYSTORE_PATH
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
ANDROID_VERSION
ANDROID_VERSION_CODE
ANDROID_SDK_ROOT
```

Then run:

```sh
npm run android:release
npm run build
```

The release command requires all signing inputs, builds `assembleRelease`, verifies the signed APK with `apksigner`, and publishes `mowaslaty-<version>.apk`, its SHA-256 sidecar, and `public/downloads/android-release.json`. The manifest is replaced atomically only after APK verification and artifact writes succeed. The website build then copies these public files to `dist/downloads` for your normal website deployment. Build the website after publishing so the download page receives the new APK and manifest. The APK is excluded from native assets, so it cannot recursively include itself or an older release.

For a separately signed APK, publish it with `npm run android:publish -- path/to/signed.apk` after setting `ANDROID_VERSION` and `ANDROID_VERSION_CODE`. The publisher rejects unsigned or unverifiable APKs. Never publish `app-debug.apk` as a production release.

## Device checks before distribution

- Install the signed APK on a supported Android phone and confirm first launch works without a network redirect.
- Test route search, multi-destination planning, map tiles, app resume, Android back, and safe-area layout.
- Tap the location action, allow and deny permission in separate runs, then stop tracking and leave/reopen the app.
- On the website, confirm the unavailable state has no APK link before publishing and that the published version, size, and SHA-256 match the signed artifact afterward.
