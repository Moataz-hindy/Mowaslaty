import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';

const run = (command, args = []) => {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10000 });
  return result.error ? result.error.message : `${result.stdout || ''}${result.stderr || ''}`.trim();
};
const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
const java = run('java', ['-version']);
console.log(`Java: ${java || 'not found'}`);
const javaMajor = Number((java.match(/version "(?:1\.)?(\d+)/i) || [])[1]);
console.log(`JDK 21+: ${Number.isFinite(javaMajor) && javaMajor >= 21 ? 'available' : 'required for Capacitor 8'}`);
console.log(`ANDROID_SDK_ROOT: ${sdk || 'not configured'}`);
if (sdk) {
  for (const part of ['platform-tools/adb', 'platform-tools/adb.exe', 'build-tools']) {
    console.log(`${part}: ${existsSync(path.join(sdk, part)) ? 'found' : 'missing'}`);
  }
}
if (!sdk) console.log('APK build is unavailable until Android Studio SDK is installed and ANDROID_SDK_ROOT is configured.');
