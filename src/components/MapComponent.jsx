import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { VEHICLE_COLORS } from '../utils/i18n';
import { fetchWalkingRoute } from '../utils/geoUtils';

// Inline stroke icons for Leaflet divIcons / popups (no emoji)
const svg = (d, size = 16, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  pin: '<path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l-2-4M15 21l2-4"/><circle cx="9" cy="14" r=".6" fill="currentColor"/><circle cx="15" cy="14" r=".6" fill="currentColor"/>',
  walk: '<path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0Z"/>',
  bus: '<path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  swap: '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'
};
const WALK_LINE = '#15171C';

export default function MapComponent({
  selectedRoute,
  geometries,
  targetCoord,
  onMapClick,
  activeNearest,
  // Search on Map
  searchLocation,
  // Phase 3 props
  activeTab,
  originCoord,
  destCoord,
  activeJourney,
  stops,
  showStops,
  fitRequest = 0,
  lang,
  t
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerGroupRef = useRef(null);
  const targetLayerGroupRef = useRef(null);
  const journeyLayerGroupRef = useRef(null);
  const stopsLayerGroupRef = useRef(null);
  const searchLayerGroupRef = useRef(null);

  // Fit bounds while keeping content clear of the floating UI
  // (search bar on top, route card at the bottom).
  const fitWithOverlays = (bounds, { maxZoom = 16, animate = true } = {}) => {
    const map = mapRef.current;
    if (!map || !bounds || !bounds.isValid()) return;
    const container = map.getContainer();
    const mapRect = container.getBoundingClientRect();
    const side = 48;
    let top = 96;
    let bottom = 48;
    // Anything floating over the lower part of the map: the route card,
    // and on phones the sidebar bottom sheet.
    const overlays = [
      container.parentElement?.querySelector('.active-route-drawer'),
      document.querySelector('.sidebar')
    ];
    overlays.forEach(el => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const overlapsHorizontally = r.left < mapRect.right - 1 && r.right > mapRect.left + 1;
      const sitsInLowerPart = r.top > mapRect.top + mapRect.height * 0.25 && r.top < mapRect.bottom;
      if (overlapsHorizontally && sitsInLowerPart) {
        bottom = Math.max(bottom, mapRect.bottom - r.top + 24);
      }
    });
    // never let padding swallow the whole viewport on short screens
    const maxVertical = Math.max(0, mapRect.height - 120);
    if (top + bottom > maxVertical) {
      const scale = maxVertical / (top + bottom);
      top = Math.round(top * scale);
      bottom = Math.round(bottom * scale);
    }
    map.fitBounds(bounds, {
      paddingTopLeft: [side, top],
      paddingBottomRight: [side, bottom],
      maxZoom,
      animate
    });
  };

  // Always keep a ref to the latest onMapClick to avoid stale closures
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [30.0444, 31.2357], // Cairo Ramses
      zoom: 12,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // Basemap: CARTO "Positron" when a key is configured (production),
    // otherwise OSM's own tiles (fine for local development only).
    const cartoKey = import.meta.env.VITE_CARTO_KEY;
    if (cartoKey) {
      L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attribution/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);
    } else {
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);
    }
    map.attributionControl.addAttribution('Walking routes: <a href="https://www.geoapify.com/">Powered by Geoapify</a>');

    routeLayerGroupRef.current = L.featureGroup().addTo(map);
    targetLayerGroupRef.current = L.featureGroup().addTo(map);
    journeyLayerGroupRef.current = L.featureGroup().addTo(map);
    stopsLayerGroupRef.current = L.layerGroup().addTo(map);
    searchLayerGroupRef.current = L.featureGroup().addTo(map);

    map.on('click', (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current([e.latlng.lat, e.latlng.lng]);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Map Search Location Pin & FlyTo
  useEffect(() => {
    const map = mapRef.current;
    const group = searchLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (!searchLocation || !searchLocation.coord) return;

    const [lat, lng] = searchLocation.coord;
    const isMetro = searchLocation.type === 'metro_station';

    const searchIcon = L.divIcon({
      className: 'custom-search-location-marker',
      html: `
        <div class="search-location-pin ${isMetro ? 'metro' : 'place'}">
          <span class="search-pin-emoji">${svg(isMetro ? ICONS.train : ICONS.pin, 18)}</span>
          <div class="search-pin-pulse"></div>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 40],
      popupAnchor: [0, -38]
    });

    const popupHtml = `
      <div class="search-popup-card">
        <div class="search-popup-header">
          <span class="search-popup-icon">${svg(isMetro ? ICONS.train : ICONS.pin, 16)}</span>
          <div>
            <strong class="search-popup-title">${searchLocation.name}</strong>
            <div class="search-popup-cat">${searchLocation.category || (isMetro ? 'محطة مترو أنفاق' : 'معلم / مكان')}</div>
          </div>
        </div>
        ${searchLocation.district ? `<div class="search-popup-meta">الحي / المنطقة: <strong>${searchLocation.district}</strong></div>` : ''}
        ${searchLocation.lines && searchLocation.lines.length > 0 ? `<div class="search-popup-lines">خطوط المترو المارة: <strong>${searchLocation.lines.join(', ')}</strong></div>` : ''}
      </div>
    `;

    const marker = L.marker([lat, lng], { icon: searchIcon })
      .bindPopup(popupHtml, { maxWidth: 300, closeButton: false });
    
    group.addLayer(marker);
    marker.openPopup();

    map.flyTo([lat, lng], 15.5, { duration: 1.2 });
  }, [searchLocation]);

  // Draw Selected Route (Explorer Mode or Single Route Preview or Active Nearest Route)
  useEffect(() => {
    const map = mapRef.current;
    const group = routeLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // In Nearest mode, always render the route of the active nearest drop point so the transit line is ALWAYS visible!
    const routeToRender = (activeTab === 'nearest' && activeNearest?.route) 
      ? activeNearest.route 
      : selectedRoute;

    if (!routeToRender || !geometries || !geometries[routeToRender.id]) return;

    const coords = geometries[routeToRender.id];
    if (!coords || coords.length === 0) return;

    const color = routeToRender.color || VEHICLE_COLORS[routeToRender.vehicle] || VEHICLE_COLORS.Default;
    const isMetro = routeToRender.vehicle === 'Metro';

    const glowLine = L.polyline(coords, {
      color: '#FFFFFF',
      weight: isMetro ? 12 : 10,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    });

    const mainLine = L.polyline(coords, {
      color: color,
      weight: isMetro ? 7 : 5,
      opacity: 0.98,
      lineCap: 'round',
      lineJoin: 'round'
    });

    group.addLayer(glowLine);
    group.addLayer(mainLine);

    const startPt = coords[0];
    const endPt = coords[coords.length - 1];

    const startIcon = L.divIcon({
      className: 'custom-terminal-marker',
      html: isMetro 
        ? `<div class="custom-terminal-icon metro" style="background:${color};" title="${t.startTerminal}: ${routeToRender.origin}">${svg(ICONS.train, 15)}</div>`
        : `<div class="custom-terminal-icon start" title="${t.startTerminal}: ${routeToRender.origin}">أ</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const endIcon = L.divIcon({
      className: 'custom-terminal-marker',
      html: isMetro 
        ? `<div class="custom-terminal-icon metro" style="background:${color};" title="${t.endTerminal}: ${routeToRender.dest}">${svg(ICONS.train, 15)}</div>`
        : `<div class="custom-terminal-icon end" title="${t.endTerminal}: ${routeToRender.dest}">ب</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    group.addLayer(
      L.marker(startPt, { icon: startIcon }).bindPopup(`<strong>${t.startTerminal}:</strong> ${routeToRender.origin}`)
    );
    group.addLayer(
      L.marker(endPt, { icon: endIcon }).bindPopup(`<strong>${t.endTerminal}:</strong> ${routeToRender.dest}`)
    );


    if (activeTab === 'explore' && !targetCoord) {
      fitWithOverlays(mainLine.getBounds(), { maxZoom: 15 });
    }
  }, [selectedRoute, activeNearest, geometries, lang, activeTab]);

  // Phase 2: Nearest Drop Point Overlay
  useEffect(() => {
    const map = mapRef.current;
    const group = targetLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (activeTab !== 'nearest' || !targetCoord) return;

    // Target Marker
    const targetIcon = L.divIcon({
      className: 'custom-target-marker',
      html: `<div class="target-pin-pulse">${svg(ICONS.pin, 22, 2.2)}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    group.addLayer(
      L.marker(targetCoord, { icon: targetIcon }).bindPopup(`<strong>${t.destinationTarget}</strong>`)
    );

    // If active nearest item is selected
    if (activeNearest && activeNearest.dropCoord) {
      const dropCoord = activeNearest.dropCoord;
      const stopTitle = activeNearest.nearestStop 
        ? (lang === 'ar' ? activeNearest.nearestStop.ar : activeNearest.nearestStop.en)
        : (lang === 'ar' ? 'نقطة النزول' : 'Drop-off Point');
      const isOfficialStop = activeNearest.nearestStop?.isOfficialStop;

      const dropIcon = L.divIcon({
        className: 'custom-drop-marker',
        html: `<div class="drop-pin">${svg(ICONS.walk, 15)}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });

      const initialPopupHtml = `
        <div class="walk-popup-card">
          <div class="walk-popup-header">
            <span class="walk-popup-icon">${svg(ICONS.walk, 15)}</span>
            <div>
              <strong class="walk-popup-title">${stopTitle}</strong>
              <div class="walk-popup-cat">${isOfficialStop ? (lang === 'ar' ? 'محطة نزول رسمية' : 'Official Bus Stop') : (lang === 'ar' ? 'أقرب نقطة على المسار' : 'Nearest Route Point')}</div>
            </div>
          </div>
          <div class="walk-popup-metrics">
            <span>${lang === 'ar' ? 'المسافة المقدرة:' : 'Est. Walk:'} <strong>${activeNearest.distanceMeters} م</strong> (~${activeNearest.walkMinutes} د)</span>
          </div>
        </div>
      `;

      const dropMarker = L.marker(dropCoord, { icon: dropIcon })
        .bindPopup(initialPopupHtml, { maxWidth: 300 });
      group.addLayer(dropMarker);

      // Clean preview walking line (dual-layer casing + dash)
      let previewCasing = L.polyline([dropCoord, targetCoord], {
        color: '#FFFFFF',
        weight: 7,
        opacity: 0.9,
        lineCap: 'round'
      });
      let previewCore = L.polyline([dropCoord, targetCoord], {
        color: WALK_LINE,
        weight: 3.5,
        dashArray: '1, 8',
        lineCap: 'round',
        opacity: 0.95
      });
      group.addLayer(previewCasing);
      group.addLayer(previewCore);

      fitWithOverlays(L.latLngBounds([dropCoord, targetCoord]), { maxZoom: 16 });

      // Asynchronously fetch real street pedestrian route with anomaly detection
      let isCancelled = false;
      let walkLayers = [previewCasing, previewCore];

      fetchWalkingRoute(dropCoord, targetCoord).then((walkResult) => {
        if (isCancelled || !walkResult || !walkResult.path || walkResult.path.length === 0) return;

        // Clear preview polylines
        walkLayers.forEach(l => {
          try { group.removeLayer(l); } catch (e) {}
        });
        walkLayers = [];

        if (walkResult.isDetourAnomalous) {
          // 1. If anomalous detour: Draw the DIRECT pedestrian access path as primary
          const directCasing = L.polyline([dropCoord, targetCoord], {
            color: '#FFFFFF',
            weight: 7,
            opacity: 0.95,
            lineCap: 'round'
          });
          const directCore = L.polyline([dropCoord, targetCoord], {
            color: WALK_LINE,
            weight: 3.5,
            dashArray: '1, 8',
            lineCap: 'round',
            opacity: 0.98
          });
          group.addLayer(directCasing);
          group.addLayer(directCore);
          walkLayers.push(directCasing, directCore);

          // Optionally render faint detour line to explain OSM barrier diversion
          if (walkResult.osrmPath && walkResult.osrmPath.length > 0) {
            const detourFaint = L.polyline(walkResult.osrmPath, {
              color: '#94a3b8',
              weight: 2,
              dashArray: '5, 8',
              opacity: 0.35,
              lineCap: 'round'
            });
            group.addLayer(detourFaint);
            walkLayers.push(detourFaint);
          }

          // Update popup with clear direct walk info + perimeter detour notice
          dropMarker.setPopupContent(`
            <div class="walk-popup-card">
              <div class="walk-popup-header">
                <span class="walk-popup-icon">${svg(ICONS.walk, 15)}</span>
                <div>
                  <strong class="walk-popup-title">${stopTitle}</strong>
                  <div class="walk-popup-cat">${isOfficialStop ? (lang === 'ar' ? 'محطة نزول رسمية' : 'Official Bus Stop') : (lang === 'ar' ? 'أقرب نقطة على المسار' : 'Nearest Route Point')}</div>
                </div>
              </div>
              <div class="walk-popup-metrics">
                <span>${lang === 'ar' ? 'المسار المباشر للوجهة:' : 'Direct walk:'} <strong>${walkResult.distanceMeters} م</strong> (~${walkResult.durationMinutes} دقيقة)</span>
              </div>
              <div class="walk-popup-detour-alert">
                ${svg(ICONS.alert, 14)} ${lang === 'ar' 
                  ? `مسار شوارع الخرائط يتضمن التفافاً (${walkResult.osrmDistanceMeters} م) بسبب الأسوار أو بوابات غير مربوطة. يُرجى الدخول من أقرب بوابة.` 
                  : `Street routing has a perimeter detour (${walkResult.osrmDistanceMeters}m) around walls. Please enter through the nearest gate.`}
              </div>
            </div>
          `);
        } else {
          // 2. Normal street walking route: Draw smooth dual-layer street polyline
          const streetCasing = L.polyline(walkResult.path, {
            color: '#FFFFFF',
            weight: 7,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round'
          });
          const streetCore = L.polyline(walkResult.path, {
            color: WALK_LINE,
            weight: 3.5,
            dashArray: '1, 8',
            lineCap: 'round',
            lineJoin: 'round',
            opacity: 0.98
          });
          group.addLayer(streetCasing);
          group.addLayer(streetCore);
          walkLayers.push(streetCasing, streetCore);

          // Update popup with street walk distance
          dropMarker.setPopupContent(`
            <div class="walk-popup-card">
              <div class="walk-popup-header">
                <span class="walk-popup-icon">${svg(ICONS.walk, 15)}</span>
                <div>
                  <strong class="walk-popup-title">${stopTitle}</strong>
                  <div class="walk-popup-cat">${isOfficialStop ? (lang === 'ar' ? 'محطة نزول رسمية' : 'Official Bus Stop') : (lang === 'ar' ? 'أقرب نقطة على المسار' : 'Nearest Route Point')}</div>
                </div>
              </div>
              <div class="walk-popup-metrics">
                <span>${lang === 'ar' ? 'المشي عبر الشوارع:' : 'Street walk:'} <strong>${walkResult.distanceMeters} م</strong> (~${walkResult.durationMinutes} دقيقة)</span>
              </div>
            </div>
          `);
        }
      });

      return () => {
        isCancelled = true;
      };
    } else {
      map.setView(targetCoord, 14, { animate: true });
    }
  }, [targetCoord, activeNearest, activeTab, lang]);

  // Phase 3: Journey Planner (A to B) Visualizer
  useEffect(() => {
    const map = mapRef.current;
    const group = journeyLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (activeTab !== 'planner') return;

    // 1. Origin Marker (A)
    if (originCoord) {
      const originIcon = L.divIcon({
        className: 'custom-origin-marker',
        html: `<div class="origin-pin">أ</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      group.addLayer(
        L.marker(originCoord, { icon: originIcon }).bindPopup(`<strong>${t.originLabel}</strong>`)
      );
    }

    // 2. Destination Marker (B)
    if (destCoord) {
      const destIcon = L.divIcon({
        className: 'custom-dest-marker',
        html: `<div class="dest-pin">ب</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      group.addLayer(
        L.marker(destCoord, { icon: destIcon }).bindPopup(`<strong>${t.destLabel}</strong>`)
      );
    }

    // 3. Draw Active Journey (Direct or Transfer)
    if (activeJourney) {
      if (activeJourney.type === 'direct') {
        const { route, pickupCoord, dropCoord } = activeJourney;
        const color = VEHICLE_COLORS[route.vehicle] || VEHICLE_COLORS.Default;

        // Walking to pickup line
        const walkToPickup = L.polyline([originCoord, pickupCoord], {
          color: WALK_LINE,
          weight: 3.5,
          dashArray: '1, 8',
          opacity: 0.9
        });
        group.addLayer(walkToPickup);

        // Pickup stop marker
        const pickupIcon = L.divIcon({
          className: 'pickup-pin',
          html: `<div class="step-stop-pin pickup" style="background:${color};${route.vehicle === 'Minibus' ? 'color:#15171C;' : ''}">${svg(ICONS.bus, 12)} ${route.num}</div>`,
          iconSize: [70, 26],
          iconAnchor: [35, 13]
        });
        group.addLayer(
          L.marker(pickupCoord, { icon: pickupIcon }).bindPopup(`<strong>ركوب ${route.num}</strong>`)
        );

        // Dropoff stop marker
        const dropIcon = L.divIcon({
          className: 'drop-pin-badge',
          html: `<div class="step-stop-pin drop">${svg(ICONS.walk, 12)} نزول</div>`,
          iconSize: [60, 26],
          iconAnchor: [30, 13]
        });
        group.addLayer(
          L.marker(dropCoord, { icon: dropIcon }).bindPopup(`<strong>نزول من ${route.num}</strong>`)
        );

        // Walking from drop to B line
        const walkFromDrop = L.polyline([dropCoord, destCoord], {
          color: WALK_LINE,
          weight: 3.5,
          dashArray: '1, 8',
          opacity: 0.9
        });
        group.addLayer(walkFromDrop);

        // Fit whole journey into view
        const journeyBounds = L.latLngBounds([originCoord, destCoord, pickupCoord, dropCoord]);
        fitWithOverlays(journeyBounds);
      } else if (activeJourney.type === 'transfer') {
        const { hub, leg1, leg2 } = activeJourney;

        // Second leg line (first leg is drawn as the selected route)
        const leg2Coords = geometries && geometries[leg2.route.id];
        if (leg2Coords && leg2Coords.length > 1) {
          const leg2Color = leg2.route.color || VEHICLE_COLORS[leg2.route.vehicle] || VEHICLE_COLORS.Default;
          group.addLayer(L.polyline(leg2Coords, { color: '#FFFFFF', weight: 10, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }));
          group.addLayer(L.polyline(leg2Coords, { color: leg2Color, weight: 5, opacity: 0.98, lineCap: 'round', lineJoin: 'round' }));
        }

        // Hub marker
        const hubIcon = L.divIcon({
          className: 'hub-pin',
          html: `<div class="step-stop-pin hub">${svg(ICONS.swap, 12)} ${hub.name_ar}</div>`,
          iconSize: [110, 28],
          iconAnchor: [55, 14]
        });
        group.addLayer(
          L.marker(hub.coord, { icon: hubIcon }).bindPopup(`<strong>موقف التبديل: ${hub.name_ar}</strong>`)
        );

        // Walk to leg1
        group.addLayer(
          L.polyline([originCoord, leg1.pickupCoord], {
            color: WALK_LINE,
            weight: 3,
            dashArray: '1, 7'
          })
        );

        // Walk from leg2 to dest
        group.addLayer(
          L.polyline([leg2.destDropCoord, destCoord], {
            color: WALK_LINE,
            weight: 3,
            dashArray: '1, 7'
          })
        );

        fitWithOverlays(L.latLngBounds([originCoord, destCoord, hub.coord]));
      }
    } else if (originCoord && destCoord) {
      fitWithOverlays(L.latLngBounds([originCoord, destCoord]));
    }
  }, [activeTab, originCoord, destCoord, activeJourney, geometries, lang]);

  // "Fit route" button: frame everything currently drawn for the active mode
  useEffect(() => {
    if (!fitRequest || !mapRef.current) return;
    const groups = [routeLayerGroupRef, journeyLayerGroupRef, targetLayerGroupRef]
      .map(ref => ref.current)
      .filter(g => g && g.getLayers().length > 0);
    if (groups.length === 0) return;
    const bounds = L.latLngBounds([]);
    groups.forEach(g => {
      const b = g.getBounds();
      if (b.isValid()) bounds.extend(b);
    });
    fitWithOverlays(bounds, { maxZoom: 16 });
  }, [fitRequest]);

  // Stops Overlay
  useEffect(() => {
    const group = stopsLayerGroupRef.current;
    if (!group) return;

    group.clearLayers();

    if (showStops && stops && stops.length > 0) {
      const bounds = mapRef.current.getBounds();
      const visibleStops = stops.filter(s => bounds.contains([s.lat, s.lng]));

      visibleStops.forEach(s => {
        const isMetro = s.type === 'metro';
        const circle = L.circleMarker([s.lat, s.lng], {
          radius: isMetro ? 6.5 : 4.5,
          color: '#FFFFFF',
          weight: isMetro ? 2.5 : 1.5,
          fillColor: isMetro ? (s.is_interchange ? '#15171C' : '#2E4A78') : '#4E535C',
          fillOpacity: 0.95
        }).bindPopup(`<strong>${lang === 'ar' ? (s.name_ar || s.name_en) : s.name_en}</strong>${isMetro && s.is_interchange ? '<br><span style="color:#4E535C;font-weight:600;">محطة تبادلية</span>' : ''}`);

        group.addLayer(circle);
      });

    }
  }, [showStops, stops, lang]);

  return <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />;
}
