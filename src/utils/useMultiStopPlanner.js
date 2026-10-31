import { useEffect, useMemo, useRef, useState } from 'react';
import { computePlan } from './transitWorkerClient';
import { buildMultiStopLegs, EMPTY_PLAN, runMultiStopPlans } from './multiStopPlanner';
import { relinkJourney } from './journey';

function relinkPlan(plan, routesById) {
  return {
    ...plan,
    directRoutes: (plan?.directRoutes || []).map(item => relinkJourney(item, routesById)),
    transferRoutes: (plan?.transferRoutes || []).map(item => relinkJourney(item, routesById))
  };
}

export default function useMultiStopPlanner({ points, routes, geometries, stops, vehicleFilter = 'ALL' }) {
  const cacheRef = useRef(new Map());
  const datasetRef = useRef({ routes, geometries, stops });
  const runRef = useRef(0);
  const [results, setResults] = useState({});
  const [retryVersion, setRetryVersion] = useState(0);
  const searchOptions = useMemo(() => ({ vehicle: vehicleFilter, maxWalkMeters: 1200, maxTransferWalkMeters: 600,
    maxTotalWalkMeters: 3600, maxTransfers: 2, networkVersion: 'routing-network-v1' }), [vehicleFilter]);
  const legs = useMemo(() => buildMultiStopLegs(points, searchOptions), [points, searchOptions]);
  const routesById = useMemo(() => new Map((routes || []).map(route => [route.id, route])), [routes]);

  if (datasetRef.current.routes !== routes || datasetRef.current.geometries !== geometries || datasetRef.current.stops !== stops) {
    cacheRef.current.clear();
    datasetRef.current = { routes, geometries, stops };
    runRef.current += 1;
  }

  const currentKeys = new Set(legs.map(leg => leg.key));
  for (const key of cacheRef.current.keys()) if (!currentKeys.has(key)) cacheRef.current.delete(key);
  useEffect(() => {
    setResults(current => Object.fromEntries(Object.entries(current).filter(([key]) => currentKeys.has(key))));
  }, [legs.map(leg => leg.key).join('|')]);

  useEffect(() => {
    const runId = ++runRef.current;
    let cancelled = false;
    const controller = new AbortController();
    const currentLegs = buildMultiStopLegs(points, searchOptions);
    const validKeys = new Set(currentLegs.map(leg => leg.key));
    if (!routes?.length) {
      setResults(current => Object.fromEntries(currentLegs.map(leg => [leg.key, leg.status === 'incomplete' || leg.status === 'same-point' ? leg : { ...leg, status: 'loading' }])));
      return () => { cancelled = true; };
    }
    setResults(current => {
      const next = {};
      for (const leg of currentLegs) {
        if (leg.status === 'incomplete' || leg.status === 'same-point') next[leg.key] = leg;
        else if (cacheRef.current.has(leg.key)) next[leg.key] = { ...leg, status: 'ready', plan: relinkPlan(cacheRef.current.get(leg.key), routesById), error: null };
        else next[leg.key] = { ...leg, status: 'loading', plan: null, error: null };
      }
      return next;
    });
    runMultiStopPlans(currentLegs, { routes, geometries, stops }, {
      cache: cacheRef.current,
      options: searchOptions,
      compute: (origin, destination, data, maxWalk, options) => computePlan(origin, destination, data, maxWalk,
        { ...options, signal: controller.signal }),
      isCancelled: () => cancelled || runRef.current !== runId,
      onResult: result => {
        if (cancelled || runRef.current !== runId || !validKeys.has(result.key)) return;
        setResults(current => ({ ...current, [result.key]: {
          ...result,
          plan: result.plan ? relinkPlan(result.plan, routesById) : EMPTY_PLAN
        } }));
      }
    });
    return () => { cancelled = true; controller.abort(); };
  }, [points, routes, geometries, stops, routesById, searchOptions, retryVersion]);

  const visibleLegs = legs.map(leg => {
    const result = results[leg.key];
    if (!result) return leg;
    return { ...result, ...leg, status: result.status, plan: result.plan, error: result.error };
  });
  return { legs: visibleLegs, retry: () => {
    for (const leg of legs) if (results[leg.key]?.status === 'error') cacheRef.current.delete(leg.key);
    setRetryVersion(value => value + 1);
  } };
}
