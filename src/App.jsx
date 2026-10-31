import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import RouteDrawer from './components/RouteDrawer';
import MapSearchBar from './components/MapSearchBar';
import { I18N } from './utils/i18n';
import { normalizeText, findNearestDropPoints, calculateRouteDropPoint } from './utils/geoUtils';
import { expandSearchQuery, routeMatchesTokens } from './utils/transitAliases';
import { loadRoutes, loadGeometries, loadStops } from './utils/dataLoader';
import { computeNearest, computePlan } from './utils/transitWorkerClient';
import { MapPin, LocateFixed, X } from 'lucide-react';
import { useGeolocation } from './utils/useGeolocation';
import { buildTrack, updateTrack } from './utils/tripTracker';
import TripTracker from './components/TripTracker';
import useMultiStopPlanner from './utils/useMultiStopPlanner';
import { buildMultiStopLegs, filterMultiStopPlan, journeyOptionKey } from './utils/multiStopPlanner';
import { rideLegs } from './utils/journey';
import { resolveExactRoute, routeIdFromSearch } from './utils/routeDeepLink.js';


export default function App() {
  const [routes, setRoutes] = useState([]);
  const [brtUnavailable, setBrtUnavailable] = useState(false);
  const [geometries, setGeometries] = useState(null);
  const [stops, setStops] = useState([]);
  const [activeTab, setActiveTab] = useState('explore');
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('ALL');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [deepLinkRouteId, setDeepLinkRouteId] = useState(() => routeIdFromSearch(window.location.search));
  const appliedDeepLinkRouteId = useRef(null);

  useEffect(() => {
    const onPopState = () => setDeepLinkRouteId(routeIdFromSearch(window.location.search));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!deepLinkRouteId) {
      if (appliedDeepLinkRouteId.current) {
        const previousId = appliedDeepLinkRouteId.current;
        setSelectedRoute(current => current?.id === previousId ? null : current);
        appliedDeepLinkRouteId.current = null;
      }
      return;
    }

    const exactRoute = resolveExactRoute(routes, deepLinkRouteId);
    if (!exactRoute) {
      if (appliedDeepLinkRouteId.current) {
        const previousId = appliedDeepLinkRouteId.current;
        setSelectedRoute(current => current?.id === previousId ? null : current);
        appliedDeepLinkRouteId.current = null;
      }
      return;
    }
    setSelectedRoute(exactRoute);
    setActiveTab('explore');
    appliedDeepLinkRouteId.current = exactRoute.id;
  }, [deepLinkRouteId, routes]);
  
  // Phase 2 state (Nearest Drop & Specific Line Drop)
  // Live location ("موقعي")
  const geo = useGeolocation();
  const centerOnNextFix = React.useRef(false);
  const [geoNotice, setGeoNotice] = useState(null);
  const handleLocate = () => {
    if (geo.coord) {
      setFlyToRequest(prev => ({ coord: geo.coord, n: (prev?.n || 0) + 1 }));
    } else {
      centerOnNextFix.current = true;
    }
    geo.start();
  };
  useEffect(() => {
    if (geo.coord && centerOnNextFix.current) {
      centerOnNextFix.current = false;
      setFlyToRequest(prev => ({ coord: geo.coord, n: (prev?.n || 0) + 1 }));
    }
  }, [geo.coord]);
  useEffect(() => {
    if (geo.status === 'denied') setGeoNotice('denied');
    else if (geo.status === 'unsupported') setGeoNotice('unsupported');
    else if (geo.status === 'unavailable') setGeoNotice('unavailable');
    else if (geo.status === 'active') setGeoNotice(null);
  }, [geo.status]);

  const [targetCoord, setTargetCoord] = useState(null);
  const [targetLabel, setTargetLabel] = useState(null);   // place name, when known
  const [nearestVehicleFilter, setNearestVehicleFilter] = useState('ALL');
  const [flyToRequest, setFlyToRequest] = useState(null); // { coord, n }
  const clearTarget = () => {
    setTargetCoord(null);
    setTargetLabel(null);
    setActiveNearest(null);
  };
  const [activeNearest, setActiveNearest] = useState(null);
  const [selectedLineForNearest, setSelectedLineForNearest] = useState(null);
  const [showStops, setShowStops] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);

  // Phase 3 state (Journey Planner A to B)
  const [originCoord, setOriginCoord] = useState(null);
  const [destCoord, setDestCoord] = useState(null);
  const [plannerSelecting, setPlannerSelecting] = useState('origin');
  const [activeJourney, setActiveJourney] = useState(null);

  const [multiStops, setMultiStops] = useState([
    { id: 'multi-start', coord: null, label: '' },
    { id: 'multi-end', coord: null, label: '' }
  ]);
  const [multiPickingId, setMultiPickingId] = useState(null);
  const [multiVehicleFilter, setMultiVehicleFilter] = useState('ALL');
  const [multiSelections, setMultiSelections] = useState({});
  const [multiActiveLegKey, setMultiActiveLegKey] = useState(null);
  const multiPlanner = useMultiStopPlanner({ points: multiStops, routes, geometries, stops, vehicleFilter: multiVehicleFilter });

  const applyMultiStops = next => {
    const keys = new Set(buildMultiStopLegs(next, { vehicle: multiVehicleFilter }).map(leg => leg.key));
    setMultiStops(next);
    setMultiSelections(current => Object.fromEntries(Object.entries(current).filter(([key]) => keys.has(key))));
    setMultiActiveLegKey(current => keys.has(current) ? current : null);
  };
  const updateMultiPoint = (id, change) => applyMultiStops(multiStops.map(point => point.id === id ? { ...point, ...change } : point));
  const addMultiPoint = () => {
    if (multiStops.length >= 6) return;
    applyMultiStops([...multiStops, { id: `multi-${Date.now()}-${Math.random().toString(36).slice(2)}`, coord: null, label: '' }]);
  };
  const removeMultiPoint = id => {
    if (multiStops.length > 2) applyMultiStops(multiStops.filter(point => point.id !== id));
    setMultiPickingId(current => current === id ? null : current);
  };
  const moveMultiPoint = (id, delta) => {
    const index = multiStops.findIndex(point => point.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= multiStops.length) return;
    const next = [...multiStops];
    [next[index], next[target]] = [next[target], next[index]];
    applyMultiStops(next);
  };
  const setMultiPointFromMap = location => {
    if (!multiPickingId || !location?.coord) return false;
    updateMultiPoint(multiPickingId, { coord: location.coord, label: location.name || `${location.coord[0].toFixed(5)}, ${location.coord[1].toFixed(5)}` });
    setMultiPickingId(null);
    setSearchLocation(null);
    return true;
  };

  const filteredMultiLegs = multiPlanner.legs.map(leg => ({
    ...leg,
    filteredPlan: leg.plan ? filterMultiStopPlan(leg.plan, multiVehicleFilter) : null
  }));
  const optionFor = (leg, optionKey) => {
    if (!leg?.filteredPlan) return null;
    return [...leg.filteredPlan.directRoutes, ...leg.filteredPlan.transferRoutes].find(item => journeyOptionKey(item) === optionKey) || null;
  };
  const multiOptionsForLeg = leg => leg?.filteredPlan ? [...leg.filteredPlan.directRoutes, ...leg.filteredPlan.transferRoutes] : [];
  const activeMultiLeg = filteredMultiLegs.find(leg => leg.key === multiActiveLegKey && optionFor(leg, multiSelections[leg.key])) || filteredMultiLegs.find(leg => multiSelections[leg.key] && optionFor(leg, multiSelections[leg.key])) || filteredMultiLegs.find(leg => multiOptionsForLeg(leg).length > 0) || null;
  const activeMultiOptionKey = activeMultiLeg && (optionFor(activeMultiLeg, multiSelections[activeMultiLeg.key]) ? multiSelections[activeMultiLeg.key] : journeyOptionKey(multiOptionsForLeg(activeMultiLeg)[0]));
  const activeMultiJourney = activeMultiLeg ? optionFor(activeMultiLeg, activeMultiOptionKey) : null;
  const activeMultiRoute = activeMultiJourney ? rideLegs(activeMultiJourney)[0]?.route : null;
  const changeMultiVehicleFilter = vehicle => {
    setMultiSelections(current => Object.fromEntries(Object.entries(current).filter(([legKey, optionKey]) => {
      const leg = multiPlanner.legs.find(item => item.key === legKey);
      if (!leg) return false;
      if (!leg.plan && leg.status === 'loading') return true;
      if (!leg.plan) return false;
      const filtered = filterMultiStopPlan(leg.plan, vehicle);
      return [...filtered.directRoutes, ...filtered.transferRoutes].some(item => journeyOptionKey(item) === optionKey);
    })));
    setMultiActiveLegKey(current => {
      const leg = multiPlanner.legs.find(item => item.key === current);
      if (!leg?.plan) return null;
      const filtered = filterMultiStopPlan(leg.plan, vehicle);
      return [...filtered.directRoutes, ...filtered.transferRoutes].some(item => journeyOptionKey(item) === multiSelections[current]) ? current : null;
    });
    setMultiVehicleFilter(vehicle);
  };
  const multiStopProps = {
    points: multiStops, legs: multiPlanner.legs, pickingId: multiPickingId, vehicleFilter: multiVehicleFilter,
    selection: activeMultiLeg ? { legKey: activeMultiLeg.key, optionKey: activeMultiOptionKey } : null, stops,
    onChangePoint: updateMultiPoint, onAddPoint: addMultiPoint, onRemovePoint: removeMultiPoint, onMovePoint: moveMultiPoint,
    onPickPoint: id => setMultiPickingId(id), onFilterChange: changeMultiVehicleFilter,
    onSelectJourney: (legKey, optionKey) => {
      setMultiActiveLegKey(legKey);
      setMultiSelections(current => ({ ...current, [legKey]: optionKey }));
    }, onRetry: multiPlanner.retry
  };

  // Map Search Location State
  const [searchLocation, setSearchLocation] = useState(null);
  const [mapSearchFocused, setMapSearchFocused] = useState(false);

  // App settings
  const [lang, setLang] = useState('ar');
  const [theme, setTheme] = useState('light');

  const t = I18N[lang];

  // Sync HTML attributes
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.body.className = `theme-${theme}`;
  }, [lang, theme]);

  // Load datasets on mount
  useEffect(() => {
    loadRoutes()
      .then(data => {
        setRoutes(data);
        setBrtUnavailable(data.brtUnavailable === true);
      })
      .catch(err => console.error('Failed to load routes summary:', err));

    loadGeometries()
      .then(data => setGeometries(data))
      .catch(err => console.error('Failed to load routes geometry:', err));

    loadStops()
      .then(data => setStops(data))
      .catch(err => console.error('Failed to load stops:', err));
  }, []);

  // Filter routes for Explore tab with intermediate stops and synonym expansion
  const filteredRoutes = useMemo(() => {
    const tokens = expandSearchQuery(searchQuery);

    return routes.filter(r => {
      if (vehicleFilter !== 'ALL') {
        if (vehicleFilter === 'Metro' && r.vehicle !== 'Metro') return false;
        if (vehicleFilter === 'BRT' && r.vehicle !== 'BRT') return false;
        if (vehicleFilter === 'Minibus' && r.vehicle !== 'Minibus') return false;
        if (vehicleFilter === 'Bus' && r.vehicle !== 'Bus') return false;
        if (vehicleFilter === 'Microbus' && r.vehicle !== 'Microbus') return false;
        if (vehicleFilter === 'Tomnaya' && !['Tomnaya', 'Box'].includes(r.vehicle)) return false;
      }


      if (!tokens || tokens.length === 0) return true;

      return routeMatchesTokens(r, tokens);
    });
  }, [routes, searchQuery, vehicleFilter]);


  // Results computed in the Web Worker are copies; point them back at the
  // route objects held here so selection/equality keeps working.
  const routesById = useMemo(() => {
    const m = new Map();
    routes.forEach(r => m.set(r.id, r));
    return m;
  }, [routes]);
  const relinkRoute = (r) => (r && routesById.get(r.id)) || r;

  // Phase 2: Nearest drop points across all lines (runs in a Web Worker)
  const [nearestResults, setNearestResults] = useState([]);
  const [nearestLoading, setNearestLoading] = useState(false);
  useEffect(() => {
    if (!targetCoord || !geometries || routes.length === 0) {
      setNearestResults([]);
      setNearestLoading(false);
      return;
    }
    let cancelled = false;
    setNearestLoading(true);
    computeNearest(targetCoord, { routes, geometries, stops }, 2000, {
      quotaPerCategory: 25
    })
      .then(res => {
        if (cancelled) return;
        const mapped = (res || []).map(item => ({ ...item, route: relinkRoute(item.route) }));
        if (res?.counts) mapped.counts = res.counts;
        if (res?.byCategory) mapped.byCategory = res.byCategory;
        setNearestResults(mapped);
      })
      .catch(err => { if (!cancelled) { console.error(err); setNearestResults([]); } })
      .finally(() => { if (!cancelled) setNearestLoading(false); });
    return () => { cancelled = true; };
  }, [targetCoord, routes, geometries, stops]);

  // Phase 2: Calculate Nearest Drop Point for a chosen specific line
  const selectedLineDrop = useMemo(() => {
    if (!targetCoord || !selectedLineForNearest || !geometries || !geometries[selectedLineForNearest.id]) {
      return null;
    }
    return calculateRouteDropPoint(targetCoord, selectedLineForNearest, geometries[selectedLineForNearest.id], stops);
  }, [targetCoord, selectedLineForNearest, geometries, stops]);

  useEffect(() => {
    if (selectedLineDrop) {
      setActiveNearest(selectedLineDrop);
      setSelectedRoute(selectedLineForNearest);
    } else if (nearestResults.length > 0) {
      const isStale = !activeNearest || 
        activeNearest.targetCoord?.[0] !== targetCoord?.[0] || 
        activeNearest.targetCoord?.[1] !== targetCoord?.[1];

      if (isStale) {
        setActiveNearest(nearestResults[0]);
        setSelectedRoute(nearestResults[0].route);
      }
    }
  }, [selectedLineDrop, nearestResults, targetCoord]);

  // Drop-off on whichever line is selected, for the current destination.
  // Works for ANY line (not only the nearest ones), at any distance.
  const routeDrop = useMemo(() => {
    if (!targetCoord || !selectedRoute || !geometries) return null;
    const coords = geometries[selectedRoute.id];
    if (!coords || coords.length < 2) return null;
    return calculateRouteDropPoint(targetCoord, selectedRoute, coords, stops);
  }, [targetCoord, selectedRoute, geometries, stops]);

  // What the map draws as "drop point": the chosen nearest result in the
  // nearest tab, otherwise the selected line's drop-off.
  const mapNearest = activeTab === 'nearest' ? activeNearest : (activeTab === 'explore' ? routeDrop : null);

  // Drop-off shown in the route card (only if it belongs to the shown line)
  const drawerDrop = (() => {
    if (!targetCoord || !selectedRoute || activeTab === 'planner' || activeTab === 'multi') return null;
    const candidate = activeTab === 'nearest' ? activeNearest : routeDrop;
    return candidate && candidate.route && candidate.route.id === selectedRoute.id ? candidate : routeDrop;
  })();

  // Phase 3: A to B journeys (runs in a Web Worker)
  const EMPTY_PLAN = { directRoutes: [], transferRoutes: [] };
  const [plannedJourneys, setPlannedJourneys] = useState(EMPTY_PLAN);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [planRetry, setPlanRetry] = useState(0);
  useEffect(() => {
    setActiveJourney(null);
    if (!originCoord || !destCoord || routes.length === 0) {
      setPlannedJourneys(EMPTY_PLAN);
      setPlanLoading(false);
      setPlanError(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setPlannedJourneys(EMPTY_PLAN);
    setPlanLoading(true);
    setPlanError(null);
    computePlan(originCoord, destCoord, { routes, geometries, stops }, 1200, { vehicle: vehicleFilter, maxTransferWalkMeters: 600,
      maxTotalWalkMeters: 3600, maxTransfers: 2, signal: controller.signal,
      onProgress: update => {
        if (!cancelled && update?.phase === 'direct' && update.plan) setPlannedJourneys(update.plan);
      } })
      .then(res => {
        if (cancelled) return;
        setPlannedJourneys(res || EMPTY_PLAN);
      })
      .catch(err => { if (!cancelled) { console.error(err); setPlanError(err?.message || String(err)); setPlannedJourneys(EMPTY_PLAN); } })
      .finally(() => { if (!cancelled) setPlanLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [originCoord, destCoord, routes, geometries, stops, vehicleFilter, planRetry]);

  // Automatically select the best direct journey when calculated
  useEffect(() => {
    if (activeTab !== 'planner') return;
    const options = [...(plannedJourneys.directRoutes || []), ...(plannedJourneys.transferRoutes || [])];
    const selected = activeJourney && options.find(item => journeyOptionKey(item) === journeyOptionKey(activeJourney));
    const best = selected || plannedJourneys.directRoutes?.[0] || plannedJourneys.transferRoutes?.[0] || null;
    if (!best) {
      if (activeJourney) setActiveJourney(null);
      return;
    }
    if (!activeJourney || journeyOptionKey(activeJourney) !== journeyOptionKey(best)) setActiveJourney(best);
    const route = rideLegs(best)[0]?.route || null;
    if (route && route.id !== selectedRoute?.id) setSelectedRoute(route);
  }, [plannedJourneys, activeTab, activeJourney, selectedRoute]);

  // Map Click Handler for all modes
  const handleMapClick = (coord) => {
    if (activeTab === 'multi') {
      if (!multiPickingId) return;
      updateMultiPoint(multiPickingId, { coord, label: `${coord[0].toFixed(5)}, ${coord[1].toFixed(5)}` });
      setMultiPickingId(null);
      return;
    }
    if (activeTab === 'planner') {
      if (plannerSelecting === 'origin' || !originCoord) {
        setOriginCoord(coord);
        setPlannerSelecting(destCoord ? null : 'dest');
      } else if (plannerSelecting === 'dest' || !destCoord) {
        setDestCoord(coord);
        setPlannerSelecting(null);
      } else {
        // If both were already set, clicking sets a new origin
        setOriginCoord(coord);
        setPlannerSelecting('dest');
      }
    } else {
      setTargetCoord(coord);
      setTargetLabel(null);
      setActiveNearest(null);
      setActiveTab('nearest');
    }
  };

  // Swap Points
  const handleSwapPoints = () => {
    const temp = originCoord;
    setOriginCoord(destCoord);
    setDestCoord(temp);
  };

  // Toggle Direction (ذهاب / إياب)
  // ---------------- Trip tracking ("تتبع الرحلة") ----------------
  const [trip, setTrip] = useState(null);          // prepared track (see tripTracker.js)
  const [tripState, setTripState] = useState(null);
  const [following, setFollowing] = useState(true);
  const [wakeLockOn, setWakeLockOn] = useState(false);
  const wakeLockRef = React.useRef(null);
  const lastPhaseRef = React.useRef(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setWakeLockOn(true);
        wakeLockRef.current.addEventListener('release', () => setWakeLockOn(false));
      }
    } catch (e) { setWakeLockOn(false); }
  };
  const releaseWakeLock = () => {
    try { wakeLockRef.current && wakeLockRef.current.release(); } catch (e) { /* ignore */ }
    wakeLockRef.current = null;
    setWakeLockOn(false);
  };

  const startTrip = ({ route, dropCoord, dropName }) => {
    if (!route || !dropCoord || !geometries || !geometries[route.id]) return;
    const track = buildTrack(route, geometries[route.id], stops, dropCoord,
      dropName || (lang === 'ar' ? 'نقطة النزول' : 'your stop'));
    setSelectedRoute(route);
    setTrip(track);
    setTripState(null);
    setFollowing(true);
    lastPhaseRef.current = null;
    centerOnNextFix.current = true;
    geo.start();
    requestWakeLock();
  };
  const stopTrip = () => {
    setTrip(null);
    setTripState(null);
    releaseWakeLock();
  };

  // every GPS fix -> update progress, alerts
  useEffect(() => {
    if (!trip || !geo.coord) return;
    setTripState(prev => {
      const next = updateTrack(trip, { coord: geo.coord, accuracy: geo.accuracy, speed: geo.speed, timestamp: geo.timestamp }, prev);
      const key = next.phase + (next.wrongWay ? ':wrong' : '');
      if (key !== lastPhaseRef.current) {
        lastPhaseRef.current = key;
        const buzz = next.phase === 'arrived' ? [400, 150, 400, 150, 400]
          : next.phase === 'approaching' ? [200, 100, 200]
          : (next.phase === 'passed' || next.wrongWay) ? [600] : null;
        if (buzz && navigator.vibrate) navigator.vibrate(buzz);
      }
      return next;
    });
    if (following) setFlyToRequest(prev => ({ coord: geo.coord, n: (prev?.n || 0) + 1, pan: true }));
  }, [trip, geo.coord?.[0], geo.coord?.[1], geo.timestamp]);

  // the screen lock is dropped when the page is hidden: take it again on return
  useEffect(() => {
    const onVis = () => { if (trip && document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [trip]);

  const switchTripDirection = () => {
    if (!trip) return;
    const r = trip.route;
    const opposite = routes.find(x => x.route_id === r.route_id && x.dir !== r.dir && x.id !== r.id)
      || routes.find(x => x.num === r.num && x.vehicle === r.vehicle && x.dir !== r.dir);
    if (opposite) startTrip({ route: opposite, dropCoord: trip.drop.coord, dropName: trip.drop.name });
  };

  const handleToggleDirection = () => {
    if (!selectedRoute) return;

    const targetDir = selectedRoute.dir === 0 ? 1 : 0;
    const opposite = routes.find(
      r => r.route_id === selectedRoute.route_id && r.dir === targetDir && r.id !== selectedRoute.id
    ) || routes.find(
      r => r.num === selectedRoute.num && r.vehicle === selectedRoute.vehicle && r.dir === targetDir
    );

    if (opposite) {
      setSelectedRoute(opposite);
      if (activeNearest) {
        const updated = findNearestDropPoints(targetCoord, [opposite], geometries, stops, 2000);
        if (updated.length > 0) setActiveNearest(updated[0]);
      }
    } else {
      alert(t.noOppositeDir);
    }
  };

  // Let the native system back button dismiss the planner's active layer first.
  useEffect(() => {
    const onNativeBack = event => {
      if (trip) {
        stopTrip();
        geo.stop();
      } else if (selectedRoute) {
        setSelectedRoute(null);
        setActiveNearest(null);
      } else if (geoNotice) {
        setGeoNotice(null);
      } else if (activeTab !== 'explore') {
        setActiveTab('explore');
      } else return;
      event.preventDefault();
    };
    window.addEventListener('mowaslaty:native-back', onNativeBack);
    return () => window.removeEventListener('mowaslaty:native-back', onNativeBack);
  }, [trip, selectedRoute, geoNotice, activeTab, geo.stop]);

  return (
    <div className="app-layout">
      {/* Sidebar with 3 Modes */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        vehicleFilter={vehicleFilter}
        brtUnavailable={brtUnavailable}
        setVehicleFilter={setVehicleFilter}
        routes={routes}
        filteredRoutes={filteredRoutes}
        selectedRoute={selectedRoute}
        onSelectRoute={(r) => {
          setSelectedRoute(r);
          if (activeTab === 'nearest' && targetCoord) {
            const drop = findNearestDropPoints(targetCoord, [r], geometries, stops, 3500);
            if (drop.length > 0) setActiveNearest(drop[0]);
          }
        }}
        // Phase 2 props
        targetCoord={targetCoord}
        setTargetCoord={(c, label = null) => {
          if (!c) { clearTarget(); return; }
          setTargetCoord(c);
          setTargetLabel(label);
          setActiveNearest(null);
        }}
        nearestVehicleFilter={nearestVehicleFilter}
        setNearestVehicleFilter={setNearestVehicleFilter}
        nearestResults={nearestResults}
        nearestLoading={nearestLoading}
        activeNearest={activeNearest}
        setActiveNearest={setActiveNearest}
        selectedLineForNearest={selectedLineForNearest}
        setSelectedLineForNearest={setSelectedLineForNearest}
        selectedLineDrop={selectedLineDrop}
        // Phase 3 props
        originCoord={originCoord}
        setOriginCoord={setOriginCoord}
        destCoord={destCoord}
        setDestCoord={setDestCoord}
        plannerSelecting={plannerSelecting}
        setPlannerSelecting={setPlannerSelecting}
        plannedJourneys={plannedJourneys}
        userCoord={geo.coord}
        onLocate={handleLocate}
        onStartTrip={startTrip}
        planLoading={planLoading}
        planError={planError}
        onRetryPlan={() => setPlanRetry(value => value + 1)}
        planningVehicle={vehicleFilter}
        activeJourney={activeJourney}
        setActiveJourney={setActiveJourney}
        onSwapPoints={handleSwapPoints}
        multiStopProps={{ ...multiStopProps, onShowMap: () => {} }}
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        t={t}
        mapSearchFocused={mapSearchFocused}
      />

      {/* Main Map Area */}
      <main className="map-wrapper">
        {/* Floating Interactive Map Search Bar */}
        <MapSearchBar
          stops={stops}
          routes={routes}
          selectedLocation={searchLocation}
          onSelectLocation={(loc) => {
            setSearchLocation(loc);
          }}
          onClearLocation={() => setSearchLocation(null)}
          activeTab={activeTab}
          multiStopTarget={multiPickingId ? { id: multiPickingId, number: multiStops.findIndex(point => point.id === multiPickingId) + 1 } : null}
          onSetMultiStopLocation={setMultiPointFromMap}
          plannerSelecting={plannerSelecting}
          destination={targetCoord && activeTab === 'nearest' ? {
            label: targetLabel,
            coord: targetCoord,
            onClear: clearTarget,
            onFocus: () => setFlyToRequest(prev => ({ coord: targetCoord, n: (prev?.n || 0) + 1 }))
          } : null}
          onFocusChange={setMapSearchFocused}
          onSelectRoute={(r) => {
            setSelectedRoute(r);
            setSearchLocation(null);
          }}
          onSetTargetCoord={(coord) => {
            setTargetCoord(coord);
            setTargetLabel(searchLocation ? searchLocation.name : null);
            setSearchLocation(null);
            setActiveNearest(null);
            setSelectedLineForNearest(null);
            setActiveTab('nearest');
          }}
          onSetOriginCoord={(coord) => {
            setOriginCoord(coord);
            setSearchLocation(null);
            setPlannerSelecting(destCoord ? null : 'dest');
            setActiveTab('planner');
          }}
          onSetDestCoord={(coord) => {
            setDestCoord(coord);
            setSearchLocation(null);
            setPlannerSelecting(null);
            setActiveTab('planner');
          }}
          lang={lang}
        />

        <MapComponent
          selectedRoute={activeTab === 'multi' ? activeMultiRoute : selectedRoute}
          geometries={geometries}
          targetCoord={targetCoord}
          onMapClick={handleMapClick}
          activeNearest={mapNearest}
          searchLocation={searchLocation}
          // Phase 3 props
          activeTab={activeTab}
          originCoord={activeTab === 'multi' ? activeMultiLeg?.from.coord : originCoord}
          destCoord={activeTab === 'multi' ? activeMultiLeg?.to.coord : destCoord}
          activeJourney={activeTab === 'multi' ? activeMultiJourney : activeJourney}
          journeyPointNumbers={activeTab === 'multi' && activeMultiLeg ? [multiStops.findIndex(point => point.id === activeMultiLeg.from.id) + 1, multiStops.findIndex(point => point.id === activeMultiLeg.to.id) + 1] : null}
          stops={stops}
          showStops={showStops}
          fitRequest={fitRequest}
          flyToRequest={flyToRequest}
          tripDrop={trip ? trip.drop.coord : null}
          onUserPan={() => { if (trip) setFollowing(false); }}
          userLocation={geo.coord ? { coord: geo.coord, accuracy: geo.accuracy, heading: geo.heading } : null}
          lang={lang}
          t={t}
        />

        {/* Floating Map Controls */}
        <div className="map-floating-panel">
          <button
            className={`floating-btn ${showStops ? 'active' : ''}`}
            onClick={() => setShowStops(!showStops)}
            aria-pressed={showStops}
          >
            <MapPin size={16} />
            <span>{t.stopsBtn}</span>
          </button>
          <button
            type="button"
            className={`floating-btn locate-btn ${geo.status === 'active' ? 'active' : ''} ${geo.status === 'locating' ? 'locating' : ''}`}
            onClick={handleLocate}
            aria-label={lang === 'ar' ? 'موقعي' : 'My location'}
            title={lang === 'ar' ? 'موقعي' : 'My location'}
          >
            <LocateFixed size={18} />
            <span>{lang === 'ar' ? 'موقعي' : 'Me'}</span>
          </button>
        </div>

        {geoNotice && (
          <div className="map-toast" role="alert">
            <span>
              {geoNotice === 'denied'
                ? (lang === 'ar' ? 'الوصول للموقع مرفوض. فعّله من إعدادات المتصفح ثم اضغط «موقعي» مرة أخرى.' : 'Location access is blocked. Allow it in your browser settings, then tap “Me” again.')
                : geoNotice === 'unsupported'
                ? (lang === 'ar' ? 'هذا المتصفح لا يدعم تحديد الموقع.' : 'This browser doesn’t support location.')
                : (lang === 'ar' ? 'جاري البحث عن إشارة GPS… جرّب في مكان مفتوح.' : 'Looking for a GPS signal… try somewhere more open.')}
            </span>
            <button type="button" onClick={() => setGeoNotice(null)} aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Active Route Drawer */}
        {trip && (
          <TripTracker
            trip={trip}
            state={tripState}
            geoStatus={geo.status}
            following={following}
            wakeLockOn={wakeLockOn}
            onStop={stopTrip}
            onRecenter={() => {
              setFollowing(true);
              if (geo.coord) setFlyToRequest(prev => ({ coord: geo.coord, n: (prev?.n || 0) + 1 }));
            }}
            onSwitchDirection={switchTripDirection}
            lang={lang}
          />
        )}

        {!trip && activeTab !== 'multi' && <RouteDrawer
          selectedRoute={selectedRoute}
          onClose={() => {
            setSelectedRoute(null);
            setActiveNearest(null);
          }}
          onToggleDirection={handleToggleDirection}
          onFitRoute={() => setFitRequest(n => n + 1)}
          drop={drawerDrop}
          targetCoord={targetCoord}
          onClearTarget={clearTarget}
          onStartTrip={(drop) => startTrip({
            route: selectedRoute,
            dropCoord: drop.dropCoord,
            dropName: drop.nearestStop ? (lang === 'ar' ? drop.nearestStop.ar : drop.nearestStop.en) : null
          })}
          lang={lang}
          t={t}
        />}
      </main>
    </div>
  );
}
