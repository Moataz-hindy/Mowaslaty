import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { resolveExperience } from './utils/experienceEntry.js';
import LandingPage from './components/LandingPage.jsx';
import AuthCallback from './components/AuthCallback.jsx';

const Planner = lazy(() => import('./App.jsx'));
const NativeAppBridge = Capacitor.isNativePlatform()
  ? lazy(() => import('./components/NativeAppBridge.jsx'))
  : null;

export default function AppEntry() {
  const isNative = Capacitor.isNativePlatform();
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const experience = resolveExperience(pathname, isNative);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openPlanner = event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const target = new URL(event.currentTarget.href, window.location.origin);
    const destination = `${target.pathname}${target.search}${target.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== destination) window.history.pushState({}, '', destination);
    setPathname(window.location.pathname);
    window.scrollTo(0, 0);
  };

  if (!isNative && pathname === '/auth/callback') return <AuthCallback />;
  return (
    <Suspense fallback={<div className="entry-loading" role="status" aria-live="polite">جارٍ تحميل مخطط الرحلات…</div>}>
      {isNative && NativeAppBridge && <NativeAppBridge />}
      {experience === 'landing' ? <LandingPage onOpenPlanner={openPlanner} isNative={isNative} /> : <Planner />}
    </Suspense>
  );
}
