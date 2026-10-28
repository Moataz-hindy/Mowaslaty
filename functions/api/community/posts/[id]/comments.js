import { account, body, cursorFor, cursorParam, csrf, fail, id, iso, json, publishing, rate, results, validText } from '../../_shared.js';
export async function onRequestGet({
  request,
  env,
  params
}) {
  const db = env?.COMMUNITY_DB;
  if (!db) return fail('CommunityUnavailable', 503);
  const p = new URL(request.url).searchParams,
    limit = Number(p.get('limit') || 20),
    c = p.get('cursor');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || c && (!cursorParam(c) || c.length > 256)) return fail('InvalidQuery', 400);
  const cur = c ? cursorParam(c) : null;
  try {
    const rows = await results(db.prepare(`SELECT c.id,c.report_id AS reportId,c.body,c.created_at AS createdAt,COALESCE(NULLIF(trim(u.display_name),''),'Community member') AS authorDisplayName FROM community_comments c JOIN community_reports r ON r.id=c.report_id LEFT JOIN community_users u ON u.id=c.user_id WHERE c.report_id=? AND r.status='approved' AND c.status='approved' ${cur ? 'AND (c.created_at>? OR (c.created_at=? AND c.id>?))' : ''} ORDER BY c.created_at,c.id LIMIT ?`).bind(...(cur ? [params.id, cur.t, cur.t, cur.id, limit + 1] : [params.id, limit + 1])));
    const more = rows.length > limit,
      vis = rows.slice(0, limit).map(x => ({
        ...x,
        createdAt: iso(x.createdAt)
      }));
    return json({
      comments: vis,
      nextCursor: more ? cursorFor(rows[limit - 1]) : null
    });
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
export async function onRequestPost({
  request,
  env,
  params
}) {
  if (!publishing(env)) return fail('PublishingUnavailable', 503);
  if (csrf(request)) return csrf(request);
  const a = await account(request, env);
  if (a.error) return a.error;
  if (!a.user.displayName?.trim()) return fail('DisplayNameRequired', 409);
  const b = await body(request, 8192);
  if (b.error) return b.error;
  if (!validText(b.value?.body, 1000)) return fail('InvalidComment', 400);
  const db = env.COMMUNITY_DB,
    t = Date.now(),
    cid = id();
  try {
    if (!(await rate(db, a.user.id, 'comment', 20))) return fail('RateLimited', 429);
    const inserted = await db.prepare("INSERT INTO community_comments(id,report_id,user_id,body,status,created_at) SELECT ?,?,?,?,'pending',? WHERE EXISTS (SELECT 1 FROM community_reports WHERE id=? AND status='approved')").bind(cid, params.id, a.user.id, b.value.body.trim(), t, params.id).run();
    if (inserted?.success !== true) throw new Error('Database write failed');
    if (inserted?.meta?.changes !== 1) return fail('NotFound', 404);
    return json({
      comment: {
        id: cid,
        reportId: params.id,
        body: b.value.body.trim(),
        createdAt: iso(t),
        authorDisplayName: a.user.displayName,
        status: 'pending'
      }
    }, 201);
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
