import React, { useEffect, useState } from 'react';
import { VEHICLE_COLORS } from '../utils/i18n';
import { getRouteEnds, lineLabel } from '../utils/routeEnds';
import { ArrowLeftRight, Focus, X, Footprints, MapPin, ExternalLink, AlertTriangle, Navigation, ChevronDown, ChevronUp } from 'lucide-react';

export default function RouteDrawer({
  selectedRoute,
  onClose,
  onToggleDirection,
  onFitRoute,
  drop = null,
  targetCoord = null,
  onClearTarget,
  onStartTrip,
  lang,
  t
}) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  useEffect(() => setDetailsExpanded(false), [selectedRoute?.id]);

  if (!selectedRoute) return null;

  const color = VEHICLE_COLORS[selectedRoute.vehicle] || VEHICLE_COLORS.Default;
  const name = lang === 'ar' ? (selectedRoute.long_ar || selectedRoute.long_en) : (selectedRoute.long_en || selectedRoute.long_ar);
  const dirText = selectedRoute.dir === 0 ? t.dirOutbound : t.dirInbound;
  const vehicleText = t[String(selectedRoute.vehicle).toLowerCase()] || selectedRoute.vehicle;

  // Bus-front style: "← destination", start shown underneath
  const { from: originName, to: destName } = getRouteEnds(selectedRoute, lang);
  const signTitle = destName ? `${lang === 'ar' ? '←' : '→'} ${destName}` : name;
  const signMeta = [
    originName ? (lang === 'ar' ? `من ${originName}` : `from ${originName}`) : null,
    vehicleText,
    dirText
  ].filter(Boolean).join(' · ');
  const hasDropInfo = Boolean(drop && targetCoord);
  const farFromDestination = hasDropInfo && drop.distanceMeters > 2000;
  const dropDistanceText = hasDropInfo
    ? (drop.distanceMeters >= 1000
      ? `${(drop.distanceMeters / 1000).toFixed(1)} ${lang === 'ar' ? 'كم' : 'km'}`
      : `${drop.distanceMeters} ${lang === 'ar' ? 'م' : 'm'}`)
    : null;
  const dropTimeText = hasDropInfo
    ? (lang === 'ar' ? `≈ ${drop.walkMinutes} دقيقة مشي` : `≈ ${drop.walkMinutes} min walk`)
    : null;

  return (
    <section
      className={`active-route-drawer ${detailsExpanded ? 'details-expanded' : ''}`}
      style={{ '--active-route-color': color, '--card-color': color }}
      data-vehicle={selectedRoute.vehicle}
      data-details-expanded={detailsExpanded}
      aria-label={lang === 'ar' ? 'الخط المحدد' : 'Selected line'}
    >
      <div className="drawer-header">
        <div className="drawer-title-group">
          <span className="route-badge-lg">{lineLabel(selectedRoute, lang)}</span>
          <div>
            <h3 className="detail-name" title={name}>{signTitle}</h3>
            <p className="detail-meta">{signMeta}</p>
          </div>
        </div>
        <button className="icon-btn-close" onClick={onClose} aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}>
          <X size={18} />
        </button>
      </div>

      <div
        className={`route-drawer-summary ${farFromDestination ? 'far' : ''}`}
        role="status"
        aria-label={hasDropInfo
          ? (farFromDestination
            ? `${lang === 'ar' ? 'بعيد عن وجهتك' : 'Far from destination'}: ${dropDistanceText}, ${dropTimeText}`
            : `${dropDistanceText}, ${dropTimeText}`)
          : `${t.lengthLabel}: ${selectedRoute.len_km} ${t.kmUnit}`}
      >
        {hasDropInfo
          ? <Footprints size={15} aria-hidden="true" />
          : <MapPin size={15} aria-hidden="true" />}
        <span>
          {hasDropInfo
            ? `${dropDistanceText} · ${dropTimeText}`
            : `${t.lengthLabel}: ${selectedRoute.len_km} ${t.kmUnit}`}
        </span>
        {farFromDestination && <AlertTriangle size={15} aria-hidden="true" />}
      </div>
      {selectedRoute.vehicle === 'BRT' && <div className="journey-data-notice">
        <p>{lang === 'ar' ? 'هندسة المسار مستندة إلى خريطة مجتمعية تقديرية. نمط الخدمة ومحطاتها مستندان إلى تقارير صحفية؛ راجع المشغل قبل الرحلة. مداخل المحطات والتحويلات غير متحققة.' :
          'The route shape comes from an approximate community map. Service pattern and calls come from press reports; confirm with the operator. Station entrances and transfers are unverified.'}</p>
        <div className="brt-sources">
          {selectedRoute.sourceMetadata?.geometrySource && <a href={selectedRoute.sourceMetadata.geometrySource} target="_blank" rel="noopener noreferrer">{lang === 'ar' ? 'مرجع الخريطة المجتمعي' : 'Community map reference'}</a>}
          {selectedRoute.sourceMetadata?.serviceCorridorSource && <a href={selectedRoute.sourceMetadata.serviceCorridorSource} target="_blank" rel="noopener noreferrer">{lang === 'ar' ? 'إعلان حدود التشغيل' : 'Operating boundary announcement'}</a>}
          {(selectedRoute.sourceMetadata?.servicePatternSources || []).map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{lang === 'ar' ? 'تقرير نمط الخدمة' : 'Reported service pattern'}</a>)}
        </div>
      </div>}

      <button
        type="button"
        className="drawer-details-toggle"
        aria-expanded={detailsExpanded}
        aria-controls="route-drawer-details"
        onClick={() => setDetailsExpanded(value => !value)}
      >
        <span>{lang === 'ar' ? 'تفاصيل الخط' : 'Route details'}</span>
        {detailsExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>

      <div id="route-drawer-details" className="drawer-details">
      <div className="drawer-stats">
        <div className="stat-item">
          <span className="stat-label">{t.lengthLabel}</span>
          <span className="stat-value">{selectedRoute.len_km} <small>{t.kmUnit}</small></span>
        </div>
        <div className="stat-item">
          <span className="stat-label">{t.directionLabel}</span>
          <span className="stat-value">{dirText}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">{t.capacityLabel}</span>
          <span className="stat-value">{selectedRoute.capacity ? `${selectedRoute.capacity} ${t.passengersUnit}` : '--'}</span>
        </div>
      </div>

      {hasDropInfo && (() => {
        const far = farFromDestination;
        const stopName = drop.nearestStop ? (lang === 'ar' ? drop.nearestStop.ar : drop.nearestStop.en) : null;
        const walkUrl = `https://www.google.com/maps/dir/?api=1&origin=${drop.dropCoord[0]},${drop.dropCoord[1]}&destination=${targetCoord[0]},${targetCoord[1]}&travelmode=walking`;
        return (
          <div className={`drawer-drop ${far ? 'far' : ''}`}>
            <div className="drawer-drop-head">
              <span className="drawer-drop-label">{lang === 'ar' ? 'أقرب نزول لوجهتك على هذا الخط' : 'Nearest drop-off on this line'}</span>
              {onClearTarget && (
                <button type="button" className="btn-text-clear" onClick={onClearTarget}>
                  {lang === 'ar' ? 'إلغاء الوجهة' : 'Clear destination'}
                </button>
              )}
            </div>
            <div className="drawer-drop-main">
              <Footprints size={16} aria-hidden="true" />
              <span className="drawer-drop-dist">{dropDistanceText}</span>
              <span className="drawer-drop-time">{dropTimeText}</span>
            </div>
            {stopName && (
              <div className="drawer-drop-stop">
                <MapPin size={13} aria-hidden="true" />
                <span>{lang === 'ar' ? `انزل عند: ${stopName}` : `Get off at: ${stopName}`}</span>
              </div>
            )}
            {onStartTrip && !far && (
              <button type="button" className="btn-primary trip-start-btn" onClick={() => onStartTrip(drop)}>
                <Navigation size={15} />
                <span>{lang === 'ar' ? 'تتبع الرحلة وتنبيهي قبل النزول' : 'Track my trip & alert me before my stop'}</span>
              </button>
            )}
            {far ? (
              <div className="drawer-drop-warning">
                <AlertTriangle size={14} aria-hidden="true" />
                <span>{lang === 'ar' ? 'هذا الخط لا يمر بالقرب من وجهتك. جرّب «خطوط المكان» للعثور على خطوط أقرب.' : 'This line doesn’t pass near your destination. Try “Routes near a place” to find closer lines.'}</span>
              </div>
            ) : (
              <a className="drawer-drop-link" href={walkUrl} target="_blank" rel="noopener noreferrer">
                <span>{lang === 'ar' ? 'اتجاهات المشي من نقطة النزول' : 'Walking directions from drop-off'}</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </div>
        );
      })()}

      <div className="drawer-actions">
        <button className="btn-primary-outline" onClick={onToggleDirection}>
          <ArrowLeftRight size={15} />
          <span>{t.toggleDirBtn}</span>
        </button>
        <button className="btn-primary" onClick={onFitRoute}>
          <Focus size={15} />
          <span>{t.fitRouteBtn}</span>
        </button>
      </div>
      </div>
    </section>
  );
}
