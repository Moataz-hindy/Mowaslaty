import { account, body, csrf, fail, json, publishing, run } from './_shared.js';
import { containsBlockedArabicWord } from './_content-filter.js';
export async function onRequestGet({
  request,
  env
}) {
  if (!publishing(env)) return fail('CommunityUnavailable', 503);
  const a = await account(request, env);
  if (a.error) return a.error;
  return json({
    user: {
      id: a.user.id,
      displayName: a.user.displayName,
      isModerator: Boolean(a.user.isModerator)
    }
  });
}
export async function onRequestPatch({
  request,
  env
}) {
  if (!publishing(env)) return fail('PublishingUnavailable', 503);
  if (csrf(request)) return csrf(request);
  const a = await account(request, env);
  if (a.error) return a.error;
  const b = await body(request, 512);
  if (b.error) return b.error;
  if (typeof b.value?.displayName !== 'string' || b.value.displayName.trim().length < 2 || b.value.displayName.trim().length > 80) return fail('InvalidDisplayName', 400);
  if (containsBlockedArabicWord(b.value.displayName)) return fail('ContentBlocked', 400);
  try {
    await run(env.COMMUNITY_DB.prepare('UPDATE community_users SET display_name=? WHERE id=?').bind(b.value.displayName.trim(), a.user.id));
    return json({
      user: {
        id: a.user.id,
        displayName: b.value.displayName.trim(),
        isModerator: Boolean(a.user.isModerator)
      }
    });
  } catch {
    return fail('CommunityUnavailable', 503);
  }
}
