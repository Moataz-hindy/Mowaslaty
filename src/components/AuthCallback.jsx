import React, { useEffect, useState } from 'react';
import { getAuthClient, exchangeAuthCallback, captureAuthCallback } from '../community/auth.js';
import { request } from '../community/api.js';

export default function AuthCallback() {
  const [message, setMessage] = useState('جارٍ إكمال تسجيل الدخول…');
  useEffect(() => {
    let active = true;
    captureAuthCallback();
    (async () => {
      try {
        const capabilities = await request('/capabilities');
        const client = await getAuthClient(capabilities.auth);
        if (!client) throw new Error('auth-unavailable');
        const result = await exchangeAuthCallback(client);
        if (result.error) throw result.error;
        if (!result.exchanged) throw new Error('missing-code');
        window.location.replace('/#community');
      } catch {
        if (active) setMessage('تعذر إكمال تسجيل الدخول. ارجع إلى المجتمع وحاول مرة أخرى.');
      }
    })();
    return () => { active = false; };
  }, []);
  return <main className="community-callback" dir="rtl"><p role="status">{message}</p><a href="/#community">العودة إلى المجتمع</a></main>;
}
