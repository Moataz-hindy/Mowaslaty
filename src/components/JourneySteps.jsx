import React from 'react';
import { Bus, Footprints, MapPin } from 'lucide-react';
import { vehicleRouteLabel } from '../utils/routeEnds';
import { I18N } from '../utils/i18n';

const stopName = (stop, lang, fallback) => (lang === 'ar'
  ? (stop?.nameAr || stop?.name_ar || stop?.nameEn || stop?.name_en)
  : (stop?.nameEn || stop?.name_en || stop?.nameAr || stop?.name_ar)) || fallback;

export function JourneySteps({ journey, lang = 'ar', t = {}, onStartTrip, isSelected = false, showNotices = false, summaryMode = 'full' }) {
  if (!journey) return null;
  const label = (key, ...args) => {
    const value = t[key] ?? I18N[lang]?.[key] ?? I18N.en[key];
    if (typeof value === 'function') return value(...args);
    if (typeof value === 'string') return value;
    return key;
  };
  const metres = value => Math.round(Number(value) || 0);
  const minutes = value => Math.round(Number(value) || 0);
  const legs = Array.isArray(journey.legs) ? journey.legs : [];
  const rideCount = legs.filter(leg => leg.kind === 'ride').length;
  const hasSuggestedDrop = legs.some(leg => leg.kind === 'ride' && leg.flexibleDrop);
  const hasBrtRide = legs.some(leg => leg.kind === 'ride' && leg.route?.vehicle === 'BRT');
  const metric = (key, value) => <span className="journey-leg-metric" key={key}>{value}</span>;
  return <>
    {summaryMode !== 'none' && <div className="journey-summary">
      {summaryMode === 'full' && <span>{label('journeyTransferCount', journey.transfers ?? Math.max(0, rideCount - 1))}</span>}
      <span>{label('totalWalkDistance', metres(journey.totalWalkMeters))}</span>
      {summaryMode === 'full' && <span>{label('totalTripTime', minutes(journey.totalTimeMinutes))}</span>}
    </div>}
    {hasSuggestedDrop && <p className="journey-suggested-drop-notice">{label('journeySuggestedDropNotice')}</p>}
    <div className="itinerary-steps">
      {legs.map((leg, index) => leg.kind === 'walk' ? (
        <div className="journey-walk-strip" key={`${journey.id || 'journey'}-walk-${index}`} data-walk-purpose={leg.purpose}>
          <span className="journey-walk-icon" aria-hidden="true"><Footprints size={14} /></span>
          <span className="journey-walk-copy">
            <strong>{label(leg.purpose === 'access' ? 'journeyAccessLabel' : leg.purpose === 'egress' ? 'journeyEgressLabel' : 'journeyTransferLabel')}</strong>
            <span>{label(leg.purpose === 'access' ? 'journeyAccessWalk' : leg.purpose === 'egress' ? 'journeyEgressWalk' : 'journeyTransferWalk', metres(leg.distanceMeters), minutes(leg.durationMinutes))}</span>
          </span>
        </div>
      ) : (
        <article className="journey-ride-block" key={`${journey.id || 'journey'}-ride-${index}`} data-vehicle={leg.route?.vehicle}>
          <header className="journey-ride-heading">
            <span className="journey-ride-icon" aria-hidden="true"><Bus size={15} /></span>
            <strong>{vehicleRouteLabel(leg.route, lang) || label('journeyUnknownVehicle')}</strong>
            <span className="journey-ride-metrics">
              {metric('distance', `${(Number(leg.distanceMeters || 0) / 1000).toFixed(1)} ${label('kilometresShort')}`)}
              {metric('duration', label('estimatedMinutesShort', minutes(leg.durationMinutes)))}
            </span>
          </header>
          {leg.route?.vehicle === 'BRT' && <p className="journey-data-notice">{label('brtServiceCaveat')}</p>}
          <div className="journey-stop-row">
            <span className="journey-stop-dot" aria-hidden="true" />
            <span className="journey-stop-label">{label('journeyBoardingLabel')}</span>
            <strong>{stopName(leg.fromStop, lang, label('journeyUnknownStop'))}</strong>
          </div>
          <div className={`journey-stop-row ${leg.flexibleDrop ? 'suggested' : ''}`}>
            <span className="journey-stop-dot" aria-hidden="true" />
            <span className="journey-stop-label">{label(leg.flexibleDrop ? 'journeySuggestedAlightingLabel' : 'journeyAlightingLabel')}</span>
            <strong>{leg.flexibleDrop ? label('journeySuggestedPoint') : stopName(leg.toStop, lang, label('journeyUnknownStop'))}</strong>
          </div>
        </article>
      ))}
    </div>
    {showNotices && rideCount > 0 && <p className="journey-walk-notice">{label('journeyWalkNotice')}</p>}
    {showNotices && !hasBrtRide && <p className="journey-data-notice">{label('journeyServiceNotice')}</p>}
    {rideCount === 1 && isSelected && onStartTrip && <button type="button" className="btn-primary trip-start-btn" onClick={onStartTrip}>
      <MapPin size={15} /><span>{lang === 'ar' ? 'تتبع هذه الرحلة حتى محطة النزول' : 'Track this ride to its alighting stop'}</span>
    </button>}
  </>;
}

export default JourneySteps;
