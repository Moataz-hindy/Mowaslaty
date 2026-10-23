import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['exec', 'vite', '--', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, MOWASLATY_NATIVE_BUILD: '1' }
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
