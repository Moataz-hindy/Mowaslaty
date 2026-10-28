import { account, fail, json, publishing, results, iso, isAllowedRoute } from './_shared.js';
export async function onRequestGet({
  request,
  env
}) {
  if (!publishing(env)) return fail('CommunityUnavailable', 503);
  const a = await account(request, env);
  if (a.error) return a.error;
  try {
    const posts = await results(env.COMMUNITY_DB.prepare("SELECT r.id,r.route_id AS routeId,r.category,r.body,r.status,r.created_at AS createdAt,COALESCE(NULLIF(trim(u.display_name),''),'Community member') AS authorDisplayName,(SELECT COALESCE(sum(v.value),0) FROM community_votes v WHERE v.report_id=r.id) AS voteScore,(SELECT count(*) FROM community_comments c WHERE c.report_id=r.id AND c.status='approved') AS commentCount FROM community_reports r JOIN community_users u ON u.id=r.user_id WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT 100").bind(a.user.id));
    const comments = await results(env.COMMUNITY_DB.prepare("SELECT c.id,c.report_id AS reportId,c.body,c.status,c.created_at AS createdAt,COALESCE(NULLIF(trim(u.display_name),''),'Community member') AS authorDisplayName FROM community_comments c LEFT JOIN community_users u ON u.id=c.user_id WHERE c.user_id=? ORDER BY c.created_at DESC LIMIT 100").bind(a.user.id));
    return json({
      posts: posts.filter(x => isAllowedRoute(x.routeId)).map(x => ({
        ...x,
        createdAt: iso(x.createdAt)
      })),
      comments: comments.map(x => ({
        ...x,
        createdAt: iso(x.createdAt)
      }))
    });
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
