// Cloudflare Pages Function: GET /api/expand?url=<google maps short link>
// Follows the redirects of a maps.app.goo.gl / goo.gl/maps link and returns
// the final URL plus coordinates when they can be found.
// Only Google Maps hosts are allowed, so this cannot be used as an open proxy.

import { boundedText, serviceBudget, serviceJson as json } from '../_service-security.js';

const GOOGLE_DOMAINS = ['google.com', 'google.com.eg', 'google.co.uk', 'google.de', 'google.fr', 'google.ae', 'google.com.sa'];
const ALLOWED_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl',
  ...GOOGLE_DOMAINS.flatMap(host => [host, `www.${host}`, `maps.${host}`])]);
const allowed = url => url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname)
  && !url.username && !url.password && !url.port;
const decoded = value => { try { return decodeURIComponent(value); } catch { return value; } };

const COORD_PATTERNS = [
  /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,              // .../@30.0444,31.2357,17z
  /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,          // ...!3d30.04!4d31.23
  /[?&](?:q|ll|query|center|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i
];

function findCoord(text) {
  for (const re of COORD_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return [lat, lng];
      }
    }
  }
  return null;
}

export async function onRequestGet({ request, env }) {
  const input = new URL(request.url).searchParams.get('url');
  if (!input || input.length > 4096) return json({ error: 'invalid_url' }, 400);
  let current;
  try {
    current = new URL(input);
  } catch {
    return json({ error: 'invalid_url' }, 400);
  }
  if (!allowed(current)) {
    return json({ error: 'host_not_allowed' }, 400);
  }

  const denied = await serviceBudget(request, env, 'expand');
  if (denied) return denied;
  // One deadline covers the complete chain, including response streaming.
  const signal = AbortSignal.timeout(8000);
  try {
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(current.toString(), { signal, redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (Mowaslaty link expander)' } });
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        const next = new URL(location, current);
        if (!allowed(next) || next.href.length > 4096) return json({ error: 'host_not_allowed' }, 400);
        current = next;
        const coord = findCoord(decoded(current.toString()));
        if (coord) return json({ url: current.toString(), coord });
        continue;
      }
      // Final page: look for coordinates in the URL, then bounded HTML.
      let coord = findCoord(decoded(current.toString()));
      if (!coord && res.ok) {
        const html = await boundedText(res, 300000);
        coord = findCoord(html);
      } else await res.body?.cancel();
      return json({ url: current.toString(), coord });
    }
    return json({ error: 'too_many_redirects' }, 502);
  } catch { return json({ error: 'upstream_unavailable' }, 502); }
}
