import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeLocationCallback } from '../src/utils/locationAdapter.js';
import { createReleaseManifest, validateReleaseMetadata } from './release-metadata.mjs';
import { validateReleaseManifest } from '../src/utils/experienceEntry.js';

test('native location callback forwards positions and plugin errors through their proper channels', () => {
  const positions = [];
  const errors = [];
  const callback = nativeLocationCallback(value => positions.push(value), error => errors.push(error));
  const point = { coords: { latitude: 1, longitude: 2 } };
  const denied = { code: 'OS-PLUG-GLOC-0003' };
  callback(point);
  callback(null, denied);
  callback(null);
  assert.deepEqual(positions, [point]);
  assert.deepEqual(errors, [denied]);
});

test('release metadata produces a same-origin versioned URL and digest metadata', () => {
  const metadata = validateReleaseMetadata({ version: '2.4.1', versionCode: '24', releasedAt: '2026-10-23T12:30:00.000Z' });
  assert.deepEqual(createReleaseManifest(metadata, { sizeBytes: 4096, sha256: 'A'.repeat(64) }), {
    available: true,
    version: '2.4.1',
    versionCode: 24,
    url: '/downloads/mowaslaty-2.4.1.apk',
    sizeBytes: 4096,
    sha256: 'a'.repeat(64),
    releasedAt: '2026-10-23T12:30:00.000Z'
  });
});

test('published manifest round-trips through the landing page validator', () => {
  const metadata = validateReleaseMetadata({ version: '3.1.0-rc.1', versionCode: 31, releasedAt: '2026-10-23T12:30:00Z' });
  const manifest = createReleaseManifest(metadata, { sizeBytes: 8192, sha256: 'b'.repeat(64) });
  assert.deepEqual(validateReleaseManifest(manifest, 'https://mowaslaty.example'), { ...manifest });
});

test('release metadata rejects path traversal, malformed version codes, and bad hashes', () => {
  assert.throws(() => validateReleaseMetadata({ version: '../debug', versionCode: 3 }), /digits, dots, letters, and hyphens/);
  assert.throws(() => validateReleaseMetadata({ version: '1.2.0', versionCode: 0 }), /positive integer/);
  assert.throws(() => createReleaseManifest({ version: '1.2.0', versionCode: 12 }, { sizeBytes: 2, sha256: 'bad' }), /64 hexadecimal/);
});
