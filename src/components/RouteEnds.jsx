import React from 'react';
import { getRouteEnds, westernDigits } from '../utils/routeEnds';

// "من آخر ترسا ← إلى أحمد حلمي": explicit start and end of a line.
// Falls back to the full line name when the ends aren't known.
export default function RouteEnds({ route, lang = 'ar', fallback, className = '' }) {
  const { from, to } = getRouteEnds(route, lang);
  const ar = lang === 'ar';
  if (!from && !to) return <span className={className}>{westernDigits(fallback)}</span>;
  if (from && !to) {
    return (
      <span className={`route-ends ${className}`}>
        <span className="route-ends-name">{westernDigits(fallback)}</span>
        <span className="route-ends-sub">
          <span className="route-ends-tag">{ar ? 'يبدأ من' : 'starts at'}</span>{' '}{from}
        </span>
      </span>
    );
  }
  return (
    <span className={`route-ends ${className}`} title={fallback}>
      {/* real spaces between parts: Arabic letters would otherwise join across elements */}
      <span className="route-ends-tag">{ar ? 'من' : 'from'}</span>{' '}
      <span className="route-ends-from">{from}</span>{' '}
      <span className="route-ends-arrow" aria-hidden="true">{ar ? '←' : '→'}</span>{' '}
      <span className="route-ends-tag">{ar ? 'إلى' : 'to'}</span>{' '}
      <span className="route-ends-to">{to}</span>
    </span>
  );
}
