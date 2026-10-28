export const COMMUNITY_DRAFTS_KEY = 'mowaslaty_community_drafts_v1';
export const COMMUNITY_DRAFTS_VERSION = 1;
export const COMMUNITY_DRAFTS_LIMIT = 50;
export const COMMUNITY_BODY_LIMIT = 2000;
export const COMMUNITY_CATEGORIES = ['fare', 'detour', 'frequency', 'tip', 'route'];

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function resolveStorage(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

export function validateDraft(draft) {
  return isPlainObject(draft)
    && typeof draft.id === 'string' && draft.id.length > 0 && draft.id.length <= 100
    && typeof draft.routeId === 'string' && draft.routeId.length > 0 && draft.routeId.length <= 200
    && COMMUNITY_CATEGORIES.includes(draft.category)
    && typeof draft.body === 'string' && draft.body.trim().length > 0 && draft.body.length <= COMMUNITY_BODY_LIMIT
    && typeof draft.createdAt === 'string' && Number.isFinite(Date.parse(draft.createdAt))
    && typeof draft.updatedAt === 'string' && Number.isFinite(Date.parse(draft.updatedAt));
}

export function readDraftStore(storage) {
  try {
    const target = resolveStorage(storage);
    if (!target || typeof target.getItem !== 'function') return { ok: false, drafts: [], error: 'unavailable' };
    const raw = target.getItem(COMMUNITY_DRAFTS_KEY);
    if (!raw) return { ok: true, drafts: [] };
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed) || parsed.version !== COMMUNITY_DRAFTS_VERSION || !Array.isArray(parsed.drafts)
      || parsed.drafts.length > COMMUNITY_DRAFTS_LIMIT || !parsed.drafts.every(validateDraft)) {
      return { ok: false, drafts: [], error: 'invalid' };
    }
    return { ok: true, drafts: parsed.drafts };
  } catch (error) {
    return { ok: false, drafts: [], error: 'unavailable' };
  }
}

export function loadDrafts(storage) {
  return readDraftStore(storage).drafts;
}

function writeDrafts(drafts, storage) {
  try {
    const target = resolveStorage(storage);
    if (!target || typeof target.setItem !== 'function') return { ok: false, drafts, error: 'unavailable' };
    target.setItem(COMMUNITY_DRAFTS_KEY, JSON.stringify({ version: COMMUNITY_DRAFTS_VERSION, drafts }));
    return { ok: true, drafts };
  } catch {
    return { ok: false, drafts, error: 'unavailable' };
  }
}

export function addDraft(input, storage, createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, now = () => new Date().toISOString()) {
  const current = readDraftStore(storage);
  if (!current.ok) return current;
  if (current.drafts.length >= COMMUNITY_DRAFTS_LIMIT) return { ok: false, drafts: current.drafts, error: 'limit' };
  if (!isPlainObject(input) || typeof input.routeId !== 'string' || !input.routeId.trim() || input.routeId.length > 200
    || !COMMUNITY_CATEGORIES.includes(input.category) || typeof input.body !== 'string'
    || !input.body.trim() || input.body.length > COMMUNITY_BODY_LIMIT) {
    return { ok: false, drafts: current.drafts, error: 'invalid' };
  }
  const timestamp = now();
  const draft = { id: createId(), routeId: input.routeId, category: input.category, body: input.body.trim(), createdAt: timestamp, updatedAt: timestamp };
  if (!validateDraft(draft)) return { ok: false, drafts: current.drafts, error: 'invalid' };
  return writeDrafts([draft, ...current.drafts], storage);
}

export function updateDraft(id, changes, storage, now = () => new Date().toISOString()) {
  const current = readDraftStore(storage);
  if (!current.ok) return current;
  const existing = current.drafts.find(draft => draft.id === id);
  if (!existing) return { ok: false, drafts: current.drafts, error: 'missing' };
  const updated = { ...existing, routeId: changes?.routeId ?? existing.routeId, category: changes?.category ?? existing.category, body: changes?.body ?? existing.body, updatedAt: now() };
  if (!validateDraft(updated)) return { ok: false, drafts: current.drafts, error: 'invalid' };
  return writeDrafts(current.drafts.map(draft => draft.id === id ? updated : draft), storage);
}

export function deleteDraft(id, storage) {
  const current = readDraftStore(storage);
  if (!current.ok) return current;
  if (!current.drafts.some(draft => draft.id === id)) return { ok: false, drafts: current.drafts, error: 'missing' };
  return writeDrafts(current.drafts.filter(draft => draft.id !== id), storage);
}
