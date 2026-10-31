import React, { useState } from 'react';
import { 
  Bus, 
  Search, 
  X, 
  MapPin, 
  Footprints, 
  Compass, 
  Navigation, 
  Route,
  ArrowUpDown,
  Moon, 
  Sun, 
  Languages,
  Clock,
  Users,
  ExternalLink,
  Loader2,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  LocateFixed,
  AlertCircle,
  Info,
  TrainFront,
  Car,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { VEHICLE_COLORS } from '../utils/i18n';
import RouteEnds from './RouteEnds';
import { getRouteEnds, lineLabel } from '../utils/routeEnds';
import { rideLegs } from '../utils/journey';
import JourneySteps from './JourneySteps';
import { expandSearchQuery, routeMatchesTokens } from '../utils/transitAliases';
import MultiStopPlanner from './MultiStopPlanner';
import FeedbackEntry from './FeedbackEntry.jsx';


// Short "origin ← destination" title for list rows, when the data has
// both ends in the current language; otherwise null (use the long name).
const hasArabicText = (txt) => /[\u0600-\u06FF]/.test(txt || '');
function compactRouteTitle(r, lang) {
  if (lang === 'ar') {
    if (hasArabicText(r.origin) && hasArabicText(r.dest)) return `${r.origin} ← ${r.dest}`;
    return r.long_ar ? r.long_ar.replace(/\s*[-–]\s*/g, ' – ') : null;
  }
  const o = r.origin_en || (!hasArabicText(r.origin) ? r.origin : null);
  const d = r.dest_en || (!hasArabicText(r.dest) ? r.dest : null);
  return o && d ? `${o} → ${d}` : null;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  vehicleFilter,
  brtUnavailable = false,
  setVehicleFilter,
  routes,
  filteredRoutes,
  selectedRoute,
  onSelectRoute,
  // Phase 2 props
  targetCoord,
  setTargetCoord,
  nearestVehicleFilter = 'ALL',
  setNearestVehicleFilter,
  nearestResults,
  nearestLoading = false,
  activeNearest,
  setActiveNearest,
  selectedLineForNearest,
  setSelectedLineForNearest,
  selectedLineDrop,
  // Phase 3 props
  originCoord,
  setOriginCoord,
  destCoord,
  setDestCoord,
  plannerSelecting,
  setPlannerSelecting,
  plannedJourneys,
  userCoord = null,
  onLocate,
  onStartTrip,
  planLoading = false,
  planError = null,
  onRetryPlan = () => {},
  planningVehicle = 'ALL',
  activeJourney,
  setActiveJourney,
  onSwapPoints,
  lang,
  setLang,
  theme,
  setTheme,
  mapSearchFocused = false,
  multiStopProps = null,
  t
}) {
  // Phone layout: the sidebar becomes a bottom sheet over the map.
  // It expands when the user switches mode. (No effect on desktop CSS.)
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [preferredSheetHeight, setPreferredSheetHeight] = useState(null);
  const [isSheetResizing, setIsSheetResizing] = useState(false);
  const [moreModesOpen, setMoreModesOpen] = useState(false);
  const asideRef = React.useRef(null);
  const sheetDragRef = React.useRef(null);
  const suppressHandleClickRef = React.useRef(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
  );
  const [mobileViewportHeight, setMobileViewportHeight] = useState(() =>
    typeof window !== 'undefined' ? (window.visualViewport?.height || window.innerHeight) : 0
  );

  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const updateViewport = () => {
      setIsMobileViewport(media.matches);
      setMobileViewportHeight(window.visualViewport?.height || window.innerHeight);
    };
    media.addEventListener?.('change', updateViewport);
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    return () => {
      media.removeEventListener?.('change', updateViewport);
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
    };
  }, []);

  React.useEffect(() => {
    if (!sheetExpanded && asideRef.current && !isSheetResizing) asideRef.current.scrollTop = 0;
  }, [sheetExpanded]);

  const getSheetBounds = () => {
    if (typeof window === 'undefined') return { min: 142, max: 600, defaultExpanded: 420 };
    const rootStyle = getComputedStyle(document.documentElement);
    const collapsedBase = parseFloat(rootStyle.getPropertyValue('--sheet-collapsed')) || 142;
    const safeBottom = asideRef.current ? (parseFloat(getComputedStyle(asideRef.current).paddingBottom) || 0) : 0;
    const min = collapsedBase + safeBottom;
    const clearance = parseFloat(rootStyle.getPropertyValue('--sheet-map-clearance')) || 82;
    const viewportHeight = mobileViewportHeight || window.visualViewport?.height || window.innerHeight;
    const searchStrip = document.querySelectorAll(
      '.map-search-box, .map-search-filter-chips, .map-active-location-card, .map-selected-location-bar, .destination-chip, .map-floating-panel'
    );
    let searchBottom = 0;
    searchStrip.forEach((element) => {
      if (getComputedStyle(element).display !== 'none') {
        searchBottom = Math.max(searchBottom, element.getBoundingClientRect().bottom);
      }
    });
    const max = Math.max(min, viewportHeight - Math.max(clearance, searchBottom + 8));
    const ratio = parseFloat(rootStyle.getPropertyValue('--sheet-expanded-ratio')) || 0.7;
    return { min, max, defaultExpanded: Math.min(viewportHeight * ratio, max) };
  };

  const currentSheetHeight = () => {
    const bounds = getSheetBounds();
    return sheetExpanded
      ? Math.max(bounds.min, Math.min(preferredSheetHeight ?? bounds.defaultExpanded, bounds.max))
      : bounds.min;
  };

  const beginSheetResize = (event) => {
    if (!isMobileViewport || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const height = asideRef.current?.getBoundingClientRect().height ?? getSheetBounds().min;
    sheetDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: height,
      moved: false
    };
    setIsSheetResizing(true);
    suppressHandleClickRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveSheetResize = (event) => {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = drag.startY - event.clientY;
    if (Math.abs(delta) > 3) {
      drag.moved = true;
      suppressHandleClickRef.current = true;
    }
    if (!drag.moved) return;

    event.preventDefault();
    const bounds = getSheetBounds();
    const height = Math.max(bounds.min, Math.min(bounds.max, drag.startHeight + delta));
    if (height <= bounds.min + 12) {
      setPreferredSheetHeight(null);
      setSheetExpanded(false);
    } else {
      setPreferredSheetHeight(height);
      setSheetExpanded(true);
    }
  };

  const endSheetResize = (event) => {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    sheetDragRef.current = null;
    setIsSheetResizing(false);
    if (event.type === 'pointercancel' || event.type === 'lostpointercapture') {
      suppressHandleClickRef.current = false;
    }
    if (!sheetExpanded && asideRef.current) asideRef.current.scrollTop = 0;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSheetKeyDown = (event) => {
    if (!isMobileViewport) return;
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const bounds = getSheetBounds();
    if (event.key === 'Home') {
      setPreferredSheetHeight(null);
      setSheetExpanded(false);
      return;
    }
    if (event.key === 'End') {
      setPreferredSheetHeight(bounds.max);
      setSheetExpanded(true);
      return;
    }

    const height = Math.max(bounds.min, Math.min(bounds.max, currentSheetHeight() + (event.key === 'ArrowUp' ? 32 : -32)));
    if (height <= bounds.min + 12) {
      setPreferredSheetHeight(null);
      setSheetExpanded(false);
    } else {
      setPreferredSheetHeight(height);
      setSheetExpanded(true);
    }
  };
  // "موقعي الحالي" as the trip start: waits for the first GPS fix if needed
  const [originFromLocation, setOriginFromLocation] = useState(false);
  React.useEffect(() => {
    if (originFromLocation && userCoord) {
      setOriginFromLocation(false);
      setOriginCoord(userCoord);
      setPlannerSelecting(destCoord ? null : 'dest');
    }
  }, [originFromLocation, userCoord]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    setSheetExpanded(true);
    setMoreModesOpen(false);
  };

  // Specific line selector state for Nearest Drop tab
  const [lineSearchQuery, setLineSearchQuery] = useState('');
  const [lineSelectorExpanded, setLineSelectorExpanded] = useState(false);
  const [showOtherNearbyLines, setShowOtherNearbyLines] = useState(false);
  const [expandedStopsRouteId, setExpandedStopsRouteId] = useState(null);

  React.useEffect(() => {
    if (mapSearchFocused) setSheetExpanded(false);
  }, [mapSearchFocused]);
  React.useEffect(() => {
    if ((activeTab === 'nearest' && targetCoord) || (activeTab === 'planner' && originCoord && destCoord) || activeTab === 'multi') {
      setSheetExpanded(true);
    }
  }, [activeTab, targetCoord, originCoord, destCoord]);

  const matchingLineSuggestions = React.useMemo(() => {
    if (!lineSearchQuery.trim()) return [];
    const tokens = expandSearchQuery(lineSearchQuery);
    return routes.filter(r => routeMatchesTokens(r, tokens)).slice(0, 8);
  }, [lineSearchQuery, routes]);

  const nearestCategoryCounts = React.useMemo(() => {
    if (nearestResults?.counts) return nearestResults.counts;
    const items = nearestResults || [];
    return {
      ALL: items.length,
      BRT: items.filter(i => i.vehicleCategory === 'BRT' || i.route.vehicle === 'BRT').length,
      Minibus: items.filter(i => i.vehicleCategory === 'Minibus' || i.route.vehicle === 'Minibus').length,
      Microbus: items.filter(i => ['Microbus', 'Tomnaya', 'Box'].includes(i.route.vehicle) || i.vehicleCategory === 'Microbus').length,
      Bus: items.filter(i => i.route.vehicle === 'Bus' || i.vehicleCategory === 'Bus').length,
      Metro: items.filter(i => i.route.vehicle === 'Metro' || i.vehicleCategory === 'Metro').length
    };
  }, [nearestResults]);

  const displayedNearest = React.useMemo(() => {
    const items = nearestResults || [];
    if (nearestVehicleFilter === 'ALL') return items;
    return items.filter(item => {
      if (nearestVehicleFilter === 'BRT') return item.vehicleCategory === 'BRT' || item.route.vehicle === 'BRT';
      if (nearestVehicleFilter === 'Minibus') return item.vehicleCategory === 'Minibus' || item.route.vehicle === 'Minibus';
      if (nearestVehicleFilter === 'Microbus') return ['Microbus', 'Tomnaya', 'Box'].includes(item.route.vehicle) || item.vehicleCategory === 'Microbus';
      if (nearestVehicleFilter === 'Bus') return item.route.vehicle === 'Bus' || item.vehicleCategory === 'Bus';
      if (nearestVehicleFilter === 'Metro') return item.route.vehicle === 'Metro' || item.vehicleCategory === 'Metro';
      return true;
    });
  }, [nearestResults, nearestVehicleFilter]);

  const journeyGroups = [
    { key: 'direct', journeys: plannedJourneys?.directRoutes || [], title: t.directFoundTitle },
    { key: 'transfers', journeys: plannedJourneys?.transferRoutes || [], title: t.transfersFoundTitle }
  ].filter(group => group.journeys.length > 0);
  const renderJourneyCard = journey => {
    const rides = rideLegs(journey);
    const firstRide = rides[0];
    if (!firstRide) return null;
    const route = firstRide.route;
    const isSelected = activeJourney?.id === journey.id;
    const color = route.color || VEHICLE_COLORS[route.vehicle] || VEHICLE_COLORS.Default;
    return <article key={journey.id} data-journey-id={journey.id} className={`journey-card ${isSelected ? 'selected' : ''}`}
      data-vehicle={route.vehicle} style={{ '--card-color': color }} role="button" tabIndex={0}
      aria-current={isSelected ? 'true' : undefined}
      onClick={() => { setActiveJourney(journey); onSelectRoute(route); setSheetExpanded(false); }}
      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setActiveJourney(journey); onSelectRoute(route); setSheetExpanded(false); } }}>
      <div className="journey-card-header"><div className="badge-group">
        {rides.map((ride, index) => <React.Fragment key={`${ride.tripId}-${ride.fromSequence}`}>
          {index > 0 && <span aria-hidden="true">→</span>}
          <span className="route-num-badge" data-vehicle={ride.route?.vehicle}>{lineLabel(ride.route, lang)}</span>
        </React.Fragment>)}
        <span className={journey.transfers ? 'transfer-pill' : 'direct-pill'}>{journey.transfers ? t.journeyTransferCount(journey.transfers) : t.directBadge}</span>
      </div><div className="time-badge"><Clock size={12}/><span>{t.totalTripTime(journey.totalTimeMinutes)}</span></div></div>
      <JourneySteps journey={journey} lang={lang} t={t} summaryMode="walk" isSelected={isSelected}
        onStartTrip={() => onStartTrip?.({ route, dropCoord: firstRide.toCoord, dropName: lang === 'ar' ? 'محطة النزول' : 'alighting stop' })}/>
    </article>;
  };




  return (
    <aside
      ref={asideRef}
      className={`sidebar ${sheetExpanded ? 'sheet-expanded' : 'sheet-collapsed'} ${isSheetResizing ? 'sheet-resizing' : ''}`}
      style={isMobileViewport && sheetExpanded && preferredSheetHeight != null
        ? { height: `${Math.max(getSheetBounds().min, Math.min(preferredSheetHeight, getSheetBounds().max))}px` }
        : undefined}
    >
      <div className="sheet-top">
      <button
        type="button"
        className="sheet-handle"
        role="slider"
        aria-orientation="vertical"
        aria-valuemin={Math.round(getSheetBounds().min)}
        aria-valuemax={Math.round(getSheetBounds().max)}
        aria-valuenow={Math.round(currentSheetHeight())}
        aria-valuetext={lang === 'ar' ? `ارتفاع اللوحة ${Math.round(currentSheetHeight())} بكسل` : `Panel height ${Math.round(currentSheetHeight())} pixels`}
        aria-label={lang === 'ar' ? 'ارتفاع لوحة الخطوط' : 'Transit panel height'}
        title={lang === 'ar' ? 'اسحب لتغيير ارتفاع اللوحة، أو استخدم الأسهم' : 'Drag to resize, or use the arrow keys'}
        onClick={(event) => {
          if (suppressHandleClickRef.current) {
            suppressHandleClickRef.current = false;
            event.preventDefault();
            return;
          }
          setSheetExpanded(value => !value);
        }}
        onKeyDown={handleSheetKeyDown}
        onPointerDown={beginSheetResize}
        onPointerMove={moveSheetResize}
        onPointerUp={endSheetResize}
        onPointerCancel={endSheetResize}
        onLostPointerCapture={endSheetResize}
      >
        <span aria-hidden="true"></span>
      </button>
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <Bus size={24} />
          </div>
          <div>
            <h1 className="brand-title">{t.brandTitle}</h1>
            <p className="brand-subtitle">{t.brandSub}</p>
          </div>
        </div>

        <div className="header-actions">
          <button 
            className="icon-btn" 
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            title="Switch Language"
          >
            <Languages size={15} />
            <span style={{ marginInlineStart: '4px', fontSize: '11px', fontWeight: 'bold' }}>
              {lang === 'ar' ? 'EN' : 'عربي'}
            </span>
          </button>

          <button 
            className="icon-btn" 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Switch Theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* 4 Navigation Tabs */}
      <nav className="mode-tabs five-tabs">
        <button 
          className={`tab-btn ${activeTab === 'explore' ? 'active' : ''}`}
          onClick={() => selectTab('explore')}
          aria-pressed={activeTab === 'explore'}
          title={t.tabExplore}
        >
          <Compass size={15} />
          <span>{t.tabExplore}</span>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'nearest' ? 'active' : ''}`}
          onClick={() => selectTab('nearest')}
          aria-pressed={activeTab === 'nearest'}
          title={t.tabNearest}
        >
          <Navigation size={15} />
          <span>{t.tabNearest}</span>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
          onClick={() => selectTab('planner')}
          aria-pressed={activeTab === 'planner'}
          title={t.tabPlanner}
        >
          <Route size={15} />
          <span>{t.tabPlanner}</span>
        </button>

        <button
          className={`tab-btn mobile-secondary-mode ${activeTab === 'multi' ? 'active' : ''}`}
          onClick={() => selectTab('multi')}
          aria-pressed={activeTab === 'multi'}
          title={t.tabMultiStop}
        >
          <ListOrdered size={15} />
          <span>{t.tabMultiStop}</span>
        </button>

        <div className={`mobile-more-modes ${moreModesOpen ? 'open' : ''}`}>
          <button
            type="button"
            className={`tab-btn mobile-more-trigger ${activeTab === 'multi' ? 'active' : ''}`}
            aria-expanded={moreModesOpen}
            aria-haspopup="menu"
            onClick={() => {
              setSheetExpanded(true);
              setMoreModesOpen(value => !value);
            }}
          >
            <MoreHorizontal size={18} />
            <span>{lang === 'ar' ? 'المزيد' : 'More'}</span>
          </button>
          {moreModesOpen && (
            <div className="mobile-more-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { selectTab('multi'); setMoreModesOpen(false); }}>
                <ListOrdered size={16} />
                <span>{t.tabMultiStop}</span>
              </button>
            </div>
          )}
        </div>
      </nav>
      </div>

      {/* TAB 1: EXPLORE */}
      {activeTab === 'explore' && (
        <>
          <section className="search-section">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
              />
              {searchQuery && (
                <button 
                  className="clear-search-btn" 
                  onClick={() => setSearchQuery('')}
                  title="Clear"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="filter-chips">
              {[
                { id: 'ALL', label: t.all },
                { id: 'BRT', label: t.brt },
                { id: 'Metro', label: t.metro },
                { id: 'Minibus', label: t.minibus },
                { id: 'Bus', label: t.bus },
                { id: 'Microbus', label: t.microbus },
                { id: 'Tomnaya', label: t.tomnaya }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={vehicleFilter === f.id}
                  className={`chip ${vehicleFilter === f.id ? 'active' : ''}`}
                  style={f.id !== 'ALL' ? { '--dot': VEHICLE_COLORS[f.id] } : undefined}
                  onClick={() => setVehicleFilter(f.id)}
                >
                  {f.id !== 'ALL' && (
                    <span className="chip-dot" style={{ '--dot': VEHICLE_COLORS[f.id] }} aria-hidden="true"></span>
                  )}
                  {f.label}
                </button>
              ))}
            </div>
            {brtUnavailable && <p className="journey-data-notice">{lang === 'ar' ? 'تعذر تحميل بيانات الأتوبيس الترددي؛ بقية شبكة النقل متاحة.' : 'BRT data could not be loaded; the rest of the transit network is available.'}</p>}

          </section>

          <div className="results-header">
            <span className="results-count">{t.resultsCount(filteredRoutes.length)}</span>
          <span className="phase-tag">{lang === 'ar' ? 'مترو · BRT · أتوبيس · ميني باص · ميكروباص' : 'Metro · BRT · Bus · Minibus · Microbus'}</span>
          </div>

          <div className="routes-container">
            {filteredRoutes.length === 0 ? (
              <div className="empty-state">
                <p>{t.noResults}</p>
              </div>
            ) : (
              filteredRoutes.slice(0, 100).map(r => {
                const isSelected = selectedRoute && selectedRoute.id === r.id;
                const isMetro = r.vehicle === 'Metro';
                const color = r.color || VEHICLE_COLORS[r.vehicle] || VEHICLE_COLORS.Default;
                const title = lang === 'ar' ? (r.long_ar || r.long_en) : (r.long_en || r.long_ar);
                const dirText = r.dir === 0 ? t.dirOutbound : t.dirInbound;
                const shortTitle = compactRouteTitle(r, lang) || title;
                const vehicleText = t[String(r.vehicle).toLowerCase()] || r.vehicle;

                return (
                  <div
                    key={r.id}
                    className={`route-card ${isSelected ? 'selected' : ''}`}
                    style={{ '--card-color': color }}
                    data-vehicle={r.vehicle}
                    tabIndex={0}
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => { onSelectRoute(r); setSheetExpanded(false); }}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSelectRoute(r);
                        setSheetExpanded(false);
                      }
                    }}
                  >
                    <div className="route-row-main">
                      <span className="route-num-badge">{lineLabel(r, lang)}</span>
                      <div className="route-row-text">
                        <h4 className="route-card-title" title={title}>
                          <RouteEnds route={r} lang={lang} fallback={shortTitle} />
                        </h4>
                        <span className="route-row-meta">
                          {vehicleText} · {r.len_km} {t.kmUnit} · {dirText}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <>
                        {!getRouteEnds(r, lang).to && shortTitle !== title && <p className="route-full-title">{title}</p>}
                        {r.via_stops && r.via_stops.length > 0 && (
                          <div className="route-via-stops" title={r.via_stops.join(' • ')}>
                            <span className="via-label">
                              {isMetro ? (lang === 'ar' ? 'محطات المترو:' : 'Stations:') : (lang === 'ar' ? 'يمر بـ:' : 'Via:')}
                            </span>
                            <span className="via-stops-text">
                              {r.via_stops.slice(0, 4).join(' • ')}
                              {r.via_stops.length > 4 ? ` (+${r.via_stops.length - 4})` : ''}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {isSelected && (
                      <div className="route-card-expanded-actions">
                        {r.via_stops && r.via_stops.length > 0 && (
                          <div className="route-stops-expand-section">
                            <button
                              type="button"
                              className="btn-toggle-all-stops"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedStopsRouteId(expandedStopsRouteId === r.id ? null : r.id);
                              }}
                            >
                              <ListOrdered size={12} />
                              <span>
                                {expandedStopsRouteId === r.id
                                  ? (lang === 'ar' ? 'إخفاء محطات المسار' : 'Hide intermediate stops')
                                  : (lang === 'ar' ? `محطات المسار بالترتيب (${r.via_stops.length} محطة)` : `Route stops in sequence (${r.via_stops.length})`)}
                              </span>
                              {expandedStopsRouteId === r.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>

                            {expandedStopsRouteId === r.id && (
                              <div className="route-stops-sequence-list route-stop-timeline" onClick={(e) => e.stopPropagation()}>
                                {r.via_stops.map((stopName, idx) => (
                                  <div key={idx} className="stop-sequence-item">
                                    <span className="stop-seq-idx">{idx + 1}</span>
                                    <span className="stop-seq-name">{stopName}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <button 
                          type="button" 
                          className="btn-select-line-for-nearest"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLineForNearest(r);
                            setActiveTab('nearest');
                          }}
                        >
                          <Navigation size={13} />
                          <span>{lang === 'ar' ? 'أقرب نزول على هذا الخط' : 'Nearest drop on this line'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </>
      )}

      {/* TAB 2: NEAREST DROP POINT */}
      {activeTab === 'nearest' && (
        <div className="nearest-tab-container">
          <div className="destination-banner">
            <div className="banner-icon">
              <MapPin size={22} />
            </div>
            <div>
              <h3 className="banner-title">{t.nearestBannerTitle}</h3>
              <p className="banner-sub">{t.nearestBannerSub}</p>
            </div>
          </div>

          {targetCoord && (
            <div className="active-target-badge">
              <div className="target-badge-info">
                <span className="target-dot"></span>
                <span>
                  {t.destinationTarget}: {targetCoord[0].toFixed(4)}, {targetCoord[1].toFixed(4)}
                </span>
              </div>
              <button 
                className="btn-clear-target"
                onClick={() => {
                  setTargetCoord(null);
                  setActiveNearest(null);
                }}
              >
                {t.clearTarget}
              </button>
            </div>
          )}

          {/* Specific Line Selector Box */}
          <div className={`specific-line-box ${lineSelectorExpanded ? 'line-selector-expanded' : ''}`}>
            <button
              type="button"
              className="mobile-line-selector-toggle"
              aria-expanded={lineSelectorExpanded}
              onClick={() => setLineSelectorExpanded(value => !value)}
            >
              <span>
                {selectedLineForNearest
                  ? `${lang === 'ar' ? 'الخط المحدد' : 'Selected line'}: ${lineLabel(selectedLineForNearest, lang)}`
                  : (lang === 'ar' ? 'اختيار خط محدد (اختياري)' : 'Choose a specific line (optional)')}
              </span>
              {lineSelectorExpanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            <div className="specific-line-content">
            <div className="specific-line-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bus size={15} style={{ color: 'var(--accent-cyan)' }} />
                <span className="specific-line-title">
                  {lang === 'ar' ? 'مقيد بخط معين؟ حدد الخط لمعرفة أقرب نزول عليه:' : 'Limited to a specific line? Select it here:'}
                </span>
              </div>
              {selectedLineForNearest && (
                <button 
                  type="button"
                  className="btn-text-clear"
                  onClick={() => setSelectedLineForNearest(null)}
                >
                  {lang === 'ar' ? 'إلغاء والبحث في كل الخطوط' : 'Clear & search all'}
                </button>
              )}
            </div>

            {selectedLineForNearest ? (
              <div 
                className="chosen-line-active-pill"
                data-vehicle={selectedLineForNearest.vehicle}
                style={{ '--card-color': VEHICLE_COLORS[selectedLineForNearest.vehicle] || VEHICLE_COLORS.Default }}
              >
                <div className="chosen-line-meta">
                  <span className="route-num-badge">{lineLabel(selectedLineForNearest, lang)}</span>
                  <span className="chosen-line-name">
                    {lang === 'ar' 
                      ? (selectedLineForNearest.long_ar || `${selectedLineForNearest.origin} ← ${selectedLineForNearest.dest}`) 
                      : (selectedLineForNearest.long_en || `${selectedLineForNearest.origin} → ${selectedLineForNearest.dest}`)}
                  </span>
                </div>
                <button 
                  type="button"
                  className="btn-remove-chosen-line"
                  onClick={() => setSelectedLineForNearest(null)}
                  title={lang === 'ar' ? 'إلغاء هذا الخط' : 'Remove line'}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="line-picker-input-wrap">
                <Search size={14} className="line-picker-icon" />
                <input 
                  type="text"
                  placeholder={lang === 'ar' ? 'ابحث برقم الخط (مثل 305، 204، M5) أو المحطة...' : 'Search by line number (e.g. 305, 204) or station...'}
                  value={lineSearchQuery}
                  onChange={(e) => setLineSearchQuery(e.target.value)}
                />
                {lineSearchQuery && (
                  <button 
                    type="button" 
                    className="btn-clear-input"
                    onClick={() => setLineSearchQuery('')}
                  >
                    <X size={13} />
                  </button>
                )}

                {/* Quick button to use current selected route if any */}
                {!lineSearchQuery && selectedRoute && (
                  <div className="quick-use-current-wrap">
                    <button
                      type="button"
                      className="btn-quick-use-route"
                      onClick={() => { setSelectedLineForNearest(selectedRoute); setLineSelectorExpanded(false); }}
                    >
                      <span>{lang === 'ar' ? `استخدم الخط النشط: خط ${lineLabel(selectedRoute, lang)}` : `Use active line: ${lineLabel(selectedRoute, lang)}`}</span>
                    </button>
                  </div>
                )}

                {lineSearchQuery.trim().length > 0 && (
                  <div className="line-dropdown-suggestions">
                    {matchingLineSuggestions.length === 0 ? (
                      <div className="dropdown-no-results">
                        {lang === 'ar' ? 'لم يتم العثور على خط يطابق بحثك' : 'No matching line found'}
                      </div>
                    ) : (
                      matchingLineSuggestions.map(r => (
                        <div 
                          key={r.id} 
                          className="line-dropdown-item"
                          onClick={() => {
                            setSelectedLineForNearest(r);
                            setLineSelectorExpanded(false);
                            if (onSelectRoute) onSelectRoute(r);
                            setLineSearchQuery('');
                          }}
                        >
                          <span 
                            className="route-num-badge"
                            data-vehicle={r.vehicle}
                            style={{ background: VEHICLE_COLORS[r.vehicle] || VEHICLE_COLORS.Default }}
                          >
                            {lineLabel(r, lang)}
                          </span>
                          <span className="line-dropdown-title">
                            {lang === 'ar' ? (r.long_ar || `${r.origin} ← ${r.dest}`) : (r.long_en || `${r.origin} → ${r.dest}`)}
                          </span>
                          <span className="line-dropdown-vehicle">{r.vehicle}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>

          {/* Category Filter Chips Bar - ALWAYS VISIBLE when not locked to a specific line */}
          {!selectedLineForNearest && (
            <div className="nearest-filter-section" style={{ margin: '10px 0 6px', padding: '0 2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Filter size={13} style={{ color: 'var(--accent-cyan)' }} />
                  <span>{lang === 'ar' ? 'تصنيف وسيلة المواصلات:' : 'Vehicle Category:'}</span>
                </span>
                {nearestVehicleFilter !== 'ALL' && (
                  <button
                    type="button"
                    className="btn-text-clear"
                    onClick={() => setNearestVehicleFilter('ALL')}
                    style={{ fontSize: '11.5px', color: 'var(--accent-cyan)' }}
                  >
                    {lang === 'ar' ? 'عرض الكل' : 'Reset to All'}
                  </button>
                )}
              </div>

              <div className="nearest-category-chips-bar">
                {[
                  { id: 'ALL', label: t.categoryAll, dot: null, count: nearestCategoryCounts.ALL },
                  { id: 'BRT', label: t.categoryBrt, dot: VEHICLE_COLORS.BRT, count: nearestCategoryCounts.BRT },
                  { id: 'Minibus', label: t.categoryMinibus, dot: VEHICLE_COLORS.Minibus, count: nearestCategoryCounts.Minibus },
                  { id: 'Microbus', label: t.categoryMicrobus, dot: VEHICLE_COLORS.Microbus, count: nearestCategoryCounts.Microbus },
                  { id: 'Bus', label: t.categoryBus, dot: VEHICLE_COLORS.Bus, count: nearestCategoryCounts.Bus },
                  { id: 'Metro', label: t.categoryMetro, dot: VEHICLE_COLORS.Metro, count: nearestCategoryCounts.Metro }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={nearestVehicleFilter === cat.id}
                    className={`nearest-cat-chip ${nearestVehicleFilter === cat.id ? 'active' : ''}`}
                    onClick={() => setNearestVehicleFilter(cat.id)}
                  >
                    {cat.dot && (
                      <span 
                        className="chip-dot" 
                        style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '2px', 
                          background: cat.dot, 
                          display: 'inline-block',
                          flexShrink: 0 
                        }} 
                        aria-hidden="true"
                      />
                    )}
                    <span>{cat.label}</span>
                    {targetCoord && nearestResults && nearestResults.length > 0 && cat.count !== undefined && (
                      <span className="cat-count-badge">
                        {cat.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="nearest-results-list">
            {selectedLineForNearest ? (
              // Specific line chosen mode
              !targetCoord ? (
                <div className="empty-state">
                  <Bus size={42} style={{ opacity: 0.5, color: 'var(--accent-cyan)' }} />
                  <h4 style={{ color: 'var(--text-primary)', margin: '8px 0 4px', fontSize: '13px', fontWeight: '800' }}>
                    {lang === 'ar' 
                      ? `تم تحديد خط ${lineLabel(selectedLineForNearest, lang)}` 
                      : `Line ${lineLabel(selectedLineForNearest, lang)} selected`}
                  </h4>
                  <p>
                    {lang === 'ar' 
                      ? 'حدد وجهتك الآن بالضغط على الخريطة أو ألصق الرابط بالأعلى لنحدد لك أقرب نقطة نزول على هذا الخط بالضبط.' 
                      : 'Now select your destination on the map or paste a link above to find the exact drop point on this line.'}
                  </p>
                </div>
              ) : selectedLineDrop ? (
                <div className="chosen-line-container">
                  <div 
                    className="chosen-line-result-card"
                    data-vehicle={selectedLineForNearest.vehicle}
                    style={{ '--card-color': VEHICLE_COLORS[selectedLineForNearest.vehicle] || VEHICLE_COLORS.Default }}
                  >
                    <div className="chosen-result-top">
                      <div className="badge-group">
                        <span className="route-num-badge">{lineLabel(selectedLineForNearest, lang)}</span>
                        <span className="route-vehicle-badge">{selectedLineForNearest.vehicle}</span>
                      </div>
                      <span className="chosen-line-highlight-tag">
                        {lang === 'ar' ? 'أقرب نزول لخطك المختار' : 'Nearest drop for chosen line'}
                      </span>
                    </div>

                    <h4 className="chosen-result-title">
                      {lang === 'ar' 
                        ? (selectedLineForNearest.long_ar || `${selectedLineForNearest.origin} ← ${selectedLineForNearest.dest}`) 
                        : (selectedLineForNearest.long_en || `${selectedLineForNearest.origin} → ${selectedLineForNearest.dest}`)}
                    </h4>

                    <div className="chosen-drop-metrics">
                      <div className="metric-pill dist">
                        <Footprints size={14} />
                        <span>{t.walkDistance(selectedLineDrop.distanceMeters)}</span>
                      </div>
                      <div className="metric-pill time">
                        <Clock size={14} />
                        <span>{t.walkTime(selectedLineDrop.walkMinutes)}</span>
                      </div>
                      {selectedLineDrop.nearestStop && (
                        <div className="metric-pill stop">
                          <MapPin size={12} />
                          <span>{t.nearKnownStop(lang === 'ar' ? selectedLineDrop.nearestStop.ar : selectedLineDrop.nearestStop.en)}</span>
                        </div>
                      )}
                    </div>

                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&origin=${selectedLineDrop.dropCoord[0]},${selectedLineDrop.dropCoord[1]}&destination=${targetCoord[0]},${targetCoord[1]}&travelmode=walking`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-google-maps-walk main-btn"
                      title={lang === 'ar' ? 'فتح اتجاهات المشي على Google Maps' : 'Open walking directions in Google Maps'}
                    >
                      <span>{lang === 'ar' ? 'اتجاهات المشي من نقطة النزول' : 'Walking directions from drop-off'}</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>

                  {/* Alternative lines accordion */}
                  <div className="alternatives-section">
                    <button 
                      type="button"
                      className="btn-toggle-alternatives"
                      onClick={() => setShowOtherNearbyLines(!showOtherNearbyLines)}
                    >
                      <span>
                        {showOtherNearbyLines 
                          ? (lang === 'ar' ? 'إخفاء الخطوط البديلة' : 'Hide alternative lines') 
                          : (lang === 'ar' ? `قارن بخطوط أخرى قريبة (${nearestResults.length})` : `Compare with other nearby lines (${nearestResults.length})`)}
                      </span>
                      {showOtherNearbyLines ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                    </button>

                    {showOtherNearbyLines && (
                      <div className="alternatives-list">
                        {nearestResults
                          .filter(item => item.route.id !== selectedLineForNearest.id)
                          .map((item, idx) => {
                            const r = item.route;
                            const isSelected = activeNearest && activeNearest.route.id === r.id;
                            const color = VEHICLE_COLORS[r.vehicle] || VEHICLE_COLORS.Default;
                            const title = lang === 'ar' ? (r.long_ar || r.long_en) : (r.long_en || r.long_ar);
                            const googleMapsWalkUrl = targetCoord 
                              ? `https://www.google.com/maps/dir/?api=1&origin=${item.dropCoord[0]},${item.dropCoord[1]}&destination=${targetCoord[0]},${targetCoord[1]}&travelmode=walking`
                              : null;

                            return (
                              <div
                                key={r.id + '-' + idx}
                                className={`nearest-card ${isSelected ? 'selected' : ''}`}
                        data-vehicle={r.vehicle}
                                style={{ '--card-color': color }}
                                onClick={() => {
                                  setActiveNearest(item);
                                  onSelectRoute(r);
                                  setSheetExpanded(false);
                                }}
                              >
                                <div className="nearest-card-header">
                                  <div className="badge-group">
                                    <span className="route-num-badge">{lineLabel(r, lang)}</span>
                                    <span className="route-vehicle-badge">{r.vehicle}</span>
                                  </div>
                                  <div className="walk-distance-pill">
                                    <Footprints size={13} />
                                    <span>{t.walkDistance(item.distanceMeters)}</span>
                                  </div>
                                </div>

                                <h4 className="route-card-title"><RouteEnds route={r} lang={lang} fallback={title} /></h4>
                                {r.vehicle === 'BRT' && <p className="journey-data-notice">{lang === 'ar' ? 'موقع المحطة تقديري؛ مدخلها غير متحقق.' : 'Station location is approximate; entrance is unverified.'}</p>}

                                <div className="nearest-card-footer">
                                  <span className="walk-time-badge">
                                    <Clock size={13} aria-hidden="true" />{t.walkTime(item.walkMinutes)}
                                  </span>
                                  {item.nearestStop && (
                                    <span className="known-stop-badge">
                                      <MapPin size={13} aria-hidden="true" />{t.nearKnownStop(lang === 'ar' ? item.nearestStop.ar : item.nearestStop.en)}
                                    </span>
                                  )}
                                </div>

                                {googleMapsWalkUrl && (
                                  <a 
                                    href={googleMapsWalkUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-google-maps-walk"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span>{lang === 'ar' ? 'ملاحة المشي على Google Maps' : 'Walk in Google Maps'}</span>
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null
            ) : (
              // Default mode: all lines search
              !targetCoord ? (
                <div className="empty-state">
                  <Footprints size={44} style={{ opacity: 0.4 }} />
                  <p>{lang === 'ar' ? 'اختر مكاناً من البحث أو الخريطة لعرض الخطوط القريبة منه' : 'Choose a place from search or the map to see nearby routes'}</p>
                </div>
              ) : nearestLoading ? (
                <div className="empty-state" role="status">
                  <Loader2 size={28} className="spin-icon" />
                  <p>{lang === 'ar' ? 'جاري البحث عن أقرب الخطوط...' : 'Finding the nearest lines...'}</p>
                </div>
              ) : displayedNearest.length === 0 ? (
                <div className="empty-state">
                  <p>
                    {lang === 'ar' ? 'لا توجد خطوط تطابق التصنيف المختار ضمن هذا النطاق' : 'No lines match the selected category within range'}
                  </p>
                  {nearestVehicleFilter !== 'ALL' && (
                    <button
                      type="button"
                      className="btn-retry"
                      style={{ 
                        marginTop: '10px', 
                        padding: '6px 14px', 
                        borderRadius: '8px', 
                        background: 'var(--bg-elevated)', 
                        border: '1px solid var(--border-strong)', 
                        color: 'var(--text-primary)', 
                        cursor: 'pointer', 
                        fontSize: '12px' 
                      }}
                      onClick={() => setNearestVehicleFilter('ALL')}
                    >
                      {lang === 'ar' ? 'عرض جميع الفئات والخطوط' : 'Show all vehicle categories'}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="results-header" style={{ padding: '8px 4px' }}>
                    <span className="results-count">
                      {t.nearestFoundTitle(displayedNearest.length)}
                    </span>
                  </div>

                  {displayedNearest.map((item, idx) => {
                      const r = item.route;
                      const isSelected = activeNearest && activeNearest.route.id === r.id;
                      const color = VEHICLE_COLORS[r.vehicle] || VEHICLE_COLORS.Default;
                      const title = lang === 'ar' ? (r.long_ar || r.long_en) : (r.long_en || r.long_ar);
                      const googleMapsWalkUrl = targetCoord 
                        ? `https://www.google.com/maps/dir/?api=1&origin=${item.dropCoord[0]},${item.dropCoord[1]}&destination=${targetCoord[0]},${targetCoord[1]}&travelmode=walking`
                        : null;

                      return (
                        <div
                          key={r.id + '-' + idx}
                          className={`nearest-card ${isSelected ? 'selected' : ''}`}
                          data-vehicle={r.vehicle}
                          style={{ '--card-color': color }}
                          onClick={() => {
                            setActiveNearest(item);
                            onSelectRoute(r);
                            setSheetExpanded(false);
                          }}
                        >
                          <div className="nearest-card-header">
                            <div className="badge-group">
                              <span className="route-num-badge">{lineLabel(r, lang)}</span>
                              <span className="route-vehicle-badge">{r.vehicle}</span>
                            </div>
                            <div className="walk-distance-pill">
                              <Footprints size={13} />
                              <span>
                                {t.walkDistance(item.distanceMeters)}
                              </span>
                            </div>
                          </div>

                          <h4 className="route-card-title"><RouteEnds route={r} lang={lang} fallback={title} /></h4>
                          {r.vehicle === 'BRT' && <p className="journey-data-notice">{lang === 'ar' ? 'موقع المحطة تقديري؛ مدخلها غير متحقق.' : 'Station location is approximate; entrance is unverified.'}</p>}

                          <div className="nearest-card-footer">
                            <span className="walk-time-badge">
                              <Clock size={13} aria-hidden="true" />
                              {t.walkTime(item.walkMinutes)}
                            </span>
                            {item.nearestStop && (
                              <span className="known-stop-badge">
                                <MapPin size={13} aria-hidden="true" />{t.nearKnownStop(lang === 'ar' ? item.nearestStop.ar : item.nearestStop.en)}
                              </span>
                            )}
                          </div>

                          {googleMapsWalkUrl && (
                            <a 
                              href={googleMapsWalkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-google-maps-walk"
                              onClick={(e) => e.stopPropagation()}
                              title={lang === 'ar' ? 'فتح اتجاهات المشي على Google Maps' : 'Open walking directions in Google Maps'}
                            >
                              <span>{lang === 'ar' ? 'ملاحة المشي على Google Maps' : 'Walk in Google Maps'}</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </>
              )
            )}
          </div>
        </div>
      )}

      {/* TAB 3: JOURNEY PLANNER */}
      {activeTab === 'planner' && (
        <div className="planner-tab-container">
          <div className="planner-banner">
            <h3 className="banner-title">{t.plannerBannerTitle}</h3>
            <p className="banner-sub">{t.plannerBannerSub}</p>
          </div>
          <div className="filter-chips" role="group" aria-label={t.multiVehicleFilter}>
            {[
              { id: 'ALL', label: t.all }, { id: 'Metro', label: t.metro },
              { id: 'Minibus', label: t.minibus }, { id: 'Bus', label: t.bus },
              { id: 'Microbus', label: t.microbus }, { id: 'Tomnaya', label: t.tomnaya }
            ].map(filter => <button key={filter.id} type="button" className={`chip ${planningVehicle === filter.id ? 'active' : ''}`}
              aria-pressed={planningVehicle === filter.id} onClick={() => setVehicleFilter(filter.id)}>
              {filter.id !== 'ALL' && <span className="chip-dot" style={{ '--dot': VEHICLE_COLORS[filter.id] }} aria-hidden="true" />}
              {filter.label}
            </button>)}
          </div>

          <div className="planner-inputs-card">
            <div className="planner-input-row">
              <span className="point-indicator origin">أ</span>
              <div 
                className={`coord-selector-box ${plannerSelecting === 'origin' ? 'selecting' : ''}`}
                onClick={() => setPlannerSelecting('origin')}
              >
                <div className="coord-text-group">
                  <span className="coord-label">{t.originLabel}</span>
                  <span className="coord-value">
                    {originCoord ? `${originCoord[0].toFixed(4)}, ${originCoord[1].toFixed(4)}` : t.clickToSetOrigin}
                  </span>
                </div>
                {originCoord && (
                  <button 
                    className="clear-coord-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setOriginCoord(null);
                      setPlannerSelecting('origin');
                    }}
                    title={lang === 'ar' ? 'مسح البداية' : 'Clear Origin'}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="swap-row">
              <button className="swap-btn" onClick={onSwapPoints} title={t.swapPointsBtn}>
                <ArrowUpDown size={15} />
              </button>
            </div>

            <div className="planner-input-row">
              <span className="point-indicator dest">ب</span>
              <div 
                className={`coord-selector-box ${plannerSelecting === 'dest' ? 'selecting' : ''}`}
                onClick={() => setPlannerSelecting('dest')}
              >
                <div className="coord-text-group">
                  <span className="coord-label">{t.destLabel}</span>
                  <span className="coord-value">
                    {destCoord ? `${destCoord[0].toFixed(4)}, ${destCoord[1].toFixed(4)}` : t.clickToSetDest}
                  </span>
                </div>
                {destCoord && (
                  <button 
                    className="clear-coord-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDestCoord(null);
                      setPlannerSelecting('dest');
                    }}
                    title={lang === 'ar' ? 'مسح الوجهة' : 'Clear Destination'}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="planner-location-section" style={{ margin: '8px 0 10px' }}>
            <div className="preset-chips-grid">
              <button
                type="button"
                className={`landmark-chip my-location-chip ${originFromLocation ? 'locating' : ''}`}
                onClick={() => {
                  if (userCoord) {
                    setOriginCoord(userCoord);
                    setPlannerSelecting(destCoord ? null : 'dest');
                  } else {
                    setOriginFromLocation(true);
                    if (onLocate) onLocate();
                  }
                }}
              >
                <LocateFixed size={13} />
                <span>{originFromLocation
                  ? (lang === 'ar' ? 'جاري تحديد موقعك…' : 'Finding you…')
                  : (lang === 'ar' ? 'انطلق من موقعي الحالي' : 'Start from my location')}</span>
              </button>
            </div>
          </div>

          <div className="planner-results-container">
            {!originCoord || !destCoord ? (
              <div className="empty-state">
                <Route size={40} style={{ opacity: 0.35 }} />
                <p>
                  {plannerSelecting === 'origin' 
                    ? t.pickOriginPrompt 
                    : plannerSelecting === 'dest' 
                    ? t.pickDestPrompt 
                    : "حدد نقطة البداية ونقطة الوصول على الخريطة لعرض مسارات الرحلة"}
                </p>
              </div>
            ) : planLoading && !plannedJourneys?.directRoutes?.length ? (
              <div className="empty-state" role="status">
                <Loader2 size={28} className="spin-icon" />
                <p>{lang === 'ar' ? 'جاري البحث عن أفضل الخطوط...' : 'Finding the best routes...'}</p>
              </div>
            ) : (
              <>
                {planLoading && plannedJourneys?.directRoutes?.length > 0 && <div className="empty-state" role="status">
                  <Loader2 size={18} className="spin-icon" />
                  <p>{lang === 'ar' ? 'المسارات المباشرة جاهزة، جارٍ البحث عن التحويلات...' : 'Direct routes are ready; finding transfers…'}</p>
                </div>}
                {planError ? <div className="empty-state" role="alert"><p>{t.journeyLoadError}</p><button type="button" onClick={onRetryPlan}>{t.journeyRetry}</button></div> : null}
                {!planError && journeyGroups.map(group => {
                  const visible = group.journeys.slice(0, 3);
                  const remaining = group.journeys.slice(3);
                  return <section className={`journey-option-group journey-option-group-${group.key}`} key={group.key}>
                    <h4>{group.title(group.journeys.length)}</h4>
                    {visible.map(renderJourneyCard)}
                    {remaining.length > 0 && <details className="journey-more-options"><summary>{t.showMoreOptions(remaining.length)}</summary>{remaining.map(renderJourneyCard)}</details>}
                  </section>;
                })}
                {!planError && journeyGroups.length > 0 && <p className="journey-panel-notices">{t.journeyWalkNotice} {t.journeyServiceNotice}</p>}
                {!planError && !plannedJourneys.directRoutes?.length && !plannedJourneys.transferRoutes?.length && <div className="empty-state">
                  <p>{plannedJourneys.status === 'no-nearby-stops' ? (lang === 'ar' ? 'لا توجد محطات قريبة بما يكفي من إحدى النقطتين.' : 'No transit stops are close enough to one of the points.') : t.noTripsFound}</p>
                </div>}
              </>
            )}
          </div>
          <FeedbackEntry lang={lang} className="planner-feedback-entry" />
        </div>
      )}

      {activeTab === 'multi' && multiStopProps && (
        <MultiStopPlanner {...multiStopProps}
          onPickPoint={id => { multiStopProps.onPickPoint?.(id); setSheetExpanded(false); }}
          onShowMap={() => setSheetExpanded(false)} lang={lang} t={t} />
      )}

    </aside>
  );
}
