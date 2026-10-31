export const serviceJson = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});

// Atomic D1 counters protect upstream quotas across isolates and datacentres.
// Keep a hard global daily budget as well as an hourly budget per client.
const LIMITS = { walk: [60, 1000], expand: [30, 1000], feedback: [5, 100] };
export async function serviceBudget(request, env, action) {
  const ip = request.headers.get('CF-Connecting-IP'); // set by Cloudflare, not X-Forwarded-For
  const db = env?.COMMUNITY_DB;
  const secret = env?.SERVICE_RATE_SECRET;
  if (!db || typeof secret !== 'string' || secret.length < 32 || !ip || !LIMITS[action]) {
    return serviceJson({ code: 'ProtectionUnavailable' }, 503);
  }
  try {
    const now = Date.now(), hour = Math.floor(now / 3600000) * 3600000;
    const day = Math.floor(now / 86400000) * 86400000;
    // Prune even when a budget is exhausted. No raw addresses are retained.
    const cleanup = await db.prepare('DELETE FROM service_rate_limits WHERE expires_at<?').bind(now).run();
    if (cleanup?.success !== true) throw new Error('cleanup');
    // After the daily cap, do not create more client rows for rotating addresses.
    const global = await db.prepare('SELECT window_started,count FROM service_rate_limits WHERE key=?').bind(`${action}:global`).first();
    if (global?.window_started === day && global.count >= LIMITS[action][1]) {
      return serviceJson({ code: 'RateLimited' }, 429, { 'retry-after': String(Math.ceil((day + 86400000 - now) / 1000)) });
    }
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${action}:${hour}:${ip}`));
    const digest = Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
    const reserve = async (counter, start, limit, expires) => {
      const result = await db.prepare(`INSERT INTO service_rate_limits(key,window_started,count,expires_at)
        VALUES(?,?,1,?) ON CONFLICT(key) DO UPDATE SET
        count=CASE WHEN window_started<excluded.window_started THEN 1 ELSE count+1 END,
        window_started=excluded.window_started,expires_at=excluded.expires_at
        WHERE window_started<excluded.window_started OR count<?`)
        .bind(counter, start, expires, limit).run();
      if (result?.success !== true) throw new Error('budget');
      return result.meta?.changes === 1;
    };
    if (!await reserve(`${action}:${digest}`, hour, LIMITS[action][0], hour + 7200000)) {
      return serviceJson({ code: 'RateLimited' }, 429, { 'retry-after': String(Math.ceil((hour + 3600000 - now) / 1000)) });
    }
    if (!await reserve(`${action}:global`, day, LIMITS[action][1], day + 172800000)) {
      return serviceJson({ code: 'RateLimited' }, 429, { 'retry-after': String(Math.ceil((day + 86400000 - now) / 1000)) });
    }
    return null;
  } catch {
    // Missing migration or unavailable storage must never allow paid requests.
    return serviceJson({ code: 'ProtectionUnavailable' }, 503);
  }
}

export async function boundedText(response, maxBytes, timeoutMs = 8000) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytes = 0, text = '';
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ReadTimeout')), timeoutMs); });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline]);
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('PayloadTooLarge');
      text += decoder.decode(value, { stream: true });
    }
  } finally { clearTimeout(timer); await reader.cancel().catch(() => {}); }
}
