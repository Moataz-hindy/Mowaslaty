import React, { useEffect, useState } from 'react';
import { loadRoutes } from '../utils/dataLoader.js';
import CommunityHub from './CommunityHub.jsx';

export default function HomeCommunity({ onOpenPlanner }) {
  const [state, setState] = useState({ status: 'loading', routes: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState(current => ({ ...current, status: 'loading' }));
    loadRoutes().then(routes => {
      if (!cancelled) setState({ status: 'ready', routes });
    }).catch(() => {
      if (!cancelled) setState(current => ({ ...current, status: 'error' }));
    });
    return () => { cancelled = true; };
  }, [attempt]);

  return <>
    {state.status === 'loading' && <p className="directory-message" role="status">جارٍ تحميل المسارات للمجتمع…</p>}
    {state.status === 'error' && <div className="directory-message" role="alert">تعذر تحميل المسارات. <button type="button" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</button></div>}
    <CommunityHub routes={state.routes} lang="ar" onOpenPlanner={onOpenPlanner} variant="page" />
  </>;
}
