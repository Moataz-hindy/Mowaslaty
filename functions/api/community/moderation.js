import { account, body, cursorFor, cursorParam, csrf, fail, id, iso, json, publishing, rate, results } from './_shared.js';
export async function onRequestGet({
  request,
  env
}) {
  if (!publishing(env)) return fail('CommunityUnavailable', 503);
  const a = await account(request, env);
  if (a.error) return a.error;
  if (!a.user.isModerator) return fail('Forbidden', 403);
  const p = new URL(request.url).searchParams,
    kind = p.get('kind') || 'posts',
    status = p.get('status') || 'pending',
    limit = Number(p.get('limit') || 20),
    c = p.get('cursor');
  if (!['posts', 'comments'].includes(kind) || !['pending', 'approved', 'rejected', 'hidden'].includes(status) || !Number.isInteger(limit) || limit < 1 || limit > 50 || c && (!cursorParam(c) || c.length > 256)) return fail('InvalidQuery', 400);
  const cur = c ? cursorParam(c) : null,
    comment = kind === 'comments';
  try {
    const idfield = comment ? 'c.id' : 'r.id',
      timefield = comment ? 'c.created_at' : 'r.created_at';
    const sql = comment ? `SELECT c.id,c.report_id AS reportId,c.body,c.status,c.revision,c.created_at AS createdAt,c.reviewed_at AS reviewedAt,c.moderation_note AS moderationNote,COALESCE(u.display_name,'Community member') AS authorDisplayName FROM community_comments c LEFT JOIN community_users u ON u.id=c.user_id` : `SELECT r.id,r.route_id AS routeId,r.category,r.body,r.status,r.revision,r.created_at AS createdAt,r.reviewed_at AS reviewedAt,r.moderation_note AS moderationNote,COALESCE(u.display_name,'Community member') AS authorDisplayName FROM community_reports r LEFT JOIN community_users u ON u.id=r.user_id`;
    const rows = await results(env.COMMUNITY_DB.prepare(`${sql} WHERE ${comment ? 'c' : 'r'}.status=? ${cur ? `AND (${timefield}>? OR (${timefield}=? AND ${idfield}>?))` : ''} ORDER BY ${timefield},${idfield} LIMIT ?`).bind(...(cur ? [status, cur.t, cur.t, cur.id, limit + 1] : [status, limit + 1])));
    const items = rows.slice(0, limit).map(x => ({
      ...x,
      createdAt: iso(x.createdAt),
      reviewedAt: x.reviewedAt ? iso(x.reviewedAt) : null,
      targetType: comment ? 'comment' : 'post'
    }));
    return json({
      items,
      nextCursor: rows.length > limit ? cursorFor(rows[limit - 1]) : null
    });
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
export async function onRequestPatch({
  request,
  env
}) {
  if (!publishing(env)) return fail('PublishingUnavailable', 503);
  if (csrf(request)) return csrf(request);
  const a = await account(request, env);
  if (a.error) return a.error;
  if (!a.user.isModerator) return fail('Forbidden', 403);
  const b = await body(request, 8192),
    v = b.value;
  if (b.error) return b.error;
  if (!['post', 'comment'].includes(v?.targetType) || typeof v.id !== 'string' || !Number.isInteger(v.expectedRevision) || v.expectedRevision < 1 || !['approved', 'rejected', 'hidden'].includes(v.status) || v.note != null && (typeof v.note !== 'string' || v.note.length > 1000)) return fail('InvalidModeration', 400);
  const db = env.COMMUNITY_DB,
    table = v.targetType === 'post' ? 'community_reports' : 'community_comments',
    alias = v.targetType === 'post' ? 'r' : 'c',
    t = Date.now(),
    parentGuard = v.targetType === 'comment' && v.status === 'approved' ? " AND EXISTS(SELECT 1 FROM community_reports p WHERE p.id=c.report_id AND p.status='approved')" : "";
  try {
    if (!(await rate(db, a.user.id, 'moderation', 100))) return fail('RateLimited', 429);
    const audit = db.prepare(`INSERT INTO community_moderation_audit(id,actor_id,target_type,target_id,old_status,new_status,note,created_at) SELECT ?,?,?,?,${alias}.status,?,?,? FROM ${table} ${alias} WHERE ${alias}.id=? AND ${alias}.revision=?${parentGuard}`).bind(id(), a.user.id, v.targetType, v.id, v.status, v.note?.trim() || null, t, v.id, v.expectedRevision);
    const update = db.prepare(`UPDATE ${table} AS ${alias} SET status=?,reviewed_at=?,reviewed_by=?,moderation_note=?,revision=revision+1${v.targetType === 'post' ? ',updated_at=?' : ''} WHERE ${alias}.id=? AND ${alias}.revision=?${parentGuard}`).bind(v.status, t, a.user.id, v.note?.trim() || null, ...(v.targetType === 'post' ? [t] : []), v.id, v.expectedRevision);
    const out = await db.batch([audit, update]);
    if (out?.some(x => x?.success === false)) throw Error('batch');
    if (out?.[0]?.meta?.changes !== 1 || out?.[1]?.meta?.changes !== 1) return fail('Conflict', 409);
    return json({
      ok: true
    });
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
