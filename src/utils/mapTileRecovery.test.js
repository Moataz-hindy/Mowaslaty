import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { attachTileRecovery } from './mapTileRecovery.js';

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const layer = new EventEmitter();
  const network = new EventTarget();
  const states = [];
  const recovery = attachTileRecovery(layer, error => states.push(error), network);
  t.after(() => recovery.dispose());
  return { layer, network, states, recovery };
}

function tile() {
  return {
    requests: [],
    get src() { return 'https://tile.example/19/1/2.png'; },
    set src(url) { this.requests.push(url); }
  };
}

test('retries failures twice with backoff, preserving the original cacheable URL', t => {
  const { layer, states } = setup(t);
  const image = tile();
  layer.emit('tileerror', { tile: image });
  t.mock.timers.tick(1499);
  assert.equal(image.requests.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(image.requests, [image.src]);
  layer.emit('tileerror', { tile: image });
  t.mock.timers.tick(4000);
  assert.equal(image.requests.length, 2);
  layer.emit('tileerror', { tile: image });
  t.mock.timers.tick(60000);
  assert.equal(image.requests.length, 2);
  assert.equal(states.at(-1), true);
});

test('clears the notice only after all failed tiles recover or leave the map', t => {
  const { layer, states } = setup(t);
  const a = tile(), b = tile();
  layer.emit('tileerror', { tile: a });
  layer.emit('tileerror', { tile: b });
  layer.emit('tileload', { tile: a });
  assert.equal(states.at(-1), true);
  layer.emit('tileunload', { tile: b });
  assert.equal(states.at(-1), false);
  t.mock.timers.tick(60000);
  assert.equal(a.requests.length + b.requests.length, 0);
});

test('manual and online retries reload only failed tiles', t => {
  const { layer, network, recovery } = setup(t);
  const failed = tile(), loaded = tile();
  layer.emit('tileload', { tile: loaded });
  layer.emit('tileerror', { tile: failed });
  recovery.retry();
  assert.equal(failed.requests.length, 1);
  network.dispatchEvent(new Event('online'));
  assert.equal(failed.requests.length, 2);
  assert.equal(loaded.requests.length, 0);
  t.mock.timers.tick(60000);
  assert.equal(failed.requests.length, 2);
});

test('cleanup cancels timers and removes event listeners', t => {
  const { layer, network, states, recovery } = setup(t);
  const image = tile();
  layer.emit('tileerror', { tile: image });
  recovery.dispose();
  t.mock.timers.tick(60000);
  network.dispatchEvent(new Event('online'));
  layer.emit('tileerror', { tile: image });
  assert.equal(image.requests.length, 0);
  assert.deepEqual(states, [true]);
  assert.equal(layer.listenerCount('tileerror'), 0);
  assert.equal(layer.listenerCount('tileload'), 0);
  assert.equal(layer.listenerCount('tileunload'), 0);
});
