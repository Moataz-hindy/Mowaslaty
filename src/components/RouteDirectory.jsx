import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { getRouteEnds, lineLabel } from '../utils/routeEnds.js';
import { filterDirectoryRoutes, paginateDirectoryRoutes } from '../utils/routeDirectory.js';
import { loadRoutes } from '../utils/dataLoader.js';
import ReportedRoutes from './ReportedRoutes.jsx';

const PAGE_SIZE = 18;
const FILTERS = [
  ['ALL', 'الكل', null],
  ['BRT', 'الأتوبيس الترددي', '#087E8B'],
  ['Minibus', 'ميني باص', '#E0A21A'],
  ['CTA', 'أتوبيس هيئة CTA', '#2E8B57'],
  ['Microbus', 'ميكروباص', '#6B46B8'],
];

export default function RouteDirectory({ onOpenPlanner }) {
  const [routes, setRoutes] = useState([]);
  const [status, setStatus] = useState('loading');
  const [query, setQuery] = useState('');
  const [vehicle, setVehicle] = useState('ALL');
  const [page, setPage] = useState(1);
  const [brtUnavailable, setBrtUnavailable] = useState(false);

  const fetchRoutes = () => {
    setStatus('loading');
    loadRoutes().then(data => {
      setRoutes(data);
      setBrtUnavailable(data.brtUnavailable === true);
      setStatus('ready');
    }).catch(() => setStatus('error'));
  };

  useEffect(() => { fetchRoutes(); }, []);

  const filtered = useMemo(() => filterDirectoryRoutes(routes, vehicle, query), [routes, vehicle, query]);
  const paged = useMemo(() => paginateDirectoryRoutes(filtered, page, PAGE_SIZE), [filtered, page]);
  useEffect(() => { if (paged.page !== page) setPage(paged.page); }, [paged.page, page]);

  return (
    <section className="home-directory" aria-labelledby="directory-title" dir="rtl">
      <div className="directory-heading">
        <div>
          <div className="section-kicker">دليل الخطوط</div>
          <h2 id="directory-title" className="directory-title">اختار خطك وطريقك.</h2>
          <p className="directory-subtitle">ابحث برقم الخط أو من وإلى، أو باسم نقطة مرور.</p>
        </div>
        {status === 'ready' && (
          <div className="cd directory-count-badge" aria-live="polite">
            <div className="m directory-count-num">{filtered.length}</div>
            <div className="directory-count-label">خط مسجّل</div>
          </div>
        )}
      </div>

      <ReportedRoutes />

      <div className="directory-search-bar">
        <label htmlFor="directory-search-input" className="sr-only">ابحث</label>
        <Search size={20} className="directory-search-icon" aria-hidden="true" />
        <input
          id="directory-search-input"
          type="search"
          value={query}
          onChange={event => { setQuery(event.target.value); setPage(1); }}
          placeholder="رقم الخط، المنطقة، أو المحطة…"
          className="directory-search-input"
        />
      </div>

      <div className="directory-filters" role="group" aria-label="تصفية حسب وسيلة المواصلات">
        {FILTERS.map(([value, label, color]) => (
          <button
            key={value}
            type="button"
            className={`pill ${vehicle === value ? 'on' : ''}`}
            aria-pressed={vehicle === value}
            onClick={() => { setVehicle(value); setPage(1); }}
          >
            {color && <i className="filter-dot" style={{ backgroundColor: color }} aria-hidden="true" />}
            {label}
          </button>
        ))}
      </div>
      {brtUnavailable && <p className="directory-message" role="status">تعذر تحميل بيانات الأتوبيس الترددي؛ بقية الخطوط متاحة.</p>}
      {!brtUnavailable && <p className="journey-data-notice" role="note">
        مسار الأتوبيس الترددي مستند إلى خريطة مجتمعية تقديرية؛ نمط الخدمة إلى صن كابيتال مستند إلى تقارير صحفية منشورة 28 أكتوبر. مداخل المحطات والتحويلات غير متحققة.
        {' '}<a href="https://earth.google.com/earth/d/1O7T1TETomHyJHKgIyAIKkQpWjoXuzrun" target="_blank" rel="noopener noreferrer">مرجع الخريطة</a>
        {' '}· <a href="https://www.elwatannews.com/news/details/8386151" target="_blank" rel="noopener noreferrer">الوطن</a>
        {' '}· <a href="https://www.almasryalyoum.com/news/details/4395669" target="_blank" rel="noopener noreferrer">المصري اليوم</a>
      </p>}

      {status === 'loading' && <p className="directory-message" role="status">جارٍ تحميل الخطوط…</p>}
      {status === 'error' && (
        <div className="directory-message" role="alert">
          <p>تعذر تحميل الخطوط الآن.</p>
          <button type="button" className="pill on" onClick={fetchRoutes}>حاول مرة أخرى</button>
        </div>
      )}
      {status === 'ready' && filtered.length === 0 && (
        <p className="directory-message" role="status">لا توجد خطوط تطابق بحثك. جرّب كلمة أو تصفية أخرى.</p>
      )}

      {status === 'ready' && paged.items.length > 0 && (
        <div className="directory-grid">
          {paged.items.map(route => {
            const ends = getRouteEnds(route, 'ar');
            const from = ends.from || route.origin_en || route.origin || 'نقطة البداية غير محددة';
            const to = ends.to || route.dest_en || route.dest || 'نقطة النهاية غير محددة';
            const routeHref = `/app?route=${encodeURIComponent(route.id)}`;
            const vehicleColor = route.vehicle === 'BRT' ? '#087E8B' : route.vehicle === 'Bus' ? '#2E8B57' : route.vehicle === 'Minibus' ? '#E0A21A' : '#6B46B8';
            const vehicleLabel = route.vehicle === 'BRT' ? 'الأتوبيس الترددي السريع' : route.vehicle === 'Bus' ? (route.agency === 'CTA' ? 'أتوبيس هيئة CTA' : 'أتوبيس') : route.vehicle === 'Minibus' ? 'ميني باص' : 'ميكروباص';
            const lineNum = lineLabel(route, 'ar');

            return (
              <article className="cd directory-card" key={route.id} style={{ '--c': vehicleColor }}>
                <div className="directory-card-top">
                  <span className="lp directory-vehicle">
                    <i style={{ background: vehicleColor }} aria-hidden="true"/>
                    {vehicleLabel}
                  </span>
                  {lineNum && <span className="m directory-number">{lineNum}</span>}
                </div>

                <div className="directory-card-route">
                  <div className="rt">
                    <b>{from}</b>
                    <b>{to}</b>
                  </div>
                  <span className="lp directory-direction">
                    {route.dir === 0 ? 'اتجاه الذهاب' : 'اتجاه العودة'}
                  </span>
                </div>

                {Array.isArray(route.via_stops) && route.via_stops.length > 0 && (
                  <details className="dt directory-stops">
                    <summary>
                      <span>نقاط المرور المسجلة ({route.via_stops.length})</span>
                      <ChevronDown size={16} className="details-chevron" aria-hidden="true" />
                    </summary>
                    <div className="directory-stops-list" role="region" aria-label="قائمة نقاط المرور" tabIndex={0}>
                      <ol className="route-stop-timeline">
                        {route.via_stops.map((stop, index) => (
                          <li className="stop-sequence-item" key={`${index}-${stop}`}>
                            <span className="stop-seq-idx" aria-hidden="true">{index + 1}</span>
                            <span className="stop-seq-name">{stop}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <small>الأسماء المعروضة هي النقاط المسجلة في بيانات الخط، وقد لا تشمل كل المحطات.</small>
                  </details>
                )}

                <a className="pill on directory-open" href={routeHref} onClick={onOpenPlanner}>
                  <span>افتح الخط في المخطط</span>
                  <span>←</span>
                </a>
              </article>
            );
          })}
        </div>
      )}

      {status === 'ready' && paged.pageCount > 1 && (
        <nav className="directory-pagination" aria-label="صفحات النتائج">
          <button type="button" className="pill" disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)}>
            ← السابق
          </button>
          <span className="directory-page-status">
            صفحة <span className="m">{paged.page}</span> من <span className="m">{paged.pageCount}</span>
          </span>
          <button type="button" className="pill on" disabled={paged.page >= paged.pageCount} onClick={() => setPage(paged.page + 1)}>
            التالي →
          </button>
        </nav>
      )}

      <p className="directory-disclaimer">هذا الدليل يعرض مقتطفات الخطوط المتاحة في بيانات التطبيق. يرجى التأكد من تفاصيل الرحلة ميدانيًا.</p>
    </section>
  );
}
