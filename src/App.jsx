import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import RouteDrawer from './components/RouteDrawer';
import MapSearchBar from './components/MapSearchBar';
import { I18N } from './utils/i18n';
import { normalizeText, findNearestDropPoints, calculateRouteDropPoint } from './utils/geoUtils';
import { expandSearchQuery, routeMatchesTokens } from './utils/transitAliases';
import { loadRoutes, loadGeometries, loadStops } from './utils/dataLoader';
import { computeNearest, computePlan } from './utils/transitWorkerClient';
import { MapPin } from 'lucide-react';


export default function App() {
  const [routes, setRoutes] = useState([]);
  const [geometries, setGeometries] = useState(null);
  const [stops, setStops] = useState([]);
  const [activeTab, setActiveTab] = useState('explore');
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('ALL');
  const [selectedRoute, setSelectedRoute] = useState(null);
  
  // Phase 2 state (Nearest Drop & Specific Line Drop)
  const [targetCoord, setTargetCoord] = useState(null);
  const [targetLabel, setTargetLabel] = useState(null);   // place name, when known
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

  // Map Search Location State
  const [searchLocation, setSearchLocation] = useState(null);

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
        const defaultRoute = data.find(r => r.num === '305') || data[0];
        if (defaultRoute) setSelectedRoute(defaultRoute);
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
    computeNearest(targetCoord, { routes, geometries, stops }, 2000)
      .then(res => {
        if (cancelled) return;
        setNearestResults((res || []).map(item => ({ ...item, route: relinkRoute(item.route) })));
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
    if (!targetCoord || !selectedRoute || activeTab === 'planner') return null;
    const candidate = activeTab === 'nearest' ? activeNearest : routeDrop;
    return candidate && candidate.route && candidate.route.id === selectedRoute.id ? candidate : routeDrop;
  })();

  // Phase 3: A to B journeys (runs in a Web Worker)
  const EMPTY_PLAN = { directRoutes: [], transferRoutes: [] };
  const [plannedJourneys, setPlannedJourneys] = useState(EMPTY_PLAN);
  const [planLoading, setPlanLoading] = useState(false);
  useEffect(() => {
    if (!originCoord || !destCoord || !geometries || routes.length === 0) {
      setPlannedJourneys(EMPTY_PLAN);
      setPlanLoading(false);
      return;
    }
    let cancelled = false;
    setPlanLoading(true);
    computePlan(originCoord, destCoord, { routes, geometries, stops }, 1200)
      .then(res => {
        if (cancelled) return;
        const plan = res || EMPTY_PLAN;
        setPlannedJourneys({
          directRoutes: (plan.directRoutes || []).map(j => ({ ...j, route: relinkRoute(j.route) })),
          transferRoutes: (plan.transferRoutes || []).map(j => ({
            ...j,
            leg1: { ...j.leg1, route: relinkRoute(j.leg1.route) },
            leg2: { ...j.leg2, route: relinkRoute(j.leg2.route) }
          }))
        });
      })
      .catch(err => { if (!cancelled) { console.error(err); setPlannedJourneys(EMPTY_PLAN); } })
      .finally(() => { if (!cancelled) setPlanLoading(false); });
    return () => { cancelled = true; };
  }, [originCoord, destCoord, routes, geometries, stops]);

  // Automatically select the best direct journey when calculated
  useEffect(() => {
    if (plannedJourneys.directRoutes && plannedJourneys.directRoutes.length > 0) {
      const best = plannedJourneys.directRoutes[0];
      setActiveJourney(best);
      setSelectedRoute(best.route);
    } else if (plannedJourneys.transferRoutes && plannedJourneys.transferRoutes.length > 0) {
      const bestTransfer = plannedJourneys.transferRoutes[0];
      setActiveJourney(bestTransfer);
      setSelectedRoute(bestTransfer.leg1.route);
    } else {
      setActiveJourney(null);
    }
  }, [plannedJourneys]);

  // Map Click Handler for all modes
  const handleMapClick = (coord) => {
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
      // Nearest mode
      setTargetCoord(coord);
      setTargetLabel(null);
      setActiveNearest(null);
      if (activeTab !== 'nearest') {
        setActiveTab('nearest');
      }
    }
  };

  // Swap Points
  const handleSwapPoints = () => {
    const temp = originCoord;
    setOriginCoord(destCoord);
    setDestCoord(temp);
  };

  // Toggle Direction (ذهاب / إياب)
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

  return (
    <div className="app-layout">
      {/* Sidebar with 3 Modes */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        vehicleFilter={vehicleFilter}
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
        planLoading={planLoading}
        activeJourney={activeJourney}
        setActiveJourney={setActiveJourney}
        onSwapPoints={handleSwapPoints}
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        t={t}
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
          destination={targetCoord && activeTab !== 'planner' ? {
            label: targetLabel,
            coord: targetCoord,
            onClear: clearTarget,
            onFocus: () => setFlyToRequest(prev => ({ coord: targetCoord, n: (prev?.n || 0) + 1 }))
          } : null}
          onSelectRoute={(r) => {
            setSelectedRoute(r);
            setSearchLocation(null);
          }}
          onSetTargetCoord={(coord) => {
            setTargetCoord(coord);
            setTargetLabel(searchLocation ? searchLocation.name : null);
            setActiveNearest(null);
            setSelectedLineForNearest(null);
            setActiveTab('nearest');
          }}
          onSetOriginCoord={(coord) => {
            setOriginCoord(coord);
            setPlannerSelecting(destCoord ? null : 'dest');
            setActiveTab('planner');
          }}
          onSetDestCoord={(coord) => {
            setDestCoord(coord);
            setPlannerSelecting(null);
            setActiveTab('planner');
          }}
          onFilterNearbyRoutes={(name) => {
            setSearchQuery(name.split(' ')[0]);
            setActiveTab('explore');
          }}
          lang={lang}
        />

        <MapComponent
          selectedRoute={selectedRoute}
          geometries={geometries}
          targetCoord={targetCoord}
          onMapClick={handleMapClick}
          activeNearest={mapNearest}
          searchLocation={searchLocation}
          // Phase 3 props
          activeTab={activeTab}
          originCoord={originCoord}
          destCoord={destCoord}
          activeJourney={activeJourney}
          stops={stops}
          showStops={showStops}
          fitRequest={fitRequest}
          flyToRequest={flyToRequest}
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
        </div>

        {/* Active Route Drawer */}
        <RouteDrawer
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
          lang={lang}
          t={t}
        />
      </main>
    </div>
  );
}
