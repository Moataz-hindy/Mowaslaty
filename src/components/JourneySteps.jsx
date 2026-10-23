import React from 'react';
import { Bus, Footprints, MapPin } from 'lucide-react';
import { vehicleRouteLabel } from '../utils/routeEnds';

const stopName = (stop, lang) => lang === 'ar'
  ? (stop?.nameAr || stop?.name_ar || stop?.nameEn || stop?.name_en || '')
  : (stop?.nameEn || stop?.name_en || stop?.nameAr || stop?.name_ar || '');

export function JourneySteps({ journey, lang = 'ar', t = {}, onStartTrip, isSelected = false, showNotices = false }) {
  if (!journey) return null;
  const text = key => t[key] || key;
  const metres = value => Math.round(Number(value) || 0);
  const minutes = value => Math.round(Number(value) || 0);
  const rideCount = (journey.legs || []).filter(leg => leg.kind === 'ride').length;
  const hasSuggestedDrop = (journey.legs || []).some(leg => leg.kind === 'ride' && leg.flexibleDrop);
  return <>
    <div className="journey-summary">
      <span>{text('journeyTransferCount')(journey.transfers || Math.max(0, rideCount - 1))}</span>
      <span>{text('totalWalkDistance')(metres(journey.totalWalkMeters || 0))}</span>
      <span>{text('totalTripTime')(minutes(journey.totalTimeMinutes || 0))}</span>
    </div>
    {hasSuggestedDrop && <p className="journey-suggested-drop-notice">{text('journeySuggestedDropNotice')}</p>}
    <div className="itinerary-steps">
      {(journey.legs || []).map((leg, index) => leg.kind === 'walk' ? (
        <div className="step-item" key={`${journey.id}-walk-${index}`} data-walk-purpose={leg.purpose}>
          <span className="step-icon walk" aria-hidden="true"><Footprints size={13} /></span>
          <span>{text(leg.purpose === 'access' ? 'journeyAccessWalk' : leg.purpose === 'egress' ? 'journeyEgressWalk' : 'journeyTransferWalk')(metres(leg.distanceMeters), minutes(leg.durationMinutes))}</span>
        </div>
      ) : (
        <div className="step-item" key={`${journey.id}-ride-${index}`} data-vehicle={leg.route?.vehicle}>
          <span className="step-icon bus" aria-hidden="true"><Bus size={13} /></span>
          <span>{leg.flexibleDrop
            ? text('journeySuggestedRideInstruction')(vehicleRouteLabel(leg.route, lang), stopName(leg.fromStop, lang), (Number(leg.distanceMeters || 0) / 1000).toFixed(1), minutes(leg.durationMinutes))
            : text('journeyRideInstruction')(vehicleRouteLabel(leg.route, lang), stopName(leg.fromStop, lang), stopName(leg.toStop, lang), (Number(leg.distanceMeters || 0) / 1000).toFixed(1), minutes(leg.durationMinutes))}</span>
        </div>
      ))}
    </div>
    {showNotices && rideCount > 0 && <p className="journey-walk-notice">{text('journeyWalkNotice')}</p>}
    {showNotices && <p className="journey-data-notice">{text('journeyServiceNotice')}</p>}
    {rideCount === 1 && isSelected && onStartTrip && <button type="button" className="btn-primary trip-start-btn" onClick={onStartTrip}>
      <MapPin size={15} /><span>{lang === 'ar' ? 'تتبع هذه الرحلة حتى محطة النزول' : 'Track this ride to its alighting stop'}</span>
    </button>}
  </>;
}

export default JourneySteps;
