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
  Sparkles,
  Users,
  Link2,
  ExternalLink,
  Loader2,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info
} from 'lucide-react';
// Chat assistant is "coming soon". The previous implementation is kept in
// ./ChatAssistant.jsx; re-import it here when the new chatbot is ready.
// Community hub is "coming soon". The previous implementation is kept in
// ./CommunityHub.jsx; re-import it here when it's ready.
import { VEHICLE_COLORS } from '../utils/i18n';
import { resolveLocationInput } from '../utils/geoUtils';
import { expandSearchQuery, routeMatchesTokens } from '../utils/transitAliases';


// Preset famous landmarks in Cairo
const PRESET_DESTINATIONS = [
  { name_ar: "جامعة القاهرة (الجيزة)", name_en: "Cairo University", coord: [30.0263, 31.2114] },
  { name_ar: "ميدان التحرير (وسط البلد)", name_en: "Tahrir Square", coord: [30.0444, 31.2357] },
  { name_ar: "سيتي ستارز (مدينة نصر)", name_en: "City Stars (Nasr City)", coord: [30.0731, 31.3458] },
  { name_ar: "ميدان روكسي (مصر الجديدة)", name_en: "Roxy Square", coord: [30.0936, 31.3144] },
  { name_ar: "كايرو فيستيفال سيتي (التجمع)", name_en: "Cairo Festival City", coord: [30.0298, 31.4074] },
  { name_ar: "محطة قطارات رمسيس", name_en: "Ramses Station", coord: [30.0622, 31.2468] },
  { name_ar: "دوران شبرا", name_en: "Dawaran Shubra", coord: [30.0825, 31.2461] },
  { name_ar: "مساكن شيراتون (النزهة)", name_en: "Masaken Sheraton", coord: [30.1062, 31.3855] }
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  vehicleFilter,
  setVehicleFilter,
  routes,
  filteredRoutes,
  selectedRoute,
  onSelectRoute,
  // Phase 2 props
  targetCoord,
  setTargetCoord,
  nearestResults,
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
  activeJourney,
  setActiveJourney,
  onSwapPoints,
  lang,
  setLang,
  theme,
  setTheme,
  t
}) {
  // Phone layout: the sidebar becomes a bottom sheet over the map.
  // It collapses when a result is picked so the map is visible, and
  // expands when the user switches mode. (No effect on desktop CSS.)
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setSheetExpanded(false);
  }, [selectedRoute?.id, activeJourney, activeNearest?.route?.id]);
  const selectTab = (tab) => {
    setActiveTab(tab);
    setSheetExpanded(true);
  };

  // Location link input state for Nearest Drop tab
  const [linkInput, setLinkInput] = useState('');
  const [isResolvingLink, setIsResolvingLink] = useState(false);
  const [linkError, setLinkError] = useState(null);

  // Specific line selector state for Nearest Drop tab
  const [lineSearchQuery, setLineSearchQuery] = useState('');
  const [showOtherNearbyLines, setShowOtherNearbyLines] = useState(false);
  const [expandedStopsRouteId, setExpandedStopsRouteId] = useState(null);

  const matchingLineSuggestions = React.useMemo(() => {
    if (!lineSearchQuery.trim()) return [];
    const tokens = expandSearchQuery(lineSearchQuery);
    return routes.filter(r => routeMatchesTokens(r, tokens)).slice(0, 8);
  }, [lineSearchQuery, routes]);


  const handleApplyLocationLink = async (e) => {
    if (e) e.preventDefault();
    if (!linkInput.trim()) return;

    setIsResolvingLink(true);
    setLinkError(null);

    try {
      const res = await resolveLocationInput(linkInput.trim());
      if (res.coord) {
        setTargetCoord(res.coord);
        setActiveNearest(null);
        setLinkError(null);
      } else {
        setLinkError(
          res.error ||
          (lang === 'ar'
            ? 'تعذر استخراج الإحداثيات من هذا الرابط'
            : 'Could not extract coordinates from link')
        );
      }
    } catch (err) {
      setLinkError(
        lang === 'ar'
          ? 'حدث خطأ أثناء فحص الرابط'
          : 'Error occurred while processing location'
      );
    } finally {
      setIsResolvingLink(false);
    }
  };

  return (
    <aside className={`sidebar ${sheetExpanded ? 'sheet-expanded' : 'sheet-collapsed'}`}>
      <button
        type="button"
        className="sheet-handle"
        onClick={() => setSheetExpanded(v => !v)}
        aria-expanded={sheetExpanded}
        aria-label={sheetExpanded ? (lang === 'ar' ? 'تصغير اللوحة' : 'Collapse panel') : (lang === 'ar' ? 'توسيع اللوحة' : 'Expand panel')}
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

      {/* 5 Navigation Tabs (All Phases) */}
      <nav className="mode-tabs five-tabs">
        <button 
          className={`tab-btn ${activeTab === 'explore' ? 'active' : ''}`}
          onClick={() => selectTab('explore')}
          aria-pressed={activeTab === 'explore'}
          title="الخطوط"
        >
          <Compass size={15} />
          <span>الخطوط</span>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'nearest' ? 'active' : ''}`}
          onClick={() => selectTab('nearest')}
          aria-pressed={activeTab === 'nearest'}
          title="أقرب نزول"
        >
          <Navigation size={15} />
          <span>أقرب نزول</span>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
          onClick={() => selectTab('planner')}
          aria-pressed={activeTab === 'planner'}
          title="مخطط الرحلة"
        >
          <Route size={15} />
          <span>رحلة أ-ب</span>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => selectTab('chat')}
          aria-pressed={activeTab === 'chat'}
          title="المساعد الذكي"
        >
          <Sparkles size={15} />
          <span>المساعد الذكي</span>
          <span className="tab-pill-badge soon">{lang === 'ar' ? 'قريباً' : 'Soon'}</span>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'community' ? 'active' : ''}`}
          onClick={() => selectTab('community')}
          aria-pressed={activeTab === 'community'}
          title="مجتمع الركاب"
        >
          <Users size={15} />
          <span>المجتمع</span>
          <span className="tab-pill-badge soon">{lang === 'ar' ? 'قريباً' : 'Soon'}</span>
        </button>
      </nav>

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
                  onClick={() => setVehicleFilter(f.id)}
                >
                  {f.id !== 'ALL' && (
                    <span className="chip-dot" style={{ '--dot': VEHICLE_COLORS[f.id] }} aria-hidden="true"></span>
                  )}
                  {f.label}
                </button>
              ))}
            </div>

            <div className="preset-links">
              <span className="preset-label">{t.popularLabel}</span>
              {['مترو', '305', 'التجمع', 'AUC', 'الشهداء', 'شيراتون'].map(q => (
                <button 
                  key={q} 
                  className="preset-btn"
                  onClick={() => setSearchQuery(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </section>

          <div className="results-header">
            <span className="results-count">{t.resultsCount(filteredRoutes.length)}</span>
            <span className="phase-tag">{lang === 'ar' ? 'مترو · أتوبيس · ميني باص · ميكروباص' : 'Metro · Bus · Minibus · Microbus'}</span>
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

                return (
                  <div
                    key={r.id}
                    className={`route-card ${isSelected ? 'selected' : ''}`}
                    style={{ '--card-color': color }}
                    data-vehicle={r.vehicle}
                    tabIndex={0}
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => onSelectRoute(r)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSelectRoute(r);
                      }
                    }}
                  >
                    <div className="route-card-top">
                      <div className="badge-group">
                        <span className="route-num-badge">
                          {r.num || r.route_id}
                        </span>
                        <span className="route-vehicle-badge">
                          {t[String(r.vehicle).toLowerCase()] || r.vehicle}
                        </span>
                      </div>
                      <span className="route-dist-badge">{r.len_km} {t.kmUnit} • {dirText}</span>
                    </div>
                    <h4 className="route-card-title">{title}</h4>
                    <div className="route-terminals-flow">
                      <span>{r.origin}</span>
                      <span className="terminal-line" aria-hidden="true"></span>
                      <span>{r.dest}</span>
                    </div>

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
                              <div className="route-stops-sequence-list" onClick={(e) => e.stopPropagation()}>
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

          {/* Location link or coordinates input form */}
          <div className="location-link-box">
            <div className="link-box-header">
              <Link2 size={15} className="link-box-icon" />
              <span className="link-box-title">
                {lang === 'ar' ? 'ضع رابط موقعك أو إحداثيات المكان:' : 'Paste location link or coordinates:'}
              </span>
            </div>

            <form onSubmit={handleApplyLocationLink} className="link-input-row">
              <div className="link-input-field">
                <input 
                  type="text"
                  placeholder={
                    lang === 'ar'
                      ? 'رابط Google Maps أو إحداثيات (30.044, 31.235)...'
                      : 'Google Maps link or coordinates (30.044, 31.235)...'
                  }
                  value={linkInput}
                  onChange={(e) => {
                    setLinkInput(e.target.value);
                    if (linkError) setLinkError(null);
                  }}
                  disabled={isResolvingLink}
                />
                {linkInput && (
                  <button 
                    type="button" 
                    className="btn-clear-input"
                    onClick={() => {
                      setLinkInput('');
                      setLinkError(null);
                    }}
                    title={lang === 'ar' ? 'مسح' : 'Clear'}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <button 
                type="submit" 
                className="btn-apply-link" 
                disabled={isResolvingLink || !linkInput.trim()}
              >
                {isResolvingLink ? (
                  <Loader2 size={15} className="spin-icon" />
                ) : (
                  <>
                    <Navigation size={13} />
                    <span>{lang === 'ar' ? 'تحديد' : 'Locate'}</span>
                  </>
                )}
              </button>
            </form>

            {linkError && (
              <div className="link-error-alert">
                <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{linkError}</span>
              </div>
            )}

            <div className="link-hint">
              <Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: '3px' }} />
              <span>
                {lang === 'ar' 
                  ? 'يدعم روابط Google Maps وروابط المشاركة، أو كتابة الإحداثيات مباشرة' 
                  : 'Supports Google Maps URLs, share links, or latitude/longitude coordinates'}
              </span>
            </div>
          </div>

          <div className="landmark-presets">
            <span className="preset-label">أو اختر وجهة شهيرة:</span>
            <div className="preset-chips-grid">
              {PRESET_DESTINATIONS.slice(0, 6).map(p => (
                <button
                  key={p.name_en}
                  className="landmark-chip"
                  onClick={() => {
                    setTargetCoord(p.coord);
                    setLinkInput(`${p.coord[0].toFixed(4)}, ${p.coord[1].toFixed(4)}`);
                    setLinkError(null);
                  }}
                >
                  <MapPin size={12} />
                  <span>{lang === 'ar' ? p.name_ar : p.name_en}</span>
                </button>
              ))}
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
                  setLinkInput('');
                  setLinkError(null);
                }}
              >
                {t.clearTarget}
              </button>
            </div>
          )}

          {/* Specific Line Selector Box */}
          <div className="specific-line-box">
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
                  <span className="route-num-badge">{selectedLineForNearest.num || selectedLineForNearest.route_id}</span>
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
                      onClick={() => setSelectedLineForNearest(selectedRoute)}
                    >
                      <span>{lang === 'ar' ? `استخدم الخط النشط: خط ${selectedRoute.num || selectedRoute.route_id}` : `Use active line: ${selectedRoute.num || selectedRoute.route_id}`}</span>
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
                            if (onSelectRoute) onSelectRoute(r);
                            setLineSearchQuery('');
                          }}
                        >
                          <span 
                            className="route-num-badge"
                            data-vehicle={r.vehicle}
                            style={{ background: VEHICLE_COLORS[r.vehicle] || VEHICLE_COLORS.Default }}
                          >
                            {r.num || r.route_id}
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

          <div className="nearest-results-list">
            {selectedLineForNearest ? (
              // Specific line chosen mode
              !targetCoord ? (
                <div className="empty-state">
                  <Bus size={42} style={{ opacity: 0.5, color: 'var(--accent-cyan)' }} />
                  <h4 style={{ color: 'var(--text-primary)', margin: '8px 0 4px', fontSize: '13px', fontWeight: '800' }}>
                    {lang === 'ar' 
                      ? `تم تحديد خط ${selectedLineForNearest.num || selectedLineForNearest.route_id}` 
                      : `Line ${selectedLineForNearest.num || selectedLineForNearest.route_id} selected`}
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
                        <span className="route-num-badge">{selectedLineForNearest.num || selectedLineForNearest.route_id}</span>
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
                                }}
                              >
                                <div className="nearest-card-header">
                                  <div className="badge-group">
                                    <span className="route-num-badge">{r.num || r.route_id}</span>
                                    <span className="route-vehicle-badge">{r.vehicle}</span>
                                  </div>
                                  <div className="walk-distance-pill">
                                    <Footprints size={13} />
                                    <span>{t.walkDistance(item.distanceMeters)}</span>
                                  </div>
                                </div>

                                <h4 className="route-card-title">{title}</h4>

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
                  <p>حدد مكانك أو وجهتك على الخريطة ليتم احتساب أقرب نقاط النزول</p>
                </div>
              ) : nearestResults.length === 0 ? (
                <div className="empty-state">
                  <p>لا توجد خطوط تمر ضمن نطاق 2 كم من هذه النقطة</p>
                </div>
              ) : (
                <>
                  <div className="results-header" style={{ padding: '8px 4px' }}>
                    <span className="results-count">
                      {t.nearestFoundTitle(nearestResults.length)}
                    </span>
                  </div>

                  {nearestResults.map((item, idx) => {
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
                        }}
                      >
                        <div className="nearest-card-header">
                          <div className="badge-group">
                            <span className="route-num-badge">{r.num || r.route_id}</span>
                            <span className="route-vehicle-badge">{r.vehicle}</span>
                          </div>
                          <div className="walk-distance-pill">
                            <Footprints size={13} />
                            <span>{t.walkDistance(item.distanceMeters)}</span>
                          </div>
                        </div>

                        <h4 className="route-card-title">{title}</h4>

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

          <div className="planner-presets-section" style={{ margin: '8px 0 10px' }}>
            <span className="preset-label" style={{ fontSize: '11px', display: 'block', marginBottom: '6px' }}>
              {lang === 'ar' 
                ? (plannerSelecting === 'dest' ? 'أو اختر وجهة الوصول (ب) من المعالم:' : 'أو اختر نقطة الانطلاق (أ) من المعالم:') 
                : (plannerSelecting === 'dest' ? 'Or pick Destination (B) from landmarks:' : 'Or pick Origin (A) from landmarks:')}
            </span>
            <div className="preset-chips-grid">
              {PRESET_DESTINATIONS.slice(0, 6).map(p => (
                <button
                  key={p.name_en}
                  type="button"
                  className="landmark-chip"
                  onClick={() => {
                    if (plannerSelecting === 'dest' || (originCoord && !destCoord)) {
                      setDestCoord(p.coord);
                      setPlannerSelecting(null);
                    } else {
                      setOriginCoord(p.coord);
                      setPlannerSelecting('dest');
                    }
                  }}
                >
                  <MapPin size={12} />
                  <span>{lang === 'ar' ? p.name_ar : p.name_en}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="preset-trips-section">
            <span className="preset-label">رحلات تجريبية شائعة بنقرة واحدة:</span>
            <div className="preset-trips-list">
              <button 
                className="preset-trip-btn"
                onClick={() => {
                  setOriginCoord([30.0825, 31.2461]); // Dawaran Shubra
                  setDestCoord([30.1062, 31.3855]);   // Sheraton
                  setPlannerSelecting(null);
                }}
              >
                <span>دوران شبرا ← مساكن شيراتون</span>
                <span className="trip-tag">ميني باص 305</span>
              </button>

              <button 
                className="preset-trip-btn"
                onClick={() => {
                  setOriginCoord([30.0682, 31.2825]); // Abbasseya
                  setDestCoord([30.1583, 31.3021]);   // Khosous
                  setPlannerSelecting(null);
                }}
              >
                <span>العباسية ← الخصوص</span>
                <span className="trip-tag">أتوبيس 204</span>
              </button>

              <button 
                className="preset-trip-btn"
                onClick={() => {
                  setOriginCoord([30.0444, 31.2357]); // Tahrir
                  setDestCoord([30.0263, 31.2114]);   // Cairo Uni
                  setPlannerSelecting(null);
                }}
              >
                <span>التحرير ← جامعة القاهرة</span>
                <span className="trip-tag">خطوط الجيزة</span>
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
            ) : (
              <>
                {plannedJourneys.directRoutes && plannedJourneys.directRoutes.length > 0 && (
                  <div className="journey-section">
                    <div className="results-header" style={{ padding: '8px 4px' }}>
                      <span className="results-count">
                        {t.directFoundTitle(plannedJourneys.directRoutes.length)}
                      </span>
                    </div>

                    {plannedJourneys.directRoutes.map((journey, idx) => {
                      const r = journey.route;
                      const isSelected = activeJourney && activeJourney.type !== 'transfer' && activeJourney.route && activeJourney.route.id === r.id;
                      const color = VEHICLE_COLORS[r.vehicle] || VEHICLE_COLORS.Default;

                      return (
                        <div
                          key={r.id + '-' + idx}
                          className={`journey-card ${isSelected ? 'selected' : ''}`}
                          data-vehicle={r.vehicle}
                          style={{ '--card-color': color }}
                          onClick={() => {
                            setActiveJourney(journey);
                            onSelectRoute(r);
                          }}
                        >
                          <div className="journey-card-header">
                            <div className="badge-group">
                              <span className="route-num-badge">{r.num || r.route_id}</span>
                              <span className="direct-pill">{t.directBadge}</span>
                            </div>
                            <div className="time-badge">
                              <Clock size={12} />
                              <span>{t.totalTripTime(journey.totalTimeMinutes)}</span>
                            </div>
                          </div>

                          <h4 className="journey-route-title">
                            {lang === 'ar' ? (r.long_ar || r.long_en) : (r.long_en || r.long_ar)}
                          </h4>

                          <div className="itinerary-steps">
                            <div className="step-item">
                              <span className="step-icon walk" aria-hidden="true"><Footprints size={13} /></span>
                              <span>{t.stepWalkToBus(journey.walkToPickupMeters, journey.walkToPickupMinutes)}</span>
                            </div>
                            <div className="step-item">
                              <span className="step-icon bus" aria-hidden="true"><Bus size={13} /></span>
                              <span>{t.stepRideBus(r.num, journey.rideDistanceKm, journey.estRideMinutes)}</span>
                            </div>
                            <div className="step-item">
                              <span className="step-icon dest" aria-hidden="true"><MapPin size={12} /></span>
                              <span>{t.stepWalkToDest(journey.walkFromDropMeters, journey.walkFromDropMinutes)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {plannedJourneys.transferRoutes && plannedJourneys.transferRoutes.length > 0 && (
                  <div className="journey-section">
                    <div className="results-header" style={{ padding: '8px 4px' }}>
                      <span className="results-count">
                        {t.transfersFoundTitle(plannedJourneys.transferRoutes.length)}
                      </span>
                    </div>

                    {plannedJourneys.transferRoutes.map((journey, idx) => {
                      const r1 = journey.leg1.route;
                      const r2 = journey.leg2.route;
                      const c1 = r1.color || VEHICLE_COLORS[r1.vehicle] || VEHICLE_COLORS.Default;
                      const c2 = r2.color || VEHICLE_COLORS[r2.vehicle] || VEHICLE_COLORS.Default;
                      const isSelected = activeJourney && activeJourney.type === 'transfer' &&
                        activeJourney.hub.id === journey.hub.id &&
                        activeJourney.leg1.route.id === r1.id &&
                        activeJourney.leg2.route.id === r2.id;
                      const hubName = lang === 'ar' ? journey.hub.name_ar : (journey.hub.name_en || journey.hub.name_ar);
                      const ride1Min = Math.max(1, Math.round(journey.leg1.rideKm * 3));
                      const ride2Min = Math.max(1, Math.round(journey.leg2.rideKm * 3));
                      const walk1Min = Math.max(1, Math.round(journey.leg1.walkMeters / 80));
                      const walk2Min = Math.max(1, Math.round(journey.leg2.walkMeters / 80));

                      return (
                        <div
                          key={`${journey.hub.id}-${r1.id}-${r2.id}-${idx}`}
                          className={`journey-card ${isSelected ? 'selected' : ''}`}
                          tabIndex={0}
                          aria-current={isSelected ? 'true' : undefined}
                          onClick={() => {
                            setActiveJourney(journey);
                            onSelectRoute(r1);
                          }}
                          onKeyDown={(e) => {
                            if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              setActiveJourney(journey);
                              onSelectRoute(r1);
                            }
                          }}
                        >
                          <div className="journey-card-header">
                            <div className="badge-group">
                              <span className="route-num-badge" data-vehicle={r1.vehicle} style={{ '--card-color': c1 }}>{r1.num || r1.route_id}</span>
                              <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>{lang === 'ar' ? '←' : '→'}</span>
                              <span className="route-num-badge" data-vehicle={r2.vehicle} style={{ '--card-color': c2 }}>{r2.num || r2.route_id}</span>
                              <span className="transfer-pill">{t.transferBadge}</span>
                            </div>
                            <div className="time-badge">
                              <Clock size={12} />
                              <span>{t.totalTripTime(journey.totalTimeMinutes)}</span>
                            </div>
                          </div>

                          <div className="itinerary-steps">
                            <div className="step-item">
                              <span className="step-icon walk" aria-hidden="true"><Footprints size={13} /></span>
                              <span>{t.stepWalkToBus(journey.leg1.walkMeters, walk1Min)}</span>
                            </div>
                            <div className="step-item" style={{ '--card-color': c1 }} data-vehicle={r1.vehicle}>
                              <span className="step-icon bus" aria-hidden="true" style={r1.vehicle === 'Minibus' ? { color: '#15171C' } : undefined}><Bus size={13} /></span>
                              <span>{t.stepRideBus(r1.num || r1.route_id, journey.leg1.rideKm, ride1Min)}</span>
                            </div>
                            <div className="step-item">
                              <span className="step-icon walk" aria-hidden="true"><ArrowUpDown size={13} /></span>
                              <span>{t.stepTransferAt(hubName)}</span>
                            </div>
                            <div className="step-item" style={{ '--card-color': c2 }} data-vehicle={r2.vehicle}>
                              <span className="step-icon bus" aria-hidden="true" style={r2.vehicle === 'Minibus' ? { color: '#15171C' } : undefined}><Bus size={13} /></span>
                              <span>{t.stepRideBus(r2.num || r2.route_id, journey.leg2.rideKm, ride2Min)}</span>
                            </div>
                            <div className="step-item">
                              <span className="step-icon dest" aria-hidden="true"><MapPin size={12} /></span>
                              <span>{t.stepWalkToDest(journey.leg2.walkMeters, walk2Min)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(!plannedJourneys.directRoutes || plannedJourneys.directRoutes.length === 0) &&
                  (!plannedJourneys.transferRoutes || plannedJourneys.transferRoutes.length === 0) && (
                  <div className="empty-state">
                    <p>{t.noTripsFound}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: CHAT ASSISTANT — coming soon */}
      {activeTab === 'chat' && (
        <div className="coming-soon-panel">
          <div className="coming-soon-icon" aria-hidden="true">
            <Sparkles size={26} />
          </div>
          <span className="coming-soon-pill">{lang === 'ar' ? 'قريباً' : 'Coming soon'}</span>
          <h3 className="coming-soon-title">
            {lang === 'ar' ? 'المساعد الذكي' : 'Smart assistant'}
          </h3>
          <p className="coming-soon-text">
            {lang === 'ar'
              ? 'مساعد محادثة تسأله عن أي مشوار أو خط أو محطة، ويرد عليك بالطريقة الأسهل. نعمل عليه حالياً.'
              : 'A chat assistant you can ask about any trip, line or station, and get the easiest way there. We are working on it.'}
          </p>
          <div className="coming-soon-actions">
            <button type="button" className="btn-primary" onClick={() => selectTab('planner')}>
              <Route size={15} />
              <span>{lang === 'ar' ? 'خطط رحلتك الآن' : 'Plan a trip now'}</span>
            </button>
            <button type="button" className="btn-primary-outline" onClick={() => selectTab('explore')}>
              <Compass size={15} />
              <span>{lang === 'ar' ? 'تصفح الخطوط' : 'Browse lines'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: COMMUNITY — coming soon */}
      {activeTab === 'community' && (
        <div className="coming-soon-panel">
          <div className="coming-soon-icon" aria-hidden="true">
            <Users size={26} />
          </div>
          <span className="coming-soon-pill">{lang === 'ar' ? 'قريباً' : 'Coming soon'}</span>
          <h3 className="coming-soon-title">
            {lang === 'ar' ? 'مجتمع الركاب' : 'Rider community'}
          </h3>
          <p className="coming-soon-text">
            {lang === 'ar'
              ? 'مكان يشارك فيه الركاب تحديثات الأجرة والتحويلات والمواعيد على كل خط. نعمل عليه حالياً.'
              : 'A place for riders to share fare changes, detours and timing updates for every line. We are working on it.'}
          </p>
          <div className="coming-soon-actions">
            <button type="button" className="btn-primary" onClick={() => selectTab('explore')}>
              <Compass size={15} />
              <span>{lang === 'ar' ? 'تصفح الخطوط' : 'Browse lines'}</span>
            </button>
            <button type="button" className="btn-primary-outline" onClick={() => selectTab('nearest')}>
              <Navigation size={15} />
              <span>{lang === 'ar' ? 'أقرب نزول' : 'Nearest drop'}</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
