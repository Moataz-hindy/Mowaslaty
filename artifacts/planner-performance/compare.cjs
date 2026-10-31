const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');

function report(file) { return JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')); }
function caseRun(file) { return report(file).runs[0]; }
for (const [beforeFile, afterFile] of [
  ['before-bus-full.json', 'after-bus-full.json'],
  ['before-urban-all.json', 'after-urban-all-final.json']
]) {
  const before = caseRun(beforeFile);
  const after = caseRun(afterFile);
  assert.deepEqual(after.signature, before.signature, `${before.name} ordered route signatures changed`);
  console.log(`${before.name}: signatures identical; ${before.coldMs.toFixed(1)}ms before -> ${after.coldMs.toFixed(1)}ms after`);
}
const basicBefore = report('before-basic.json');
const basicAfter = report('after-basic.json');
for (const before of basicBefore.runs.filter(run => ['direct_metro_helwan_sadat', 'transfer_metro_attaba_roxy', 'no_service_remote'].includes(run.name))) {
  const after = basicAfter.runs.find(run => run.name === before.name);
  assert.ok(after, `${before.name} has an after fixture`);
  assert.deepEqual(after.signature, before.signature, `${before.name} ordered route signature changed`);
  console.log(`${before.name}: signatures identical; ${before.coldMs.toFixed(1)}ms before -> ${after.coldMs.toFixed(1)}ms after`);
}
