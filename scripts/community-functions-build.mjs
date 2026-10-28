import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const routeCheck = spawnSync(process.execPath, [resolve('scripts/community-route-ids.mjs'), '--check'], {
  stdio: 'inherit'
});
if (routeCheck.error) throw routeCheck.error;
if (routeCheck.status !== 0) process.exit(routeCheck.status ?? 1);
const out = await mkdtemp(join(tmpdir(), 'mowaslaty-pages-'));
try {
  const result = spawnSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'pages', 'functions', 'build', 'functions', '--outdir', out], {
    stdio: 'inherit',
    env: {
      ...process.env,
      XDG_CONFIG_HOME: out,
      XDG_DATA_HOME: out,
      WRANGLER_SEND_METRICS: 'false'
    }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  await rm(out, {
    recursive: true,
    force: true
  });
}
