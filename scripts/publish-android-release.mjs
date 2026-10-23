import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createReleaseManifest, validateReleaseMetadata } from './release-metadata.mjs';

const fail = message => { console.error(`Android release publish failed: ${message}`); process.exit(1); };
const apkPath = process.argv[2] || 'android/app/build/outputs/apk/release/app-release.apk';
let metadata;
try { metadata = validateReleaseMetadata({ version: process.env.ANDROID_VERSION, versionCode: process.env.ANDROID_VERSION_CODE, releasedAt: process.env.ANDROID_RELEASED_AT || new Date().toISOString() }); }
catch (error) { fail(error.message); }
let info;
try { info = await stat(apkPath); } catch { fail(`APK does not exist: ${apkPath}`); }
if (!info.isFile() || info.size < 1) fail('APK is empty or not a file.');
const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
let buildTools = [];
if (sdkRoot) {
  try {
    buildTools = (await readdir(path.join(sdkRoot, 'build-tools')))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map(version => path.join(sdkRoot, 'build-tools', version));
  } catch { /* clear failure below */ }
}
let signer = process.env.APKSIGNER;
if (!signer) signer = buildTools.map(dir => path.join(dir, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner')).find(existsSync);
signer ||= 'apksigner';
const verified = spawnSync(signer, ['verify', '--verbose', '--print-certs', apkPath], { stdio: 'pipe', encoding: 'utf8', shell: process.platform === 'win32' });
if (verified.error || verified.status !== 0) fail(`Signed APK verification failed with ${signer}. Configure ANDROID_SDK_ROOT or APK signer path.`);
const certOutput = `${verified.stdout || ''}${verified.stderr || ''}`;
if (/Android Debug|androiddebugkey/i.test(certOutput)) fail('APK uses the Android debug certificate and cannot be published.');
const aapt = (sdkRoot && buildTools.map(dir => path.join(dir, process.platform === 'win32' ? 'aapt.exe' : 'aapt')).find(existsSync)) || process.env.AAPT;
if (!aapt) fail('Android build-tools aapt is required to verify APK package/version metadata. Set ANDROID_SDK_ROOT or AAPT.');
const badging = spawnSync(aapt, ['dump', 'badging', apkPath], { encoding: 'utf8' });
if (badging.error || badging.status !== 0) fail('Unable to read APK metadata with aapt.');
const packageInfo = (badging.stdout || '').match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']*)'/m);
if (!packageInfo || packageInfo[1] !== 'dev.mowaslaty.app' || Number(packageInfo[2]) !== metadata.versionCode || packageInfo[3] !== metadata.version) {
  fail('APK package name, version, or version code does not match this release metadata.');
}
if (/^application:.*testOnly='true'/m.test(badging.stdout || '')) fail('APK is marked testOnly and cannot be published.');
const apk = await readFile(apkPath);
const sha256 = createHash('sha256').update(apk).digest('hex');
const downloads = path.resolve('public/downloads');
await mkdir(downloads, { recursive: true });
const filename = `mowaslaty-${metadata.version}.apk`;
await copyFile(apkPath, path.join(downloads, filename));
const manifest = createReleaseManifest(metadata, { sizeBytes: info.size, sha256 });
await writeFile(path.join(downloads, 'android-release.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await writeFile(path.join(downloads, `${filename}.sha256`), `${sha256}  ${filename}\n`, 'utf8');
console.log(`Published ${filename} (${info.size} bytes, SHA-256 ${sha256}). Rebuild the website to ship the manifest and APK.`);
