// Cloudflare Pages Function: GET /api/expand?url=<google maps short link>
// Follows the redirects of a maps.app.goo.gl / goo.gl/maps link and returns
// the final URL plus coordinates when they can be found.
// Only Google Maps hosts are allowed, so this cannot be used as an open proxy.

const ALLOWED_HOST = /^(maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+)$/i;

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

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' }
  });

export async function onRequestGet({ request }) {
  const input = new URL(request.url).searchParams.get('url');
  let current;
  try {
    current = new URL(input);
  } catch {
    return json({ error: 'invalid_url' }, 400);
  }
  if (current.protocol !== 'https:' || !ALLOWED_HOST.test(current.hostname)) {
    return json({ error: 'host_not_allowed' }, 400);
  }

  // Follow up to 6 redirects manually, re-checking the host each hop
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(current.toString(), { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (Mowaslaty link expander)' } });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      const next = new URL(location, current);
      if (!ALLOWED_HOST.test(next.hostname)) break;
      current = next;
      const coord = findCoord(decodeURIComponent(current.toString()));
      if (coord) return json({ url: current.toString(), coord });
      continue;
    }
    // Final page: look for coordinates in the URL, then in the first part of the HTML
    let coord = findCoord(decodeURIComponent(current.toString()));
    if (!coord && res.ok) {
      const html = (await res.text()).slice(0, 300000);
      coord = findCoord(html);
    }
    return json({ url: current.toString(), coord });
  }
  return json({ url: current.toString(), coord: findCoord(decodeURIComponent(current.toString())) });
}
