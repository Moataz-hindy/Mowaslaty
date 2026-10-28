import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const PUBLIC_SERVICE_ORIGIN = 'https://mowaslaty.pages.dev';
const ALLOWED_PATHS = new Set(['/api/expand', '/api/walk']);

function resolvePublicServiceUrl(input) {
  if (typeof input !== 'string' || input.includes('#')) {
    throw new TypeError('Invalid public service URL');
  }
  const rawPath = input.split(/[?#]/, 1)[0];
  if (rawPath.split('/').some((segment) => segment === '.' || segment === '..' || /%2e/i.test(segment))) {
    throw new TypeError('Public service URL path is not allowed');
  }
  let url;
  try {
    url = new URL(input, PUBLIC_SERVICE_ORIGIN);
  } catch {
    throw new TypeError('Invalid public service URL');
  }
  if (url.protocol !== 'https:' || url.origin !== PUBLIC_SERVICE_ORIGIN || url.username || url.password || !ALLOWED_PATHS.has(url.pathname)) {
    throw new TypeError('Public service URL is not allowed');
  }
  return url;
}

/** Fetch one of the planner's public Pages Functions, keeping browser requests same-origin. */
export async function fetchPublicService(input, options = {}, dependencies = {}) {
  const isNative = dependencies.isNative ?? Capacitor.isNativePlatform();
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  const http = dependencies.http ?? CapacitorHttp;
  if (!isNative) return fetchImpl(input, options);

  const url = resolvePublicServiceUrl(input);
  const timeoutMs = dependencies.timeoutMs ?? 6000;
  const signal = options.signal;
  if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError');

  let timeoutId;
  let abortListener;
  const aborted = new Promise((_, reject) => {
    abortListener = () => reject(new DOMException('The operation was aborted', 'AbortError'));
    signal?.addEventListener('abort', abortListener, { once: true });
    timeoutId = setTimeout(() => reject(new DOMException('The operation timed out', 'AbortError')), timeoutMs);
  });

  try {
    // CapacitorHttp bypasses the WebView asset origin and does not require CORS.
    const result = await Promise.race([
      http.get({ url: url.href, connectTimeout: timeoutMs, readTimeout: timeoutMs }),
      aborted
    ]);
    const headers = new Headers(result.headers ?? {});
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      headers: { get: (name) => headers.get(name) },
      json: async () => result.data
    };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortListener);
  }
}
