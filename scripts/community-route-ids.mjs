import { readFile, writeFile } from 'node:fs/promises';
import { filterRouteSummary } from '../src/utils/routePolicy.js';
const source = new URL('../public/data/routes_summary.v2.json', import.meta.url);
const destination = new URL('../functions/api/community/route-ids.json', import.meta.url);
const routes = filterRouteSummary(JSON.parse(await readFile(source, 'utf8')));
const ids = [...new Set(routes.map(route => route.id).filter(id => typeof id === 'string' && id.length <= 128))].sort();
const encoded = `${JSON.stringify(ids)}\n`;
if (process.argv.includes('--check')) {
  if ((await readFile(destination, 'utf8').catch(() => '')) !== encoded) {
    console.error('Community route ID manifest is stale; run npm run community:routes.');
    process.exitCode = 1;
  } else console.log(`Verified ${ids.length} community route IDs`);
} else {
  await writeFile(destination, encoded);
  console.log(`Wrote ${ids.length} policy-filtered community route IDs`);
}
