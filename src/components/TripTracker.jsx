import React from 'react';
import { X, LocateFixed, ArrowLeftRight, AlertTriangle, Bell, Footprints } from 'lucide-react';
import { VEHICLE_COLORS } from '../utils/i18n';
import { getRouteEnds, lineLabel } from '../utils/routeEnds';

const fmtDist = (m, ar) => (m >= 1000
  ? `${(m / 1000).toFixed(1)} ${ar ? 'كم' : 'km'}`
  : `${m} ${ar ? 'م' : 'm'}`);

// Live trip panel: replaces the route card while tracking a line.
export default function TripTracker({
  trip, state, geoStatus, following, wakeLockOn,
  onStop, onRecenter, onSwitchDirection, lang = 'ar'
}) {
  if (!trip) return null;
  const ar = lang === 'ar';
  const route = trip.route;
  const color = route.color || VEHICLE_COLORS[route.vehicle] || VEHICLE_COLORS.Default;
  const { to: destName } = getRouteEnds(route, lang);

  let banner = null;
  if (geoStatus === 'denied') {
    banner = { kind: 'bad', text: ar ? 'الوصول للموقع مرفوض — فعّله من إعدادات المتصفح.' : 'Location access is blocked — allow it in browser settings.' };
  } else if (!state) {
    banner = { kind: 'info', text: ar ? 'جاري تحديد موقعك على الخط…' : 'Finding you on the line…' };
  } else if (state.phase === 'passed') {
    banner = { kind: 'bad', text: ar ? 'فاتتك نقطة النزول! انزل في أقرب محطة وارجع.' : 'You passed your stop! Get off at the next one and walk back.' };
  } else if (state.phase === 'arrived') {
    banner = { kind: 'go', icon: true, text: ar ? 'انزل هنا!' : 'Get off here!' };
  } else if (state.wrongWay) {
    banner = { kind: 'bad', text: ar ? 'يبدو أنك في الاتجاه المعاكس لهذا الخط.' : 'You seem to be going the opposite way on this line.', action: true };
  } else if (state.offRoute) {
    banner = { kind: 'warn', text: ar ? `أنت بعيد عن مسار الخط (${fmtDist(state.offset, ar)}).` : `You’re away from the line (${fmtDist(state.offset, ar)}).` };
  } else if (state.phase === 'approaching') {
    banner = { kind: 'warn', icon: true, text: ar ? 'استعد — انزل في المحطة الجاية' : 'Get ready — your stop is next' };
  }

  return (
    <section className="trip-tracker" style={{ '--card-color': color }} aria-label={ar ? 'تتبع الرحلة' : 'Trip tracking'}>
      <div className="trip-head">
        <span className="trip-line">{lineLabel(route, lang)}</span>
        <div className="trip-head-text">
          <span className="trip-dest">{destName ? `${ar ? '←' : '→'} ${destName}` : (ar ? 'تتبع الرحلة' : 'Tracking')}</span>
          <span className="trip-sub">
            <span className="trip-live-dot" aria-hidden="true"></span>
            {ar ? 'تتبع مباشر · انزل عند ' : 'Live · get off at '}{trip.drop.name}
          </span>
        </div>
        <button type="button" className="icon-btn-close" onClick={onStop} aria-label={ar ? 'إيقاف التتبع' : 'Stop tracking'}>
          <X size={18} />
        </button>
      </div>

      <div className="trip-body">
        {banner && (
          <div className={`trip-banner ${banner.kind}`} role="status" aria-live="assertive">
            {banner.icon ? <Bell size={18} aria-hidden="true" /> : (banner.kind !== 'info' && <AlertTriangle size={16} aria-hidden="true" />)}
            <span>{banner.text}</span>
            {banner.action && onSwitchDirection && (
              <button type="button" className="trip-banner-btn" onClick={onSwitchDirection}>
                <ArrowLeftRight size={14} />
                <span>{ar ? 'بدّل الاتجاه' : 'Switch direction'}</span>
              </button>
            )}
          </div>
        )}

        {state && (
          <>
            <div className="trip-stats" aria-live="polite">
              <div>
                <span className="trip-big">{fmtDist(state.remaining, ar)}</span>
                <span className="trip-label">{ar ? 'متبقي للنزول' : 'to your stop'}</span>
              </div>
              <div>
                <span className="trip-big">~{state.etaMin}<small>{ar ? ' د' : ' min'}</small></span>
                <span className="trip-label">{ar ? 'تقريباً' : 'approx.'}</span>
              </div>
              {state.nextStop && state.stopsLeft > 0 && (
                <div>
                  <span className="trip-big">{state.stopsLeft}</span>
                  <span className="trip-label">{ar ? 'محطات باقية' : 'stops left'}</span>
                </div>
              )}
            </div>

            <div className="trip-progress" aria-hidden="true">
              <span style={{ width: `${Math.round(state.progress * 100)}%` }}></span>
            </div>

            {state.nextStop && state.phase !== 'passed' && (
              <p className="trip-next">
                <span className="trip-label">{ar ? 'المحطة الجاية:' : 'Next stop:'}</span> {state.nextStop.name}
              </p>
            )}
          </>
        )}

        <div className="trip-actions">
          {!following && (
            <button type="button" className="btn-primary-outline" onClick={onRecenter}>
              <LocateFixed size={15} />
              <span>{ar ? 'اتبعني' : 'Follow me'}</span>
            </button>
          )}
          <button type="button" className="btn-primary" onClick={onStop}>
            <span>{ar ? 'إيقاف التتبع' : 'Stop tracking'}</span>
          </button>
        </div>
        <p className="trip-note">
          <Footprints size={12} aria-hidden="true" />
          {wakeLockOn
            ? (ar ? 'الشاشة ستبقى مضاءة أثناء التتبع. موقعك لا يُرسل لأي جهة.' : 'The screen stays on while tracking. Your location never leaves your phone.')
            : (ar ? 'اترك الصفحة مفتوحة والشاشة مضاءة أثناء التتبع. موقعك لا يُرسل لأي جهة.' : 'Keep this page open with the screen on. Your location never leaves your phone.')}
        </p>
      </div>
    </section>
  );
}
