import React from 'react';
import { VEHICLE_COLORS } from '../utils/i18n';
import { getRouteEnds, lineLabel } from '../utils/routeEnds';
import { ArrowLeftRight, Focus, X, Footprints, MapPin, ExternalLink, AlertTriangle } from 'lucide-react';

export default function RouteDrawer({
  selectedRoute,
  onClose,
  onToggleDirection,
  onFitRoute,
  drop = null,
  targetCoord = null,
  onClearTarget,
  lang,
  t
}) {
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

  return (
    <section
      className="active-route-drawer"
      style={{ '--active-route-color': color, '--card-color': color }}
      data-vehicle={selectedRoute.vehicle}
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

      {drop && targetCoord && (() => {
        const far = drop.distanceMeters > 2000;
        const dist = drop.distanceMeters >= 1000
          ? `${(drop.distanceMeters / 1000).toFixed(1)} ${lang === 'ar' ? 'كم' : 'km'}`
          : `${drop.distanceMeters} ${lang === 'ar' ? 'م' : 'm'}`;
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
              <span className="drawer-drop-dist">{dist}</span>
              <span className="drawer-drop-time">
                {lang === 'ar' ? `≈ ${drop.walkMinutes} دقيقة مشي` : `≈ ${drop.walkMinutes} min walk`}
              </span>
            </div>
            {stopName && (
              <div className="drawer-drop-stop">
                <MapPin size={13} aria-hidden="true" />
                <span>{lang === 'ar' ? `انزل عند: ${stopName}` : `Get off at: ${stopName}`}</span>
              </div>
            )}
            {far ? (
              <div className="drawer-drop-warning">
                <AlertTriangle size={14} aria-hidden="true" />
                <span>{lang === 'ar' ? 'هذا الخط لا يمر بالقرب من وجهتك. جرّب «أقرب نزول» لخطوط أقرب.' : 'This line doesn’t pass near your destination. Try “Nearest drop” for closer lines.'}</span>
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
    </section>
  );
}
