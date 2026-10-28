export function routeIdFromSearch(search) {
  return new URLSearchParams(search).get('route');
}

// Routes passed here have already gone through the app's route policy filter.
// Exact IDs preserve direction and never fall back to a similarly named route.
export function resolveExactRoute(routes, routeId) {
  if (!routeId) return null;
  return routes.find(route => route.id === routeId) || null;
}
