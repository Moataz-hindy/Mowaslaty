import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, MapPin, Compass, Train, Bus, Sparkles, Navigation, Target, Building, TrainFront, Map as MapIcon } from 'lucide-react';
import { normalizeText } from '../utils/geoUtils';
import { expandSearchQuery, routeMatchesTokens } from '../utils/transitAliases';
import { VEHICLE_COLORS } from '../utils/i18n';

// Cairo Famous Landmarks & Transit Hubs (with entrance gate coordinates for enclosed destinations)
export const CAIRO_LANDMARKS = [
  { 
    name_ar: 'حديقة الأزهر (بوابة صلاح سالم)', 
    name_en: 'Al Azhar Park (Salah Salem Gate)', 
    category: 'حديقة ومعلم سياحي', 
    coord: [30.04013, 31.26634], 
    district: 'صلاح سالم / الدراسة',
    aliases: ['حديقة الازهر', 'الازهر بارك', 'azhar park', 'al azhar', 'بوابة الازهر', 'حديقه الازهر']
  },
  { name_ar: 'ميدان التحرير (وسط البلد)', name_en: 'Tahrir Square', category: 'ميدان رئيسي', coord: [30.0444, 31.2357], district: 'وسط البلد', aliases: ['التحرير', 'tahrir'] },
  { name_ar: 'محطة قطارات رمسيس (مصر)', name_en: 'Ramses Railway Station', category: 'محطة قطار وموقف', coord: [30.0622, 31.2468], district: 'رمسيس', aliases: ['رمسيس', 'ramses'] },
  { name_ar: 'جامعة القاهرة (البوابة الرئيسية)', name_en: 'Cairo University (Main Gate)', category: 'صرح جامعي', coord: [30.0263, 31.2114], district: 'الجيزة', aliases: ['جامعة القاهرة', 'cairo university'] },
  { name_ar: 'الجامعة الأمريكية (AUC)', name_en: 'American University in Cairo (AUC)', category: 'جامعة', coord: [30.0191, 31.4988], district: 'التجمع الخامس', aliases: ['auc', 'الجامعة الامريكية', 'التجمع'] },
  { name_ar: 'الجامعة الألمانية (GUC)', name_en: 'German University in Cairo (GUC)', category: 'جامعة', coord: [29.9869, 31.4414], district: 'التجمع الخامس', aliases: ['guc', 'الجامعة الالمانية'] },
  { name_ar: 'سيتي ستارز', name_en: 'City Stars Mall', category: 'مركز تسوق ومول', coord: [30.0731, 31.3458], district: 'مدينة نصر', aliases: ['سيتي ستارز', 'city stars'] },
  { name_ar: 'كايرو فيستيفال سيتي (CFC)', name_en: 'Cairo Festival City', category: 'مركز تسوق ومول', coord: [30.0298, 31.4074], district: 'التجمع الخامس', aliases: ['cfc', 'كايرو فيستيفال'] },
  { name_ar: 'ميدان روكسي', name_en: 'Roxy Square', category: 'ميدان ومعلم', coord: [30.0936, 31.3144], district: 'مصر الجديدة', aliases: ['روكسي', 'roxy'] },
  { name_ar: 'مساكن شيراتون', name_en: 'Masaken Sheraton', category: 'حي سكني', coord: [30.1062, 31.3855], district: 'النزهة', aliases: ['شيراتون', 'sheraton'] },
  { name_ar: 'دوران شبرا', name_en: 'Dawaran Shubra', category: 'ميدان ومحطة نقل', coord: [30.0825, 31.2461], district: 'شبرا', aliases: ['شبرا', 'دوران شبرا'] },
  { name_ar: 'قصر البارون إمبان', name_en: 'Baron Empain Palace', category: 'معلم تاريخي', coord: [30.0867, 31.3303], district: 'مصر الجديدة', aliases: ['البارون', 'baron'] },
  { name_ar: 'مطار القاهرة الدولي', name_en: 'Cairo International Airport', category: 'مطار دولي', coord: [30.1219, 31.4056], district: 'مصر الجديدة', aliases: ['المطار', 'airport'] },
  { name_ar: 'دار الأوبرا المصرية', name_en: 'Cairo Opera House', category: 'صرح ثقافي', coord: [30.0425, 31.2238], district: 'الزمالك', aliases: ['الأوبرا', 'opera'] },
  { name_ar: 'ميدان الحصري', name_en: 'Al-Hosary Square', category: 'ميدان وموقف رئيسي', coord: [29.9723, 30.9442], district: '6 أكتوبر', aliases: ['الحصري', 'hosary', 'اكتوبر'] },
  { name_ar: 'ميدان لبنان', name_en: 'Lebanon Square', category: 'ميدان رئيسي', coord: [30.0632, 31.1989], district: 'المهندسين', aliases: ['لبنان', 'lebanon'] },
  { name_ar: 'ميدان الجيزة', name_en: 'Giza Square', category: 'ميدان وموقف', coord: [30.0105, 31.2069], district: 'الجيزة', aliases: ['الجيزة', 'giza'] },
  { name_ar: 'ميدان العتبة', name_en: 'Attaba Square', category: 'ميدان وتجارة', coord: [30.0524, 31.2471], district: 'وسط البلد', aliases: ['العتبة', 'attaba'] },
  { name_ar: 'ميدان العباسية', name_en: 'Abbasseya Square', category: 'ميدان وموقف', coord: [30.0682, 31.2829], district: 'العباسية', aliases: ['العباسية', 'abbasseya'] },
  { name_ar: 'موقف عدلي منصور التبادلي', name_en: 'Adly Mansour Interchange', category: 'مجمع نقل ومترو وقطار LRT', coord: [30.1472, 31.4215], district: 'السلام', aliases: ['عدلي منصور'] },
  { name_ar: 'ميدان مصطفى محمود', name_en: 'Mostafa Mahmoud Square', category: 'ميدان ومعلم', coord: [30.0504, 31.2014], district: 'المهندسين', aliases: ['مصطفى محمود'] },
  { name_ar: 'المعادي دجلة', name_en: 'Maadi Degla', category: 'حي سكني', coord: [29.9602, 31.2785], district: 'المعادي', aliases: ['المعادي', 'maadi'] },
  { name_ar: 'أهرامات الجيزة', name_en: 'Giza Pyramids', category: 'أثر عالمي ومعلم سياحي', coord: [29.9792, 31.1342], district: 'الهرم', aliases: ['الاهرامات', 'pyramids'] },
  { name_ar: 'قلعة صلاح الدين الأيوبي', name_en: 'Cairo Citadel', category: 'معلم تاريخي', coord: [30.0299, 31.2612], district: 'القلعة', aliases: ['القلعة', 'citadel'] },
  { name_ar: 'المتحف القومي للحضارة (NMEC)', name_en: 'National Museum of Egyptian Civilization', category: 'متحف ومعلم سياحي', coord: [30.0081, 31.2483], district: 'الفسطاط', aliases: ['متحف الحضارة', 'nmec', 'عين الصيرة'] },
  { name_ar: 'حديقة الفسطاط', name_en: 'Al Fustat Park', category: 'حديقة عامة', coord: [30.0084, 31.2505], district: 'الفسطاط', aliases: ['الفسطاط'] },
  { name_ar: 'حديقة الحيوان بالجيزة', name_en: 'Giza Zoo (Main Gate)', category: 'حديقة حيوان', coord: [30.0253, 31.2144], district: 'الجيزة', aliases: ['حديقة الحيوان', 'zoo'] },
  { 
    name_ar: 'مدينتي (الساوث بارك - منطقة الحركة)', 
    name_en: 'Madinaty (South Park Bus Station)', 
    category: 'موقف باصات ومجمع ترفيهي', 
    coord: [30.0890, 31.6315], 
    district: 'مدينتي', 
    aliases: ['مدينتي', 'مدينتى', 'madinaty', 'ساوث بارك', 'south park', 'منطقة الحركة', 'باص مدينتي'] 
  },
  { 
    name_ar: 'أوبن إير مول (مدينتي)', 
    name_en: 'Open Air Mall (Madinaty)', 
    category: 'مركز تسوق ومول', 
    coord: [30.1078, 31.6273], 
    district: 'مدينتي', 
    aliases: ['اوبن اير مول', 'open air mall', 'مول مدينتي', 'مدينتي مول'] 
  }
];

// Nominatim usage policy: max 1 request/second, no autocomplete, cache results.
// https://operations.osmfoundation.org/policies/nominatim/
const nominatimCache = new Map();
let lastNominatimRequestAt = 0;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function MapSearchBar({
  stops = [],
  routes = [],
  selectedLocation,
  onSelectLocation,
  onClearLocation,
  onSelectRoute,
  onSetTargetCoord,
  onSetOriginCoord,
  onSetDestCoord,
  onFilterNearbyRoutes,
  lang = 'ar'
}) {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, METRO, PLACES, ROUTES
  const [isFocused, setIsFocused] = useState(false);
  const [nominatimResults, setNominatimResults] = useState([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  // Address search runs only when the user asks for it (Enter / button)
  const [onlineQuery, setOnlineQuery] = useState('');

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Online address search (OpenStreetMap Nominatim) — on demand only
  useEffect(() => {
    const trimmed = onlineQuery.trim();
    if (trimmed.length < 3 || filterType === 'ROUTES') {
      setNominatimResults([]);
      setIsSearchingOnline(false);
      return;
    }

    let cancelled = false;
    const cacheKey = trimmed.toLowerCase();

    const run = async () => {
      if (nominatimCache.has(cacheKey)) {
        setNominatimResults(nominatimCache.get(cacheKey));
        return;
      }
      setIsSearchingOnline(true);
      try {
        const sinceLast = Date.now() - lastNominatimRequestAt;
        if (sinceLast < 1100) await wait(1100 - sinceLast);
        if (cancelled) return;
        lastNominatimRequestAt = Date.now();

        const encoded = encodeURIComponent(`${trimmed} القاهرة مصر`);
        const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&countrycodes=eg&viewbox=30.8,29.7,31.7,30.3&accept-language=${lang === 'ar' ? 'ar' : 'en'}`;
        const res = await fetch(url);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const parsed = data.map(item => ({
            id: `nom_${item.place_id}`,
            name_ar: item.display_name.split(',')[0],
            name_en: item.display_name.split(',')[0],
            full_name: item.display_name,
            coord: [parseFloat(item.lat), parseFloat(item.lon)],
            type: 'osm_place',
            category: lang === 'ar' ? 'عنوان (OpenStreetMap)' : 'Address (OpenStreetMap)'
          }));
          nominatimCache.set(cacheKey, parsed);
          setNominatimResults(parsed);
        }
      } catch (err) {
        console.warn('Nominatim geocode error:', err);
      } finally {
        if (!cancelled) setIsSearchingOnline(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [onlineQuery, filterType, lang]);

  // Typing something new clears previous address results
  useEffect(() => {
    if (onlineQuery && query.trim() !== onlineQuery) {
      setOnlineQuery('');
      setNominatimResults([]);
    }
  }, [query]);

  const canSearchAddresses = query.trim().length >= 3 && filterType !== 'ROUTES' && onlineQuery !== query.trim();
  const searchAddresses = () => {
    if (query.trim().length >= 3) setOnlineQuery(query.trim());
  };

  // Compute Instant Local Matches
  const searchResults = useMemo(() => {
    const norm = normalizeText(query);
    if (!norm) return { metro: [], places: [], lines: [], totalCount: 0 };

    // 1. Metro Stations
    let metro = [];
    if (filterType === 'ALL' || filterType === 'METRO') {
      metro = stops.filter(s => s.type === 'metro' && (
        normalizeText(s.name_ar).includes(norm) ||
        normalizeText(s.name_en).includes(norm)
      )).slice(0, 5).map(s => ({
        id: s.id,
        name_ar: s.name_ar,
        name_en: s.name_en,
        coord: [s.lat, s.lng],
        type: 'metro_station',
        lines: s.lines || [],
        is_interchange: s.is_interchange,
        category: s.is_interchange ? 'محطة مترو تبادلية' : 'محطة مترو أنفاق'
      }));
    }

    // 2. Cairo Landmarks & Places
    let places = [];
    if (filterType === 'ALL' || filterType === 'PLACES') {
      const landmarkMatches = CAIRO_LANDMARKS.filter(l => (
        normalizeText(l.name_ar).includes(norm) ||
        normalizeText(l.name_en).includes(norm) ||
        normalizeText(l.district).includes(norm) ||
        (l.aliases && l.aliases.some(a => normalizeText(a).includes(norm)))
      )).slice(0, 5).map(l => ({
        id: `lm_${l.name_en}`,
        name_ar: l.name_ar,
        name_en: l.name_en,
        coord: l.coord,
        district: l.district,
        type: 'landmark',
        category: l.category
      }));

      // Also match bus stops if query is specific
      let busStopMatches = [];
      if (landmarkMatches.length < 5) {
        busStopMatches = stops.filter(s => s.type !== 'metro' && (
          normalizeText(s.name_ar).includes(norm) ||
          normalizeText(s.name_en).includes(norm)
        )).slice(0, 5 - landmarkMatches.length).map(s => ({
          id: s.id,
          name_ar: s.name_ar || s.name_en,
          name_en: s.name_en,
          coord: [s.lat, s.lng],
          type: 'bus_stop',
          category: 'محطة أوتوبيس وموقف'
        }));
      }

      places = [...landmarkMatches, ...busStopMatches];
    }

    // 3. Transit Lines / Routes
    let lines = [];
    if (filterType === 'ALL' || filterType === 'ROUTES') {
      const tokens = expandSearchQuery(query);
      lines = routes.filter(r => (
        r.num === query.trim() ||
        normalizeText(r.num).includes(norm) ||
        normalizeText(r.short_ar).includes(norm) ||
        normalizeText(r.short_en).includes(norm) ||
        normalizeText(r.long_ar).includes(norm) ||
        normalizeText(r.long_en).includes(norm) ||
        normalizeText(r.origin).includes(norm) ||
        normalizeText(r.dest).includes(norm) ||
        normalizeText(r.origin_en).includes(norm) ||
        normalizeText(r.dest_en).includes(norm) ||
        routeMatchesTokens(r, tokens)
      )).slice(0, 6).map(r => ({
        id: r.id,
        num: r.num,
        short_ar: r.short_ar,
        origin: r.origin,
        dest: r.dest,
        vehicle: r.vehicle,
        color: r.color || VEHICLE_COLORS[r.vehicle] || VEHICLE_COLORS.Default,
        type: 'route',
        routeObj: r,
        category: r.vehicle === 'Metro' ? 'مترو الأنفاق' : (r.agency === 'Madinaty' ? 'باص مدينتي' : (r.vehicle === 'Minibus' ? 'ميني باص' : 'أتوبيس'))
      }));
    }

    const totalCount = metro.length + places.length + lines.length;
    return { metro, places, lines, totalCount };
  }, [query, filterType, stops, routes]);

  const handleSelectPlaceOrStation = (item) => {
    setQuery(item.name_ar || item.name_en);
    setIsFocused(false);
    if (onSelectLocation) {
      onSelectLocation({
        name: item.name_ar || item.name_en,
        coord: item.coord,
        type: item.type,
        lines: item.lines,
        category: item.category,
        district: item.district
      });
    }
  };

  const handleSelectTransitRoute = (item) => {
    setQuery(item.short_ar || item.num);
    setIsFocused(false);
    if (onSelectRoute && item.routeObj) {
      onSelectRoute(item.routeObj);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setOnlineQuery('');
    setNominatimResults([]);
    inputRef.current?.focus();
    if (onClearLocation) onClearLocation();
  };

  const showDropdown = isFocused;

  return (
    <div className="map-search-container" ref={containerRef}>
      {/* Search Input Box */}
      <div className={`map-search-box ${isFocused ? 'focused' : ''}`}>
        <div className="map-search-icon">
          <Search size={18} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              searchAddresses();
            } else if (e.key === 'Escape') {
              setIsFocused(false);
            }
          }}
          aria-label={lang === 'ar' ? 'ابحث في الخريطة' : 'Search the map'}
          placeholder={lang === 'ar' ? "ابحث في الخريطة عن مكان، محطة مترو، أو رقم خط..." : "Search map for places, metro stations, or lines..."}
        />

        {query && (
          <button className="map-search-clear-btn" onClick={clearSearch} title="مسح">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Filter Chips Bar (All, Metro, Places, Lines) */}
      <div className="map-search-filter-chips">
        <button 
          className={`search-chip ${filterType === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilterType('ALL')}
        >
          الكل
        </button>
        <button 
          className={`search-chip metro ${filterType === 'METRO' ? 'active' : ''}`}
          onClick={() => setFilterType('METRO')}
        >
          المترو
        </button>
        <button 
          className={`search-chip places ${filterType === 'PLACES' ? 'active' : ''}`}
          onClick={() => setFilterType('PLACES')}
        >
          الأماكن
        </button>
        <button 
          className={`search-chip routes ${filterType === 'ROUTES' ? 'active' : ''}`}
          onClick={() => setFilterType('ROUTES')}
        >
          الخطوط
        </button>
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div className="map-search-dropdown">
          {/* Quick preset suggestions if search is empty */}
          {!query.trim() && (
            <div className="search-empty-state-suggestions">
              <span className="search-group-title">
                <Sparkles size={13} className="sparkle-icon" /> معالم وميادين مقترحة بالقاهرة:
              </span>
              <div className="preset-suggestions-grid">
                {CAIRO_LANDMARKS.slice(0, 6).map((lm, idx) => (
                  <button
                    key={idx}
                    className="preset-suggestion-btn"
                    onClick={() => handleSelectPlaceOrStation(lm)}
                  >
                    <MapPin size={12} className="pin-icon" />
                    <span>{lm.name_ar}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results List */}
          {query.trim() && (
            <div className="search-results-scrollable">
              {/* Category 1: Metro Stations */}
              {searchResults.metro.length > 0 && (
                <div className="search-results-group">
                  <div className="search-group-title metro">
                    <Train size={13} />
                    <span>محطات مترو الأنفاق ({searchResults.metro.length}):</span>
                  </div>
                  {searchResults.metro.map(s => (
                    <div 
                      key={s.id} 
                      className="search-item metro"
                      onClick={() => handleSelectPlaceOrStation(s)}
                    >
                      <div className="search-item-icon metro" aria-hidden="true">
                        <TrainFront size={16} />
                      </div>
                      <div className="search-item-info">
                        <div className="search-item-title-row">
                          <span className="search-item-title">{s.name_ar}</span>
                          {s.is_interchange && <span className="interchange-badge">تبادلية</span>}
                        </div>
                        <span className="search-item-subtitle">{s.name_en} • خطوط ({s.lines.join(', ') || 'مترو'})</span>
                      </div>
                      <Navigation size={14} className="jump-icon" />
                    </div>
                  ))}
                </div>
              )}

              {/* Category 2: Landmarks and Places */}
              {searchResults.places.length > 0 && (
                <div className="search-results-group">
                  <div className="search-group-title places">
                    <MapPin size={13} />
                    <span>الأماكن والمعالم ({searchResults.places.length}):</span>
                  </div>
                  {searchResults.places.map(p => (
                    <div 
                      key={p.id} 
                      className="search-item place"
                      onClick={() => handleSelectPlaceOrStation(p)}
                    >
                      <div className="search-item-icon place" aria-hidden="true">
                        <MapPin size={16} />
                      </div>
                      <div className="search-item-info">
                        <span className="search-item-title">{p.name_ar}</span>
                        <span className="search-item-subtitle">{p.category} {p.district ? `• ${p.district}` : ''}</span>
                      </div>
                      <Navigation size={14} className="jump-icon" />
                    </div>
                  ))}
                </div>
              )}

              {/* Category 3: Transit Lines */}
              {searchResults.lines.length > 0 && (
                <div className="search-results-group">
                  <div className="search-group-title routes">
                    <Bus size={13} />
                    <span>خطوط النقل والأتوبيس ({searchResults.lines.length}):</span>
                  </div>
                  {searchResults.lines.map(r => (
                    <div 
                      key={r.id} 
                      className="search-item route"
                      onClick={() => handleSelectTransitRoute(r)}
                    >
                      <div 
                        className="search-item-icon route"
                        style={{ background: r.color }}
                        data-vehicle={r.vehicle}
                      >
                        {r.num}
                      </div>
                      <div className="search-item-info">
                        <span className="search-item-title">{r.short_ar || `خط ${r.num}`} ({r.category})</span>
                        <span className="search-item-subtitle">{r.origin} ← {r.dest}</span>
                      </div>
                      <Compass size={14} className="jump-icon" />
                    </div>
                  ))}
                </div>
              )}

              {/* Category 4: OpenStreetMap Nominatim Live Geocoding Results */}
              {nominatimResults.length > 0 && (
                <div className="search-results-group">
                  <div className="search-group-title osm">
                    <Building size={13} />
                    <span>{lang === 'ar' ? 'عناوين وشوارع' : 'Addresses & streets'}</span>
                    <span style={{ marginInlineStart: 'auto', fontWeight: 400 }}>© OpenStreetMap</span>
                  </div>
                  {nominatimResults.map(item => (
                    <div 
                      key={item.id} 
                      className="search-item osm"
                      onClick={() => handleSelectPlaceOrStation(item)}
                    >
                      <div className="search-item-icon osm" aria-hidden="true">
                        <MapIcon size={16} />
                      </div>
                      <div className="search-item-info">
                        <span className="search-item-title">{item.name_ar}</span>
                        <span className="search-item-subtitle">{item.full_name.slice(0, 60)}...</span>
                      </div>
                      <Navigation size={14} className="jump-icon" />
                    </div>
                  ))}
                </div>
              )}

              {/* On-demand address search (keeps us within Nominatim's usage policy) */}
              {canSearchAddresses && (
                <button type="button" className="search-item search-address-btn" onClick={searchAddresses}>
                  <div className="search-item-icon osm" aria-hidden="true">
                    <Search size={16} />
                  </div>
                  <div className="search-item-info">
                    <span className="search-item-title">
                      {lang === 'ar' ? `ابحث عن العنوان «${query.trim()}»` : `Search addresses for “${query.trim()}”`}
                    </span>
                    <span className="search-item-subtitle">
                      {lang === 'ar' ? 'أو اضغط Enter' : 'or press Enter'}
                    </span>
                  </div>
                </button>
              )}

              {isSearchingOnline && (
                <div className="search-no-results">
                  <span>{lang === 'ar' ? 'جاري البحث في العناوين...' : 'Searching addresses...'}</span>
                </div>
              )}

              {/* No results message */}
              {searchResults.totalCount === 0 && nominatimResults.length === 0 && !isSearchingOnline && !canSearchAddresses && (
                <div className="search-no-results">
                  <p>لم يتم العثور على مكان أو محطة تطابق "{query}".</p>
                  <span>جرب البحث باسم ميدان رئيسي، جامعة، أو رقم خط.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Selected Location Quick Actions Card (Nested cleanly in the search container) */}
      {selectedLocation && !showDropdown && (
        <div className="map-active-location-card">
          <div className="active-location-header">
            <div className="active-location-icon">
              {selectedLocation.type === 'metro_station' ? <TrainFront size={18} aria-hidden="true" /> : <MapPin size={18} aria-hidden="true" />}
            </div>
            <div className="active-location-titles">
              <span className="active-location-name">{selectedLocation.name}</span>
              <span className="active-location-cat">
                {selectedLocation.category} {selectedLocation.district ? `• ${selectedLocation.district}` : ''}
              </span>
            </div>
            <button 
              className="btn-clear-active-location" 
              onClick={onClearLocation}
              title="إلغاء التحديد"
            >
              <X size={14} />
            </button>
          </div>

          <div className="active-location-actions-grid">
            <button 
              className="btn-quick-transit-action target"
              onClick={() => onSetTargetCoord(selectedLocation.coord)}
              title="حساب أقرب محطة نزول لهذا المكان"
            >
              <Target size={13} />
              <span>نزلني هنا</span>
            </button>

            <button 
              className="btn-quick-transit-action origin"
              onClick={() => onSetOriginCoord(selectedLocation.coord)}
              title="تعيين كنقطة انطلاق (أ) في مخطط الرحلة"
            >
              <Navigation size={13} />
              <span>انطلاق (أ)</span>
            </button>

            <button 
              className="btn-quick-transit-action dest"
              onClick={() => onSetDestCoord(selectedLocation.coord)}
              title="تعيين كوجهة وصول (ب) في مخطط الرحلة"
            >
              <Compass size={13} />
              <span>وصول (ب)</span>
            </button>

            <button 
              className="btn-quick-transit-action filter"
              onClick={() => onFilterNearbyRoutes(selectedLocation.name)}
              title="البحث عن خطوط تخدم هذا المكان"
            >
              <Bus size={13} />
              <span>خطوط المكان</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
