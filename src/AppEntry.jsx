import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { resolveExperience } from './utils/experienceEntry.js';
import LandingPage from './components/LandingPage.jsx';

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
    if (isNative || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (window.location.pathname !== '/app' && window.location.pathname !== '/app/') {
      window.history.pushState({}, '', '/app');
    }
    setPathname(window.location.pathname);
    window.scrollTo(0, 0);
  };

  if (experience === 'landing') return <LandingPage onOpenPlanner={openPlanner} />;
  return (
    <Suspense fallback={<div className="entry-loading" role="status" aria-live="polite">جارٍ تحميل مخطط الرحلات…</div>}>
      {isNative && NativeAppBridge && <NativeAppBridge />}
      <Planner />
    </Suspense>
  );
}
