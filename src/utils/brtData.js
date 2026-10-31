const SOURCE_METADATA = catalogue => ({
  sourceName: catalogue.source?.name,
  sourceUrl: catalogue.source?.url,
  sourceVerification: catalogue.source?.verification,
  servicePatternStatus: catalogue.service?.status,
  servicePatternSources: catalogue.service?.patternSources || [],
  serviceCorridorSource: catalogue.service?.corridorStatusSource,
  serviceCaveat: catalogue.service?.caveat,
  geometrySource: catalogue.geometry?.source,
  geometryVerification: catalogue.geometry?.verification,
  stationAccessVerified: false,
  transferAccessVerified: false
});

function distanceMeters(a, b) {
  const radians = value => value * Math.PI / 180;
  const lat1 = radians(a[0]), lat2 = radians(b[0]);
  const dLat = lat2 - lat1, dLng = radians(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function composeBrtRuntime(catalogue) {
  if (!catalogue || catalogue.version !== 1 || !Array.isArray(catalogue.stations) || !Array.isArray(catalogue.geometry?.coordinates)) {
    throw new Error('Invalid BRT catalogue');
  }
  const service = catalogue.service || {};
  const active = catalogue.stations.filter(station => station.status === 'active-corridor-candidate');
  const startIndex = active.findIndex(station => station.id === service.startStationId);
  const endIndex = active.findIndex(station => station.id === service.endStationId);
  if (startIndex < 0 || endIndex <= startIndex) throw new Error('Invalid BRT service boundaries');
  const calls = active.slice(startIndex, endIndex + 1);
  const common = SOURCE_METADATA(catalogue);
  const routes = [];
  const trips = [];
  const stops = calls.map(station => ({
    id: station.id,
    sourceId: station.id,
    nameEn: station.nameEn,
    nameAr: station.nameAr,
    aliases: station.aliases || [],
    lat: station.lat,
    lng: station.lng,
    source: 'community-reference-estimated',
    status: station.status,
    stationAccessVerified: false,
    transferAccessVerified: false,
    sourceMetadata: common
  }));
  const shapes = [catalogue.geometry.coordinates, [...catalogue.geometry.coordinates].reverse()];
  const directionCalls = [calls, [...calls].reverse()];
  for (let dir = 0; dir < 2; dir++) {
    const id = dir === 0 ? 'brt_agricultural_road_sun_capital' : 'brt_sun_capital_agricultural_road';
    const ordered = directionCalls[dir];
    const shape = shapes[dir];
    const shapeCoords = shape.map(([lng, lat]) => [lat, lng]);
    const shapeLengthMeters = shapeCoords.slice(1).reduce((sum, point, index) => sum + distanceMeters(shapeCoords[index], point), 0);
    const bounds = [[Math.min(...shapeCoords.map(point => point[0])), Math.min(...shapeCoords.map(point => point[1]))],
      [Math.max(...shapeCoords.map(point => point[0])), Math.max(...shapeCoords.map(point => point[1]))]];
    const start = ordered[0], end = ordered.at(-1);
    const route = {
      id, route_id: 'BRT', num: 'BRT', vehicle: 'BRT', agency: 'BRT Cairo', dir,
      short_en: 'Cairo BRT', short_ar: 'الأتوبيس الترددي السريع',
      long_en: `Cairo BRT (${start.nameEn} - ${end.nameEn})`,
      long_ar: `الأتوبيس الترددي السريع (${start.nameAr} - ${end.nameAr})`,
      origin: start.nameAr, dest: end.nameAr,
      origin_en: start.nameEn, dest_en: end.nameEn, origin_ar: start.nameAr, dest_ar: end.nameAr,
      len_km: Math.round(shapeLengthMeters / 100) / 10, bounds,
      color: '#087E8B', via_stops: ordered.map(station => station.nameAr),
      via_stops_en: ordered.map(station => station.nameEn), via_stops_ar: ordered.map(station => station.nameAr),
      stopIds: ordered.map(station => station.id),
      boardingMode: 'fixed-station', supportsFlexibleAlighting: false,
      geometryEstimated: true, distanceEstimated: true, sourceMetadata: common
    };
    const trip = {
      id, sourceTripId: id, appRouteId: id, routeId: 'BRT', source: 'community-reference-estimated',
      directionId: String(dir), distanceEstimated: true, sourceMetadata: common,
      calls: ordered.map((station, index) => ({
        stopId: station.id,
        sequence: index + 1,
        canBoard: true,
        canAlight: true,
        distanceMeters: Math.round(Math.abs(station.distanceMeters - start.distanceMeters) * 10) / 10,
        distanceEstimated: true,
        sourceMetadata: common
      }))
    };
    routes.push(route);
    trips.push(trip);
  }
  return { routes, trips, stops, geometries: Object.fromEntries(routes.map((route, index) => [route.id,
    shapes[index].map(([lng, lat]) => [lat, lng])])), metadata: { ...common, historical: false, servicesVerified: false } };
}

export function mergeBrtRoutes(routes, catalogue) {
  if (!catalogue) {
    routes.brtUnavailable = true;
    return routes;
  }
  const runtime = composeBrtRuntime(catalogue);
  return [...routes.filter(route => !route.id?.startsWith('brt_')), ...runtime.routes];
}

export function mergeBrtNetwork(network, catalogue) {
  if (!catalogue) return { ...network, metadata: { ...network.metadata, brtUnavailable: true } };
  const runtime = composeBrtRuntime(catalogue);
  const routeIds = new Set(runtime.routes.map(route => route.id));
  return {
    ...network,
    version: `${network.version || 1}+brt1`,
    metadata: { ...network.metadata, brt: runtime.metadata, brtServiceStatus: catalogue.service?.status },
    routes: [...(network.routes || []).filter(route => !routeIds.has(route.id)), ...runtime.routes],
    stops: [...(network.stops || []).filter(stop => !runtime.stops.some(brtStop => brtStop.id === stop.id)), ...runtime.stops],
    trips: [...(network.trips || []).filter(trip => !routeIds.has(trip.appRouteId)), ...runtime.trips]
  };
}

export function mergeBrtGeometries(geometries, catalogue) {
  if (!catalogue) return Object.assign(geometries, { brtUnavailable: true });
  return { ...geometries, ...composeBrtRuntime(catalogue).geometries };
}
