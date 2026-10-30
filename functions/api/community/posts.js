import { account, body as readBody, categories, csrf, fail, id, iso, json, publishing, rate, results, routeIdsJson, run, validPost } from './_shared.js';
import { containsBlockedArabicWord } from './_content-filter.js';
const CATEGORIES = new Set(categories);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 120;
const MAX_CURSOR_LENGTH = 256;
function invalid(message) {
  return Object.assign(new Error(message), {
    status: 400
  });
}
function parseLimit(value) {
  if (value === null) return DEFAULT_LIMIT;
  if (!/^[0-9]{1,2}$/.test(value)) throw invalid('Invalid limit');
  const number = Number(value);
  if (number < 1 || number > MAX_LIMIT) throw invalid('Invalid limit');
  return number;
}
function parseCursor(value) {
  if (value === null) return null;
  if (value.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) throw invalid('Invalid cursor');
  try {
    const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
    const splitAt = decoded.indexOf(':');
    if (splitAt < 1) throw new Error('bad cursor');
    const createdAt = Number(decoded.slice(0, splitAt));
    const id = decoded.slice(splitAt + 1);
    if (!Number.isSafeInteger(createdAt) || createdAt < 0 || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('bad cursor');
    return {
      createdAt,
      id
    };
  } catch {
    throw invalid('Invalid cursor');
  }
}
function makeCursor(post) {
  return btoa(`${post.createdAt}:${post.id}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export async function onRequestGet({
  request,
  env
}) {
  const params = new URL(request.url).searchParams;
  let category;
  let query;
  let limit;
  let cursor;
  try {
    category = params.get('category') ?? 'ALL';
    if (category !== 'ALL' && !CATEGORIES.has(category)) throw invalid('Invalid category');
    query = params.get('q') ?? '';
    if (query.length > MAX_QUERY_LENGTH || query.includes('\0')) throw invalid('Invalid query');
    limit = parseLimit(params.get('limit'));
    cursor = parseCursor(params.get('cursor'));
  } catch (error) {
    return json({
      code: 'InvalidQuery'
    }, 400);
  }
  const db = env?.COMMUNITY_DB;
  if (!db) return json({
    code: 'CommunityUnavailable'
  }, 503);
  const clauses = ["r.status = 'approved'", 'r.route_id IN (SELECT value FROM json_each(?))'];
  const bindings = [routeIdsJson];
  if (category !== 'ALL') {
    clauses.push('r.category = ?');
    bindings.push(category);
  }
  if (query) {
    clauses.push("(instr(lower(r.body), lower(?)) > 0 OR instr(lower(r.route_id), lower(?)) > 0)");
    bindings.push(query, query);
  }
  if (cursor) {
    clauses.push('(r.created_at < ? OR (r.created_at = ? AND r.id < ?))');
    bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  bindings.push(limit + 1);
  const sql = `SELECT r.id, r.route_id AS routeId, r.category, r.body, r.created_at AS createdAt,
      COALESCE(NULLIF(trim(u.display_name), ''), 'Community member') AS authorDisplayName,
      (SELECT COALESCE(sum(value),0) FROM community_votes v WHERE v.report_id=r.id) AS voteScore,
      (SELECT count(*) FROM community_comments c WHERE c.report_id=r.id AND c.status='approved') AS commentCount
    FROM community_reports AS r
    LEFT JOIN community_users AS u ON u.id = r.user_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ?`;
  try {
    const result = await db.prepare(sql).bind(...bindings).all();
    if (result?.success === false || !Array.isArray(result?.results)) throw new Error('Database read failed');
    const rows = result.results;
    const hasMore = rows.length > limit;
    const visible = rows.slice(0, limit).map(row => ({
      id: row.id,
      routeId: row.routeId,
      category: row.category,
      body: row.body,
      createdAt: new Date(row.createdAt).toISOString(),
      authorDisplayName: typeof row.authorDisplayName === 'string' && row.authorDisplayName.trim() ? row.authorDisplayName.trim() : 'Community member',
      voteScore: Number(row.voteScore || 0),
      commentCount: Number(row.commentCount || 0)
    }));
    return json({
      posts: visible,
      nextCursor: hasMore ? makeCursor(rows[limit - 1]) : null
    });
  } catch {
    return json({
      code: 'CommunityUnavailable'
    }, 503);
  }
}
export async function onRequestPost({
  request,
  env
}) {
  if (!publishing(env)) return json({
    code: 'PublishingUnavailable'
  }, 503);
  if (csrf(request)) return csrf(request);
  const auth = await account(request, env);
  if (auth.error) return auth.error;
  const parsed = await readBody(request, 16384);
  if (parsed.error) return parsed.error;
  if (!validPost(parsed.value)) return fail('InvalidPost', 400);
  if (!auth.user.displayName?.trim()) return fail('DisplayNameRequired', 409);
  const db = env.COMMUNITY_DB,
    t = Date.now(),
    pid = id();
  try {
    if (!(await rate(db, auth.user.id, 'post', 8))) return fail('RateLimited', 429);
    if (containsBlockedArabicWord(auth.user.displayName) || containsBlockedArabicWord(parsed.value.body)) return fail('ContentBlocked', 400);
    await run(db.prepare("INSERT INTO community_reports(id,user_id,route_id,category,body,status,created_at,updated_at,reviewed_at) VALUES(?,?,?,?,?,'approved',?,?,?)").bind(pid, auth.user.id, parsed.value.routeId, parsed.value.category, parsed.value.body.trim(), t, t, t));
    return json({
      post: {
        id: pid,
        routeId: parsed.value.routeId,
        category: parsed.value.category,
        body: parsed.value.body.trim(),
        createdAt: iso(t),
        authorDisplayName: auth.user.displayName,
        status: 'approved'
      }
    }, 201);
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
export const onRequestPut = ({
  env
}) => publishing(env) ? fail('MethodNotAllowed', 405) : fail('PublishingUnavailable', 503);
export const onRequestPatch = ({
  env
}) => publishing(env) ? fail('MethodNotAllowed', 405) : fail('PublishingUnavailable', 503);
export const onRequestDelete = ({
  env
}) => publishing(env) ? fail('MethodNotAllowed', 405) : fail('PublishingUnavailable', 503);
