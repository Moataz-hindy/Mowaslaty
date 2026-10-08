/**
 * Mowaslaty Cairo - Phase 1 Application Logic
 * Interactive Bus & Minibus Route Explorer
 */

// UI Translations
const I18N = {
  ar: {
    brandTitle: "مواصلاتي",
    brandSub: "مستكشف أتوبيسات وميني باص القاهرة",
    searchPlaceholder: "ابحث برقم الخط (305, 204) أو المنطقة (شبرا، شيراتون)...",
    popularLabel: "أشهر الخطوط:",
    phaseTag: "المرحلة الأولى: مستكشف المسارات",
    loading: "جاري تجهيز بيانات 1,784 خط ومسار في القاهرة...",
    loadingGeom: "جاري رسم المسار على الخريطة...",
    noResults: "لم يتم العثور على خطوط مطابقة للبحث",
    resultsCount: (n) => `${n} خط ومسار متاح`,
    all: "الكل",
    minibus: "ميني باص",
    bus: "أتوبيس هيئة",
    microbus: "ميكروباص",
    tomnaya: "تمناية",
    box: "بوكس",
    lengthLabel: "طول الخط",
    directionLabel: "الاتجاه",
    capacityLabel: "السعة",
    dirOutbound: "ذهاب",
    dirInbound: "إياب",
    kmUnit: "كم",
    passengersUnit: "راكب",
    toggleDirBtn: "عرض الاتجاه المعاكس",
    noOppositeDir: "لا يتوفر مسار مسجل للاتجاه المعاكس",
    fitRouteBtn: "توسيط المسار على الخريطة",
    stopsBtn: "محطات القاهرة",
    resetMapBtn: "القاهرة بالكامل",
    routeLegend: "مسار الخط",
    startTerminal: "البداية",
    endTerminal: "النهاية",
    originPrefix: "من:",
    destPrefix: "إلى:"
  },
  en: {
    brandTitle: "Mowaslaty",
    brandSub: "Greater Cairo Bus & Minibus Explorer",
    searchPlaceholder: "Search by line # (305, 204) or area (Shubra, Sheraton)...",
    popularLabel: "Popular Lines:",
    phaseTag: "Phase 1: Route Explorer",
    loading: "Loading 1,784 Cairo routes and paths...",
    loadingGeom: "Drawing route polyline on map...",
    noResults: "No routes found matching your search",
    resultsCount: (n) => `${n} routes available`,
    all: "All",
    minibus: "Minibus",
    bus: "CTA Bus",
    microbus: "Microbus",
    tomnaya: "7-Seater Van",
    box: "Box",
    lengthLabel: "Route Length",
    directionLabel: "Direction",
    capacityLabel: "Capacity",
    dirOutbound: "Outbound",
    dirInbound: "Inbound",
    kmUnit: "km",
    passengersUnit: "passengers",
    toggleDirBtn: "Switch Direction",
    noOppositeDir: "No recorded return route found",
    fitRouteBtn: "Fit Route on Map",
    stopsBtn: "Cairo Stops",
    resetMapBtn: "Greater Cairo",
    routeLegend: "Active Route",
    startTerminal: "Origin",
    endTerminal: "Destination",
    originPrefix: "From:",
    destPrefix: "To:"
  }
};

// Application State
const state = {
  routes: [],
  geometries: null, // Loaded asynchronously
  stops: [],
  filteredRoutes: [],
  selectedRoute: null,
  activeFilter: 'ALL',
  searchQuery: '',
  lang: 'ar',
  theme: 'dark',
  showStops: false,
  map: null,
  activePolylineGroup: null,
  stopsLayerGroup: null,
  defaultCenter: [30.0444, 31.2357], // Cairo Ramses / Tahrir
  defaultZoom: 12
};

// Color mapping per vehicle type
const VEHICLE_COLORS = {
  'Minibus': '#f59e0b',
  'Bus': '#10b981',
  'Microbus': '#8b5cf6',
  'Tomnaya': '#f43f5e',
  'Box': '#ec4899',
  'Default': '#06b6d4'
};

/**
 * Text normalization for Arabic search
 */
function normalizeText(text) {
  if (!text) return '';
  return text.toString()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove tashkeel
    .trim();
}

/**
 * Initialize Leaflet Map
 */
function initMap() {
  state.map = L.map('map', {
    center: state.defaultCenter,
    zoom: state.defaultZoom,
    zoomControl: false
  });

  // Add zoom control at bottom-left
  L.control.zoom({ position: 'bottomleft' }).addTo(state.map);

  // Basemap tiles: CartoDB Voyager with clean labels
  const tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  L.tileLayer(tileUrl, {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(state.map);

  state.activePolylineGroup = L.featureGroup().addTo(state.map);
  state.stopsLayerGroup = L.layerGroup().addTo(state.map);
}

/**
 * Fetch Data Files
 */
async function loadData() {
  const routesContainer = document.getElementById('routes-container');
  const countEl = document.getElementById('results-count');

  try {
    // 1. Load routes summary (fast ~900KB)
    const resSummary = await fetch('data/routes_summary.json');
    state.routes = await resSummary.json();
    state.filteredRoutes = state.routes;

    // 2. Fetch stops in background
    fetch('data/stops_summary.json')
      .then(res => res.json())
      .then(data => { state.stops = data; })
      .catch(err => console.warn('Stops file error:', err));

    // 3. Fetch geometries in background
    fetch('data/routes_geometry.json')
      .then(res => res.json())
      .then(data => {
        state.geometries = data;
        console.log('Geometries loaded successfully:', Object.keys(data).length);
        // If a route is already selected before geometry finished loading, draw it now
        if (state.selectedRoute) {
          drawRouteOnMap(state.selectedRoute);
        }
      })
      .catch(err => console.warn('Geometries file error:', err));

    updateRoutesList();

    // Check URL parameters or preselect Minibus 305
    const initialRoute = state.routes.find(r => r.num === '305') || state.routes[0];
    if (initialRoute) {
      selectRoute(initialRoute);
    }
  } catch (error) {
    console.error('Error loading route data:', error);
    routesContainer.innerHTML = `
      <div class="empty-state">
        <p>عذراً، حدث خطأ أثناء تحميل بيانات الخطوط.</p>
        <button class="btn-primary" onclick="location.reload()">إعادة المحاولة</button>
      </div>
    `;
  }
}

/**
 * Filter & Search routes
 */
function applyFilters() {
  const query = normalizeText(state.searchQuery);
  const vehicleFilter = state.activeFilter;

  state.filteredRoutes = state.routes.filter(r => {
    // Vehicle filter
    if (vehicleFilter !== 'ALL') {
      if (vehicleFilter === 'Minibus' && r.vehicle !== 'Minibus') return false;
      if (vehicleFilter === 'Bus' && r.vehicle !== 'Bus') return false;
      if (vehicleFilter === 'Microbus' && r.vehicle !== 'Microbus') return false;
      if (vehicleFilter === 'Tomnaya' && !['Tomnaya', 'Box'].includes(r.vehicle)) return false;
    }

    // Search query
    if (!query) return true;

    const num = normalizeText(r.num);
    const shortAr = normalizeText(r.short_ar);
    const shortEn = normalizeText(r.short_en);
    const longAr = normalizeText(r.long_ar);
    const longEn = normalizeText(r.long_en);
    const origin = normalizeText(r.origin);
    const dest = normalizeText(r.dest);

    return num.includes(query) ||
      shortAr.includes(query) ||
      shortEn.includes(query) ||
      longAr.includes(query) ||
      longEn.includes(query) ||
      origin.includes(query) ||
      dest.includes(query);
  });

  updateRoutesList();
}

/**
 * Render Routes List
 */
function updateRoutesList() {
  const container = document.getElementById('routes-container');
  const countEl = document.getElementById('results-count');
  const t = I18N[state.lang];

  countEl.textContent = t.resultsCount(state.filteredRoutes.length);

  if (state.filteredRoutes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <p>${t.noResults}</p>
      </div>
    `;
    return;
  }

  // Render top 150 items for high performance (infinite scroll or pagination on demand)
  const displayRoutes = state.filteredRoutes.slice(0, 150);
  
  const cardsHtml = displayRoutes.map(r => {
    const isSelected = state.selectedRoute && state.selectedRoute.id === r.id;
    const color = VEHICLE_COLORS[r.vehicle] || VEHICLE_COLORS['Default'];
    const title = state.lang === 'ar' ? (r.long_ar || r.long_en) : (r.long_en || r.long_ar);
    const vehicleText = getVehicleLabel(r.vehicle);
    const dirText = r.dir === 0 ? t.dirOutbound : t.dirInbound;

    return `
      <div 
        class="route-card ${isSelected ? 'selected' : ''}" 
        style="--card-color: ${color};"
        onclick="onRouteCardClick('${r.id}')"
        data-route-id="${r.id}"
      >
        <div class="route-card-top">
          <div class="badge-group">
            <span class="route-num-badge">${r.num || r.route_id}</span>
            <span class="route-vehicle-badge">${vehicleText}</span>
          </div>
          <span class="route-dist-badge">${r.len_km} ${t.kmUnit} • ${dirText}</span>
        </div>
        <h4 class="route-card-title">${title}</h4>
        <div class="route-terminals-flow">
          <span>${r.origin}</span>
          <span class="terminal-arrow">➔</span>
          <span>${r.dest}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = cardsHtml;
}

/**
 * Handle route selection
 */
window.onRouteCardClick = function(routeId) {
  const route = state.routes.find(r => r.id === routeId);
  if (!route) return;

  selectRoute(route);

  // If on mobile, close sidebar slightly to reveal map
  if (window.innerWidth <= 900) {
    document.getElementById('sidebar').classList.remove('mobile-open');
  }
};

function selectRoute(route) {
  state.selectedRoute = route;

  // Highlight card in sidebar
  document.querySelectorAll('.route-card').forEach(card => {
    card.classList.toggle('selected', card.getAttribute('data-route-id') === route.id);
  });

  // Open drawer and update info
  updateDrawerInfo(route);

  // Draw on map
  drawRouteOnMap(route);
}

/**
 * Draw active route on Leaflet map
 */
function drawRouteOnMap(route) {
  if (!state.map) return;
  state.activePolylineGroup.clearLayers();

  const color = VEHICLE_COLORS[route.vehicle] || VEHICLE_COLORS['Default'];

  // Check if geometry is loaded
  if (!state.geometries || !state.geometries[route.id]) {
    console.log('Geometry still loading for', route.id);
    return;
  }

  const coords = state.geometries[route.id];
  if (!coords || coords.length === 0) return;

  // 1. Background shadow polyline for glow
  const polylineGlow = L.polyline(coords, {
    color: color,
    weight: 9,
    opacity: 0.35,
    lineCap: 'round',
    lineJoin: 'round'
  });

  // 2. Foreground main polyline
  const polylineMain = L.polyline(coords, {
    color: color,
    weight: 5,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round'
  });

  state.activePolylineGroup.addLayer(polylineGlow);
  state.activePolylineGroup.addLayer(polylineMain);

  // 3. Add Start Terminal Marker
  const startPt = coords[0];
  const endPt = coords[coords.length - 1];

  const startIcon = L.divIcon({
    className: 'custom-terminal-marker',
    html: `<div class="custom-terminal-icon start" title="محطة البداية: ${route.origin}">أ</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const endIcon = L.divIcon({
    className: 'custom-terminal-marker',
    html: `<div class="custom-terminal-icon end" title="محطة النهاية: ${route.dest}">ب</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const startMarker = L.marker(startPt, { icon: startIcon })
    .bindPopup(`<strong>${I18N[state.lang].startTerminal}:</strong> ${route.origin}`);
  const endMarker = L.marker(endPt, { icon: endIcon })
    .bindPopup(`<strong>${I18N[state.lang].endTerminal}:</strong> ${route.dest}`);

  state.activePolylineGroup.addLayer(startMarker);
  state.activePolylineGroup.addLayer(endMarker);

  // Fit map smoothly to route bounds
  state.map.fitBounds(polylineMain.getBounds(), {
    padding: [60, 60],
    maxZoom: 15,
    animate: true,
    duration: 0.6
  });

  // Update Legend
  updateLegend(route, color);
}

/**
 * Update Drawer Info
 */
function updateDrawerInfo(route) {
  const drawer = document.getElementById('active-route-drawer');
  const t = I18N[state.lang];
  const color = VEHICLE_COLORS[route.vehicle] || VEHICLE_COLORS['Default'];

  drawer.style.display = 'flex';
  drawer.style.setProperty('--active-route-color', color);

  document.getElementById('detail-num').textContent = route.num || route.route_id;
  document.getElementById('detail-name').textContent = state.lang === 'ar' ? (route.long_ar || route.long_en) : (route.long_en || route.long_ar);
  document.getElementById('detail-meta').textContent = `${getVehicleLabel(route.vehicle)} • ${route.agency || ''}`;
  document.getElementById('detail-len').textContent = `${route.len_km} ${t.kmUnit}`;
  document.getElementById('detail-dir').textContent = route.dir === 0 ? t.dirOutbound : t.dirInbound;
  document.getElementById('detail-capacity').textContent = route.capacity ? `${route.capacity} ${t.passengersUnit}` : '--';
}

/**
 * Update Map Floating Legend
 */
function updateLegend(route, color) {
  const legend = document.getElementById('map-legend');
  const dot = document.getElementById('legend-color-dot');
  const title = document.getElementById('legend-title');
  const origin = document.getElementById('legend-origin');
  const dest = document.getElementById('legend-dest');

  legend.style.display = 'flex';
  dot.style.backgroundColor = color;
  title.textContent = `${route.short_ar || route.short_en} (${route.num})`;
  origin.textContent = route.origin;
  dest.textContent = route.dest;
}

/**
 * Toggle between Outbound and Inbound direction
 */
function toggleRouteDirection() {
  if (!state.selectedRoute) return;

  const current = state.selectedRoute;
  const targetDir = current.dir === 0 ? 1 : 0;

  // Find counterpart trip for same line
  const oppositeTrip = state.routes.find(r => 
    r.route_id === current.route_id && r.dir === targetDir && r.id !== current.id
  ) || state.routes.find(r => 
    r.num === current.num && r.vehicle === current.vehicle && r.dir === targetDir
  );

  if (oppositeTrip) {
    selectRoute(oppositeTrip);
  } else {
    alert(I18N[state.lang].noOppositeDir);
  }
}

/**
 * Toggle Cairo Stops Overlay
 */
function toggleStopsOverlay() {
  const btn = document.getElementById('btn-toggle-stops');
  state.showStops = !state.showStops;
  btn.classList.toggle('active', state.showStops);

  state.stopsLayerGroup.clearLayers();

  if (state.showStops && state.stops.length > 0) {
    // Render stops within current map view
    const bounds = state.map.getBounds();
    const visibleStops = state.stops.filter(s => bounds.contains([s.lat, s.lng]));

    visibleStops.forEach(s => {
      const circle = L.circleMarker([s.lat, s.lng], {
        radius: 4.5,
        color: '#ffffff',
        weight: 1.5,
        fillColor: '#06b6d4',
        fillOpacity: 0.8
      }).bindPopup(`<strong>${state.lang === 'ar' ? (s.name_ar || s.name_en) : s.name_en}</strong>`);

      state.stopsLayerGroup.addLayer(circle);
    });
  }
}

/**
 * Vehicle label translator
 */
function getVehicleLabel(v) {
  const t = I18N[state.lang];
  switch (v) {
    case 'Minibus': return t.minibus;
    case 'Bus': return t.bus;
    case 'Microbus': return t.microbus;
    case 'Tomnaya': return t.tomnaya;
    case 'Box': return t.box;
    default: return v || t.bus;
  }
}

/**
 * Setup Event Listeners
 */
function setupEvents() {
  // Search input
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('btn-clear-search');

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    clearBtn.style.display = state.searchQuery ? 'flex' : 'none';
    applyFilters();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state.filteredRoutes.length > 0) {
      selectRoute(state.filteredRoutes[0]);
    }
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearBtn.style.display = 'none';
    applyFilters();
  });

  // Filter chips
  document.getElementById('filter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    state.activeFilter = chip.getAttribute('data-vehicle');
    applyFilters();
  });

  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-query');
      searchInput.value = q;
      state.searchQuery = q;
      clearBtn.style.display = 'flex';
      applyFilters();
    });
  });

  // Drawer buttons
  document.getElementById('btn-close-drawer').addEventListener('click', () => {
    document.getElementById('active-route-drawer').style.display = 'none';
    document.getElementById('map-legend').style.display = 'none';
    state.activePolylineGroup.clearLayers();
    state.selectedRoute = null;
    document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));
  });

  document.getElementById('btn-toggle-direction').addEventListener('click', toggleRouteDirection);

  document.getElementById('btn-fit-route').addEventListener('click', () => {
    if (state.selectedRoute) {
      drawRouteOnMap(state.selectedRoute);
    }
  });

  // Map controls
  document.getElementById('btn-toggle-stops').addEventListener('click', toggleStopsOverlay);

  document.getElementById('btn-reset-view').addEventListener('click', () => {
    state.map.setView(state.defaultCenter, state.defaultZoom, { animate: true });
  });

  // Update visible stops on map move if enabled
  state.map.on('moveend', () => {
    if (state.showStops) {
      toggleStopsOverlay();
      state.showStops = true; // keep on
      document.getElementById('btn-toggle-stops').classList.add('active');
    }
  });

  // Mobile sidebar toggle
  document.getElementById('btn-mobile-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });

  // Theme switcher
  document.getElementById('btn-theme').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.body.className = `theme-${state.theme}`;
  });

  // Language switcher
  document.getElementById('btn-lang').addEventListener('click', () => {
    state.lang = state.lang === 'ar' ? 'en' : 'ar';
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    document.getElementById('lang-code').textContent = state.lang === 'ar' ? 'EN' : 'عربي';
    
    // Update static texts
    applyLanguageTranslations();
    // Re-render list and drawer
    updateRoutesList();
    if (state.selectedRoute) {
      updateDrawerInfo(state.selectedRoute);
    }
  });
}

function applyLanguageTranslations() {
  const t = I18N[state.lang];
  document.getElementById('txt-brand-title').textContent = t.brandTitle;
  document.getElementById('txt-brand-sub').textContent = t.brandSub;
  document.getElementById('search-input').placeholder = t.searchPlaceholder;
  document.getElementById('txt-popular').textContent = t.popularLabel;
  document.getElementById('lbl-length').textContent = t.lengthLabel;
  document.getElementById('lbl-dir').textContent = t.directionLabel;
  document.getElementById('lbl-capacity').textContent = t.capacityLabel;
  document.getElementById('txt-toggle-dir').textContent = t.toggleDirBtn;
  document.getElementById('txt-fit-route').textContent = t.fitRouteBtn;
  document.getElementById('txt-stops-toggle').textContent = t.stopsBtn;
  document.getElementById('txt-reset-map').textContent = t.resetMapBtn;
}

// Boot application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEvents();
  loadData();
});
