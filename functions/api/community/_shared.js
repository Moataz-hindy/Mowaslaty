import { createClient } from '@supabase/supabase-js';
import routeIds from './_route-ids.js';
export const categories = ['fare', 'detour', 'frequency', 'tip', 'route'];
const routes = new Set(routeIds);
export const routeIdsJson = JSON.stringify(routeIds);
export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});
export const fail = (code, status) => json({
  code
}, status);
export const id = () => crypto.randomUUID();
export const now = () => Date.now();
export const iso = value => new Date(Number(value)).toISOString();
export const dbOf = env => env?.COMMUNITY_DB;
export const publishing = env => env?.COMMUNITY_PUBLISHING_ENABLED === 'true' && Boolean(config(env)) && Boolean(dbOf(env));
export function config(env) {
  try {
    const url = new URL(env?.SUPABASE_URL || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(env?.SUPABASE_PUBLISHABLE_KEY || '') || env?.COMMUNITY_GOOGLE_ENABLED !== 'true') return null;
    return {
      url: url.origin,
      key: env.SUPABASE_PUBLISHABLE_KEY
    };
  } catch {
    return null;
  }
}
export async function identity(request, env) {
  const cfg = config(env),
    header = request.headers.get('authorization') || '';
  if (!cfg || !/^Bearer\s+\S+$/i.test(header)) return {
    error: fail('AuthenticationRequired', 401)
  };
  try {
    const client = createClient(cfg.url, cfg.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    const {
      data,
      error
    } = await client.auth.getUser(header.replace(/^Bearer\s+/i, ''));
    if (error || !data?.user?.id) return {
      error: fail('InvalidIdentity', 401)
    };
    return {
      subject: `${cfg.url}|${data.user.id}`
    };
  } catch {
    return {
      error: fail('InvalidIdentity', 401)
    };
  }
}
export async function account(request, env) {
  const auth = await identity(request, env);
  if (auth.error) return auth;
  const db = dbOf(env);
  if (!db || !publishing(env)) return {
    error: fail('CommunityUnavailable', 503)
  };
  try {
    await db.prepare('INSERT INTO community_users(id,auth_subject) VALUES(?,?) ON CONFLICT(auth_subject) DO NOTHING').bind(id(), auth.subject).run();
    const q = await db.prepare('SELECT id,display_name AS displayName,is_moderator AS isModerator,banned_at AS bannedAt FROM community_users WHERE auth_subject=?').bind(auth.subject).first();
    if (!q || q.bannedAt) return {
      error: fail('Forbidden', 403)
    };
    return {
      ...auth,
      user: q
    };
  } catch {
    return {
      error: fail('CommunityUnavailable', 503)
    };
  }
}
export function method(request, allowed) {
  return allowed.includes(request.method) ? null : fail('MethodNotAllowed', 405);
}
export function csrf(request) {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  try {
    return new URL(origin).origin !== new URL(request.url).origin ? fail('OriginMismatch', 403) : null;
  } catch {
    return fail('OriginMismatch', 403);
  }
}
export async function body(request, max = 16384) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > max) return {
    error: fail('PayloadTooLarge', 413)
  };
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return {
    error: fail('InvalidBody', 400)
  };
  try {
    const reader = request.body?.getReader();
    if (!reader) return {
      error: fail('InvalidBody', 400)
    };
    const decoder = new TextDecoder(),
      parts = [];
    let size = 0;
    while (true) {
      const {
        done,
        value
      } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        return {
          error: fail('PayloadTooLarge', 413)
        };
      }
      parts.push(decoder.decode(value, {
        stream: true
      }));
    }
    const value = JSON.parse(parts.join('') + decoder.decode());
    if (!value || Array.isArray(value) || typeof value !== 'object') return {
      error: fail('InvalidBody', 400)
    };
    return {
      value
    };
  } catch {
    return {
      error: fail('InvalidBody', 400)
    };
  }
}
export function validPost(input) {
  return input && typeof input.routeId === 'string' && routes.has(input.routeId) && categories.includes(input.category) && typeof input.body === 'string' && input.body.trim().length > 0 && input.body.length <= 2000;
}
export const isAllowedRoute = routeId => routes.has(routeId);
export function validText(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
export async function rate(db, userId, action, limit, windowMs = 3600000) {
  const t = now(),
    cutoff = t - windowMs;
  const result = await db.prepare(`INSERT INTO community_rate_limits(user_id,action,window_started,count) VALUES(?,?,?,1) ON CONFLICT(user_id,action) DO UPDATE SET window_started=CASE WHEN window_started<=? THEN excluded.window_started ELSE window_started END,count=CASE WHEN window_started<=? THEN 1 ELSE count+1 END WHERE window_started<=? OR count<?`).bind(userId, action, t, cutoff, cutoff, cutoff, limit).run();
  return result?.success === true && result?.meta?.changes === 1;
}
export const cursorParam = value => {
  if (!value) return null;
  try {
    const x = JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)));
    if (!Number.isSafeInteger(x.t) || typeof x.id !== 'string' || !x.id || x.id.length > 128) return null;
    return x;
  } catch {
    return null;
  }
};
export const cursorFor = row => btoa(JSON.stringify({
  t: Number(row.createdAt),
  id: row.id
})).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
export function paging(url) {
  const p = url.searchParams,
    limit = Number(p.get('limit') || 20),
    cursor = p.get('cursor');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || cursor && cursor.length > 256) throw new Error('paging');
  const c = cursor ? cursorParam(cursor) : null;
  if (cursor && !c) throw new Error('paging');
  return {
    limit,
    cursor: c
  };
}
export async function results(query) {
  const r = await query.all();
  if (r?.success === false || !Array.isArray(r.results)) throw new Error('db');
  return r.results;
}
export async function run(query) {
  const r = await query.run();
  if (r?.success === false) throw new Error('db');
  return r;
}
export const postSelect = `SELECT r.id,r.route_id AS routeId,r.category,r.body,r.created_at AS createdAt,COALESCE(NULLIF(trim(u.display_name),''),'Community member') AS authorDisplayName,(SELECT COALESCE(sum(value),0) FROM community_votes v WHERE v.report_id=r.id) AS voteScore,(SELECT count(*) FROM community_comments c WHERE c.report_id=r.id AND c.status='approved') AS commentCount`;
