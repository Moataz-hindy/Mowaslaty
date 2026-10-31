import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { PUBLIC_SERVICE_ORIGIN } from './publicServiceFetch';

// Native HTTP avoids the WebView asset origin; only this fixed endpoint is used.
export async function sendFeedback(payload) {
  const headers = { 'content-type': 'application/json', Accept: 'application/json' };
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({ url: `${PUBLIC_SERVICE_ORIGIN}/api/feedback`,
      headers, data: payload, connectTimeout: 15000, readTimeout: 15000 });
    if (response.status < 200 || response.status >= 300 || response.data?.sent !== true) throw new Error('DeliveryUnavailable');
    return;
  }
  const response = await fetch('/api/feedback', { method: 'POST', headers,
    body: JSON.stringify(payload), signal: AbortSignal.timeout(15000), cache: 'no-store' });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.sent !== true) throw new Error('DeliveryUnavailable');
}
