import { account, body, csrf, fail, iso, json, publishing, rate, validPost } from '../_shared.js';
import { containsBlockedArabicWord } from '../_content-filter.js';
export async function onRequestPatch({
  request,
  env,
  params
}) {
  if (!publishing(env)) return fail('PublishingUnavailable', 503);
  if (csrf(request)) return csrf(request);
  const a = await account(request, env);
  if (a.error) return a.error;
  const b = await body(request, 16384);
  if (b.error) return b.error;
  if (!validPost(b.value)) return fail('InvalidPost', 400);
  if (!a.user.displayName?.trim()) return fail('DisplayNameRequired', 409);
  const db = env.COMMUNITY_DB,
    t = Date.now();
  try {
    if (!(await rate(db, a.user.id, 'post-edit', 12))) return fail('RateLimited', 429);
    if (containsBlockedArabicWord(a.user.displayName) || containsBlockedArabicWord(b.value.body)) return fail('ContentBlocked', 400);
    const r = await db.prepare("UPDATE community_reports SET route_id=?,category=?,body=?,status='approved',updated_at=?,reviewed_at=?,reviewed_by=NULL,moderation_note=NULL,revision=revision+1 WHERE id=? AND user_id=? AND status!='hidden'").bind(b.value.routeId, b.value.category, b.value.body.trim(), t, t, params.id, a.user.id).run();
    if (!r.meta?.changes) return fail('NotFound', 404);
    const saved = await db.prepare('SELECT created_at AS createdAt FROM community_reports WHERE id=?').bind(params.id).first();
    return json({
      post: {
        id: params.id,
        ...b.value,
        body: b.value.body.trim(),
        createdAt: iso(saved.createdAt),
        authorDisplayName: a.user.displayName || 'Community member',
        status: 'approved'
      }
    });
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
export async function onRequestDelete({
  request,
  env,
  params
}) {
  if (!publishing(env)) return fail('PublishingUnavailable', 503);
  if (csrf(request)) return csrf(request);
  const a = await account(request, env);
  if (a.error) return a.error;
  try {
    const r = await env.COMMUNITY_DB.prepare("UPDATE community_reports SET status='hidden',updated_at=?,revision=revision+1 WHERE id=? AND user_id=? AND status!='hidden'").bind(Date.now(), params.id, a.user.id).run();
    return r.meta?.changes ? json({
      ok: true
    }) : fail('NotFound', 404);
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
