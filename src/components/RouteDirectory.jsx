import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Search } from 'lucide-react';
import { getRouteEnds, lineLabel } from '../utils/routeEnds.js';
import { filterDirectoryRoutes, paginateDirectoryRoutes } from '../utils/routeDirectory.js';
import { loadRoutes } from '../utils/dataLoader.js';

const PAGE_SIZE = 18;
const FILTERS = [
  ['ALL', 'الكل'], ['Microbus', 'ميكروباص'], ['CTA', 'أتوبيس هيئة CTA'], ['Minibus', 'ميني باص']
];

export default function RouteDirectory({ onOpenPlanner }) {
  const [routes, setRoutes] = useState([]);
  const [status, setStatus] = useState('loading');
  const [query, setQuery] = useState('');
  const [vehicle, setVehicle] = useState('ALL');
  const [page, setPage] = useState(1);

  const fetchRoutes = () => {
    setStatus('loading');
    loadRoutes().then(data => {
      setRoutes(data);
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
        <div><p className="section-kicker">دليل الخطوط</p><h2 id="directory-title">اختار خطك وطريقك.</h2>
          <p>ابحث برقم الخط أو من وإلى أو باسم نقطة مرور.</p></div>
        {status === 'ready' && <span className="directory-count" aria-live="polite">{filtered.length} خط</span>}
      </div>

      <label className="directory-search"><Search size={19} aria-hidden="true" />
        <span className="sr-only">ابحث عن خط أو محطة</span>
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="رقم الخط، المنطقة، أو المحطة…" />
      </label>
      <div className="directory-filters" role="group" aria-label="تصفية حسب وسيلة المواصلات">
        {FILTERS.map(([value, label]) => <button key={value} type="button" className={vehicle === value ? 'selected' : ''} aria-pressed={vehicle === value} onClick={() => { setVehicle(value); setPage(1); }}>{label}</button>)}
      </div>

      {status === 'loading' && <p className="directory-message" role="status">جارٍ تحميل الخطوط…</p>}
      {status === 'error' && <div className="directory-message" role="alert"><p>تعذر تحميل الخطوط الآن.</p><button type="button" className="directory-retry" onClick={fetchRoutes}>حاول مرة أخرى</button></div>}
      {status === 'ready' && filtered.length === 0 && <p className="directory-message" role="status">لا توجد خطوط تطابق بحثك. جرّب كلمة أو تصفية أخرى.</p>}

      {status === 'ready' && paged.items.length > 0 && <div className="directory-grid">
        {paged.items.map(route => {
          const ends = getRouteEnds(route, 'ar');
          const from = ends.from || route.origin_en || route.origin || 'نقطة البداية غير محددة';
          const to = ends.to || route.dest_en || route.dest || 'نقطة النهاية غير محددة';
          const routeHref = `/app?route=${encodeURIComponent(route.id)}`;
          return <article className="directory-card" key={route.id}>
            <div className="directory-card-top"><span className="directory-number">{lineLabel(route, 'ar')}</span><span className="directory-vehicle">{route.vehicle === 'Bus' ? (route.agency === 'CTA' ? 'أتوبيس هيئة CTA' : 'أتوبيس') : route.vehicle === 'Minibus' ? 'ميني باص' : 'ميكروباص'}</span></div>
            <h3>{from}<ArrowLeft size={16} aria-label="إلى" />{to}</h3>
            <p className="directory-direction">{route.dir === 0 ? 'اتجاه الذهاب' : 'اتجاه العودة'}</p>
            {Array.isArray(route.via_stops) && route.via_stops.length > 0 && <details className="directory-stops">
              <summary><span>نقاط المرور المسجلة ({route.via_stops.length})</span><ChevronDown size={16} className="details-chevron" /></summary>
              <div className="directory-stops-list" role="region" aria-label="قائمة نقاط المرور" tabIndex={0}>
                <ol>
                  {route.via_stops.map((stop, index) => <li key={`${index}-${stop}`}>{stop}</li>)}
                </ol>
              </div>
              <small>الأسماء المعروضة هي النقاط المسجلة في بيانات الخط، وقد لا تشمل كل المحطات.</small>
            </details>}
            <a className="directory-open" href={routeHref} onClick={onOpenPlanner}>افتح الخط في المخطط <ArrowLeft size={16}/></a>
          </article>;
        })}
      </div>}
      {status === 'ready' && paged.pageCount > 1 && <nav className="directory-pagination" aria-label="صفحات النتائج">
        <button type="button" disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)}><ArrowLeft size={16}/> السابق</button>
        <span>صفحة {paged.page} من {paged.pageCount}</span>
        <button type="button" disabled={paged.page >= paged.pageCount} onClick={() => setPage(paged.page + 1)}>التالي <ArrowLeft size={16} className="pagination-next"/></button>
      </nav>}
      <p className="directory-disclaimer">هذا الدليل يعرض ملخصات الخطوط المتاحة في بيانات التطبيق. يرجى التأكد من تفاصيل الرحلة ميدانيًا.</p>
    </section>
  );
}
