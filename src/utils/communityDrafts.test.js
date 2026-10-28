import test from 'node:test';
import assert from 'node:assert/strict';
import { addDraft, deleteDraft, loadDrafts, updateDraft } from './communityDrafts.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    values,
  };
}

test('drafts validate, persist only the supported fields, and survive reload', () => {
  const storage = memoryStorage();
  const result = addDraft({ routeId: 'route-1', category: 'fare', body: ' New fare ' }, storage, () => 'draft-1', () => '2026-10-26T10:00:00.000Z');
  assert.equal(result.ok, true);
  assert.deepEqual(loadDrafts(storage), [{ id: 'draft-1', routeId: 'route-1', category: 'fare', body: 'New fare', createdAt: '2026-10-26T10:00:00.000Z', updatedAt: '2026-10-26T10:00:00.000Z' }]);
  assert.equal(storage.values.has('mowaslaty_community_reports'), false);
});

test('draft mutations reject invalid content and preserve prior value on save failure', () => {
  const storage = memoryStorage();
  addDraft({ routeId: 'route-1', category: 'tip', body: 'Keep this' }, storage, () => 'draft-1', () => '2026-10-26T10:00:00.000Z');
  assert.equal(updateDraft('draft-1', { category: 'unknown', body: 'bad' }, storage).ok, false);
  assert.equal(deleteDraft('missing', storage).ok, false);
  const broken = { ...storage, setItem: () => { throw new Error('private mode'); } };
  assert.equal(updateDraft('draft-1', { body: 'changed' }, broken).ok, false);
  assert.equal(loadDrafts(storage)[0].body, 'Keep this');
});

test('draft updates can retain an exact route ID and unavailable storage never reports success', () => {
  const storage = memoryStorage();
  addDraft({ routeId: 'route-1', category: 'tip', body: 'Keep this' }, storage, () => 'draft-1', () => '2026-10-26T10:00:00.000Z');
  const changed = updateDraft('draft-1', { routeId: 'route-2' }, storage, () => '2026-10-26T11:00:00.000Z');
  assert.equal(changed.drafts[0].routeId, 'route-2');
  assert.equal(addDraft({ routeId: 'route', category: 'tip', body: 'hello' }, null).ok, false);
});

test('a draft remains editable by body and category when its route is absent from the current directory', () => {
  const storage = memoryStorage();
  addDraft({ routeId: 'retired-route-id', category: 'tip', body: 'Old text' }, storage, () => 'draft-unavailable-route', () => '2026-10-26T10:00:00.000Z');
  // No route lookup is needed for local draft editing; the existing exact ID is retained.
  const updated = updateDraft('draft-unavailable-route', { category: 'detour', body: 'Updated details' }, storage, () => '2026-10-26T11:00:00.000Z');
  assert.equal(updated.ok, true);
  assert.equal(updated.drafts[0].routeId, 'retired-route-id');
  assert.equal(updated.drafts[0].category, 'detour');
  assert.equal(updated.drafts[0].body, 'Updated details');
});

test('corrupt and oversized draft data is safely rejected', () => {
  assert.deepEqual(loadDrafts(memoryStorage({ mowaslaty_community_drafts_v1: '{' })), []);
  assert.equal(addDraft({ routeId: 'route', category: 'tip', body: 'x'.repeat(2001) }, memoryStorage()).ok, false);
});
