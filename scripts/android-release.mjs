import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { validateReleaseMetadata } from './release-metadata.mjs';

const required = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error(`Release signing requires local environment values: ${missing.join(', ')}. No credentials were generated or stored by this project.`);
  process.exit(1);
}
if (!existsSync(process.env.ANDROID_KEYSTORE_PATH)) {
  console.error('ANDROID_KEYSTORE_PATH does not point to an existing keystore.');
  process.exit(1);
}
try { validateReleaseMetadata({ version: process.env.ANDROID_VERSION, versionCode: process.env.ANDROID_VERSION_CODE, releasedAt: process.env.ANDROID_RELEASED_AT || new Date().toISOString() }); }
catch (error) { console.error(`Android release failed: ${error.message}`); process.exit(1); }
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nativeBuild = spawnSync(npm, ['run', 'native:build'], { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
if (nativeBuild.error || nativeBuild.status !== 0) process.exit(nativeBuild.status ?? 1);
const sync = spawnSync(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android'], { stdio: 'inherit', env: process.env });
if (sync.error || sync.status !== 0) process.exit(sync.status ?? 1);
const gradle = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
const build = spawnSync(gradle, ['assembleRelease'], { cwd: path.resolve('android'), stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
if (build.error || build.status !== 0) process.exit(build.status ?? 1);
const publish = spawnSync(process.execPath, ['scripts/publish-android-release.mjs', 'android/app/build/outputs/apk/release/app-release.apk'], { stdio: 'inherit', env: process.env });
process.exit(publish.status ?? 1);
