import React from 'react';
import { VEHICLE_COLORS } from '../utils/i18n';
import { ArrowLeftRight, Focus, X } from 'lucide-react';

export default function RouteDrawer({
  selectedRoute,
  onClose,
  onToggleDirection,
  onFitRoute,
  lang,
  t
}) {
  if (!selectedRoute) return null;

  const color = VEHICLE_COLORS[selectedRoute.vehicle] || VEHICLE_COLORS.Default;
  const name = lang === 'ar' ? (selectedRoute.long_ar || selectedRoute.long_en) : (selectedRoute.long_en || selectedRoute.long_ar);
  const dirText = selectedRoute.dir === 0 ? t.dirOutbound : t.dirInbound;

  return (
    <section
      className="active-route-drawer"
      style={{ '--active-route-color': color, '--card-color': color }}
      data-vehicle={selectedRoute.vehicle}
      aria-label={lang === 'ar' ? 'الخط المحدد' : 'Selected line'}
    >
      <div className="drawer-header">
        <div className="drawer-title-group">
          <span className="route-badge-lg">{selectedRoute.num || selectedRoute.route_id}</span>
          <div>
            <h3 className="detail-name">{name}</h3>
            <p className="detail-meta">
              {t[String(selectedRoute.vehicle).toLowerCase()] || selectedRoute.vehicle}{selectedRoute.agency ? ` · ${selectedRoute.agency}` : ''}
            </p>
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
