import { readFile, writeFile } from 'node:fs/promises';
import { filterRouteSummary } from '../src/utils/routePolicy.js';
const source = new URL('../public/data/routes_summary.v2.json', import.meta.url);
const destination = new URL('../functions/api/community/route-ids.json', import.meta.url);
const moduleDestination = new URL('../functions/api/community/_route-ids.js', import.meta.url);
const routes = filterRouteSummary(JSON.parse(await readFile(source, 'utf8')));
const ids = [...new Set(routes.map(route => route.id).filter(id => typeof id === 'string' && id.length <= 128))].sort();
const encoded = `${JSON.stringify(ids)}\n`;
const moduleEncoded = `export default ${JSON.stringify(ids)};\n`;
if (process.argv.includes('--check')) {
  const [manifest, module] = await Promise.all([
    readFile(destination, 'utf8').catch(() => ''),
    readFile(moduleDestination, 'utf8').catch(() => '')
  ]);
  if (manifest !== encoded || module !== moduleEncoded) {
    console.error('Community route ID artifacts are stale; run npm run community:routes.');
    process.exitCode = 1;
  } else console.log(`Verified ${ids.length} community route IDs`);
} else {
  await Promise.all([
    writeFile(destination, encoded),
    writeFile(moduleDestination, moduleEncoded)
  ]);
  console.log(`Wrote ${ids.length} policy-filtered community route IDs and runtime module`);
}
