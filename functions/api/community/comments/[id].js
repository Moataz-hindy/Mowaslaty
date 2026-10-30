import { account, body, csrf, fail, iso, json, publishing, rate, run, validText } from '../_shared.js';
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
  const b = await body(request, 8192);
  if (b.error) return b.error;
  if (!validText(b.value?.body, 1000)) return fail('InvalidComment', 400);
  if (!a.user.displayName?.trim()) return fail('DisplayNameRequired', 409);
  try {
    if (!(await rate(env.COMMUNITY_DB, a.user.id, 'comment-edit', 12))) return fail('RateLimited', 429);
    if (containsBlockedArabicWord(a.user.displayName) || containsBlockedArabicWord(b.value.body)) return fail('ContentBlocked', 400);
    const r = await env.COMMUNITY_DB.prepare("UPDATE community_comments SET body=?,status='approved',reviewed_at=?,reviewed_by=NULL,moderation_note=NULL,revision=revision+1 WHERE id=? AND user_id=? AND status!='hidden'").bind(b.value.body.trim(), Date.now(), params.id, a.user.id).run();
    if (!r.meta?.changes) return fail('NotFound', 404);
    const saved = await env.COMMUNITY_DB.prepare('SELECT report_id AS reportId,created_at AS createdAt FROM community_comments WHERE id=?').bind(params.id).first();
    return json({
      comment: {
        id: params.id,
        reportId: saved.reportId,
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
    const r = await env.COMMUNITY_DB.prepare("UPDATE community_comments SET status='hidden',revision=revision+1 WHERE id=? AND user_id=? AND status!='hidden'").bind(params.id, a.user.id).run();
    return r.meta?.changes ? json({
      ok: true
    }) : fail('NotFound', 404);
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
