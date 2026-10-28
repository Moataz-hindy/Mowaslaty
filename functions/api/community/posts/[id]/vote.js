import { account, body, csrf, fail, json, publishing, rate, run } from '../../_shared.js';
export async function onRequestGet({
  request,
  env,
  params
}) {
  if (!publishing(env)) return fail('CommunityUnavailable', 503);
  const a = await account(request, env);
  if (a.error) return a.error;
  try {
    const parent = await env.COMMUNITY_DB.prepare("SELECT id FROM community_reports WHERE id=? AND status='approved'").bind(params.id).first();
    if (!parent) return fail('NotFound', 404);
    const v = await env.COMMUNITY_DB.prepare('SELECT value FROM community_votes WHERE report_id=? AND user_id=?').bind(params.id, a.user.id).first();
    const s = await env.COMMUNITY_DB.prepare('SELECT COALESCE(sum(value),0) AS score FROM community_votes WHERE report_id=?').bind(params.id).first();
    return json({
      value: v?.value || 0,
      voteScore: s?.score || 0
    });
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
export async function onRequestPut({
  request,
  env,
  params
}) {
  if (!publishing(env)) return fail('PublishingUnavailable', 503);
  if (csrf(request)) return csrf(request);
  const a = await account(request, env);
  if (a.error) return a.error;
  const parsed = await body(request, 256);
  if (parsed.error) return parsed.error;
  const b = parsed.value;
  if (![-1, 0, 1].includes(b?.value)) return fail('InvalidVote', 400);
  const db = env.COMMUNITY_DB;
  try {
    if (!(await rate(db, a.user.id, 'vote', 120))) return fail('RateLimited', 429);
    if (b.value === 0) {
      await run(db.prepare("DELETE FROM community_votes WHERE report_id=? AND user_id=? AND EXISTS (SELECT 1 FROM community_reports WHERE id=? AND status='approved')").bind(params.id, a.user.id, params.id));
    } else {
      await run(db.prepare("INSERT INTO community_votes(report_id,user_id,value) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM community_reports WHERE id=? AND status='approved') ON CONFLICT(report_id,user_id) DO UPDATE SET value=excluded.value,updated_at=? WHERE EXISTS (SELECT 1 FROM community_reports WHERE id=? AND status='approved')").bind(params.id, a.user.id, b.value, params.id, Date.now(), params.id));
    }
    const parent = await db.prepare("SELECT id FROM community_reports WHERE id=? AND status='approved'").bind(params.id).first();
    if (!parent) return fail('NotFound', 404);
    const s = await db.prepare('SELECT COALESCE(sum(value),0) AS score FROM community_votes WHERE report_id=?').bind(params.id).first();
    return json({
      voteScore: s?.score || 0,
      value: b.value
    });
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
