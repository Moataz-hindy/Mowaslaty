import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import RouteDrawer from './components/RouteDrawer';
import MapSearchBar from './components/MapSearchBar';
import { I18N } from './utils/i18n';
import { normalizeText, findNearestDropPoints, calculateRouteDropPoint } from './utils/geoUtils';
import { expandSearchQuery, routeMatchesTokens } from './utils/transitAliases';
import { planJourney } from './utils/tripPlanner';
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
    fetch('/data/routes_summary.json')
      .then(res => res.json())
      .then(data => {
        setRoutes(data);
        const defaultRoute = data.find(r => r.num === '305') || data[0];
        if (defaultRoute) setSelectedRoute(defaultRoute);
      })
      .catch(err => console.error('Failed to load routes summary:', err));

    fetch('/data/routes_geometry.json')
      .then(res => res.json())
      .then(data => setGeometries(data))
      .catch(err => console.error('Failed to load routes geometry:', err));

    fetch('/data/stops_summary.json')
      .then(res => res.json())
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


  // Phase 2: Calculate Nearest Drop Points (All lines)
  const nearestResults = useMemo(() => {
    if (!targetCoord || !geometries || routes.length === 0) return [];
    return findNearestDropPoints(targetCoord, routes, geometries, stops, 2000);
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

  // Phase 3: Calculate Planned Journeys (A to B)
  const plannedJourneys = useMemo(() => {
    if (!originCoord || !destCoord || !geometries || routes.length === 0) {
      return { directRoutes: [], transferRoutes: [] };
    }
    return planJourney(originCoord, destCoord, routes, geometries, stops, 1200);
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
        setTargetCoord={(c) => {
          setTargetCoord(c);
          setActiveNearest(null);
        }}
        nearestResults={nearestResults}
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
          onSelectRoute={(r) => {
            setSelectedRoute(r);
            setSearchLocation(null);
          }}
          onSetTargetCoord={(coord) => {
            setTargetCoord(coord);
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
          activeNearest={activeNearest}
          searchLocation={searchLocation}
          // Phase 3 props
          activeTab={activeTab}
          originCoord={originCoord}
          destCoord={destCoord}
          activeJourney={activeJourney}
          stops={stops}
          showStops={showStops}
          fitRequest={fitRequest}
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
          lang={lang}
          t={t}
        />
      </main>
    </div>
  );
}
