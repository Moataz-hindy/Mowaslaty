import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceIfChanged, appendUniqueById, createEpochController } from './asyncState.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('late request results are ignored after session or filter epoch changes', async () => {
  const requests = createEpochController();
  const slow = deferred();
  const oldEpoch = requests.advance();
  const oldResult = slow.promise.then(value => requests.isCurrent(oldEpoch) ? value : null);
  const activeEpoch = requests.advance();
  slow.resolve('private pending moderation rows');
  assert.equal(await oldResult, null);
  assert.equal(requests.isCurrent(activeEpoch), true);
});

test('pagination deduplicates IDs shared by adjacent pages', () => {
  const merged = appendUniqueById([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]);
  assert.deepEqual(merged, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
});

test('selecting the active filter does not invalidate its pending feed request', async () => {
  const feed = createEpochController();
  const pendingFetch = deferred();
  const requestEpoch = feed.advance();
  const result = pendingFetch.promise.then(value => feed.isCurrent(requestEpoch) ? value : null);
  assert.equal(advanceIfChanged(feed, 'ALL', 'ALL'), requestEpoch);
  pendingFetch.resolve('first page');
  assert.equal(await result, 'first page');
});
