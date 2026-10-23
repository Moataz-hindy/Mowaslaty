import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExperience, validateReleaseManifest } from './experienceEntry.js';

test('route selection keeps native users in planner and website root on landing', () => {
  assert.equal(resolveExperience('/', false), 'landing');
  assert.equal(resolveExperience('/app', false), 'app');
  assert.equal(resolveExperience('/app/', false), 'app');
  assert.equal(resolveExperience('/', true), 'app');
});

test('release manifest accepts only complete same-origin APK releases', () => {
  const valid = { available: true, version: '1.2.0', versionCode: 12, url: '/downloads/mowaslaty-1.2.0.apk', sizeBytes: 1200, sha256: 'a'.repeat(64), releasedAt: '2026-10-23T10:00:00Z' };
  assert.equal(validateReleaseManifest(valid).url, valid.url);
  assert.equal(validateReleaseManifest({ available: false }).available, false);
  assert.equal(validateReleaseManifest({ ...valid, url: 'https://bad.example/app.apk' }), null);
  assert.equal(validateReleaseManifest({ ...valid, url: '/downloads/missing.apk?x=1' }), null);
  assert.equal(validateReleaseManifest({ ...valid, sha256: 'bad' }), null);
  assert.equal(validateReleaseManifest({ ...valid, sizeBytes: 0 }), null);
});
