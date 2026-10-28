export class CommunityApiError extends Error {
  constructor(code, status = 0) { super(code || 'unavailable'); this.name = 'CommunityApiError'; this.code = code || 'unavailable'; this.status = status; }
}

export async function request(path, { token, method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`/api/community${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal, cache: 'no-store' });
  } catch { throw new CommunityApiError('unavailable'); }
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new CommunityApiError('unavailable', response.status);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new CommunityApiError(payload?.code, response.status);
  return payload;
}

export async function currentToken(client) {
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.access_token || null;
}
