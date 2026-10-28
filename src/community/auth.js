let clientPromise;
const callbackExchanges = new WeakMap();
const latestCallbackExchange = new WeakMap();
const capturedCallbacks = new WeakMap();

export function getAuthClient(config) {
  if (!config?.url || !config?.publishableKey || !config?.publishableKey.startsWith('sb_publishable_') || config.provider !== 'google') {
    return Promise.resolve(null);
  }
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(config.url, config.publishableKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })).catch(error => { clientPromise = null; throw error; });
  }
  return clientPromise;
}

export async function signInWithGoogle(client) {
  return client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
}

export function captureAuthCallback(location = window.location, history = window.history) {
  if (capturedCallbacks.has(location)) return capturedCallbacks.get(location);
  const url = new URL(location.href);
  if (url.search) history.replaceState(history.state, '', `${url.pathname}${url.hash}`);
  const captured = { code: url.searchParams.get('code'), error: url.searchParams.get('error_description') || url.searchParams.get('error') };
  capturedCallbacks.set(location, captured);
  return captured;
}

export function exchangeAuthCallback(client, location = window.location, history = window.history) {
  const { code, error } = captureAuthCallback(location, history);
  if (!code) return latestCallbackExchange.get(client) || Promise.resolve({ error: error ? new Error(error) : null, exchanged: false });
  if (!callbackExchanges.has(client)) callbackExchanges.set(client, new Map());
  if (callbackExchanges.get(client).has(code)) return callbackExchanges.get(client).get(code);
  const exchange = Promise.resolve().then(() => client.auth.exchangeCodeForSession(code))
    .then(result => ({ ...result, exchanged: true }));
  callbackExchanges.get(client).set(code, exchange);
  latestCallbackExchange.set(client, exchange);
  return exchange;
}
