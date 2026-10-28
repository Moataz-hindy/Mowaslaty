import test from 'node:test';
import assert from 'node:assert/strict';
import { hashForHomeSection, hashForRailNetwork, resolveLandingHash } from './railNetworkNavigation.js';

test('legacy metro links and all rail deep links resolve to the rail section', () => {
  assert.deepEqual(resolveLandingHash('#metro'), { section: 'metro', network: 'metro' });
  assert.deepEqual(resolveLandingHash('#lrt'), { section: 'metro', network: 'lrt' });
  assert.deepEqual(resolveLandingHash('#monorail'), { section: 'metro', network: 'monorail' });
});

test('home rail tab keeps the selected network in its hash', () => {
  assert.equal(hashForHomeSection('metro', 'lrt'), '#lrt');
  assert.equal(hashForHomeSection('metro', 'monorail'), '#monorail');
  assert.equal(hashForRailNetwork('metro'), '#metro');
});

test('other home sections keep their existing URL behavior', () => {
  assert.equal(hashForHomeSection('home', 'lrt'), '');
  assert.equal(hashForHomeSection('routes', 'lrt'), '#routes');
  assert.deepEqual(resolveLandingHash('#routes'), { section: 'routes', network: 'metro' });
  assert.deepEqual(resolveLandingHash(''), { section: 'home', network: 'metro' });
});

test('community has its own home hash without changing legacy rail hashes', () => {
  assert.equal(hashForHomeSection('community', 'lrt'), '#community');
  assert.deepEqual(resolveLandingHash('#community'), { section: 'community', network: 'metro' });
  assert.deepEqual(resolveLandingHash('#lrt'), { section: 'metro', network: 'lrt' });
});
