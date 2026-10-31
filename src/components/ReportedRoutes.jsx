import React, { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Search, X } from 'lucide-react';
import reportedData from '../data/reportedRoutes.json';

function normalizeArabic(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .trim();
}

export default function ReportedRoutes() {
  const [searchQuery, setSearchQuery] = useState('');
  const routes = reportedData.routes || [];
  const reviewedDate = reportedData.reviewedDate;

  const filteredRoutes = useMemo(() => {
    const q = normalizeArabic(searchQuery);
    if (!q) return routes;

    return routes.filter(route => {
      // Match by number (or 'بدون رقم' if number is null/empty)
      if (route.number) {
        if (normalizeArabic(route.number).includes(q)) return true;
      } else {
        if (normalizeArabic('بدون رقم').includes(q)) return true;
      }

      // Match by operator if known
      if (route.operatorAr && normalizeArabic(route.operatorAr).includes(q)) {
        return true;
      }

      // Match by endpoints (origin / destination)
      if (route.originAr && normalizeArabic(route.originAr).includes(q)) {
        return true;
      }
      if (route.destinationAr && normalizeArabic(route.destinationAr).includes(q)) {
        return true;
      }

      // Match by Arabic via stop names
      if (Array.isArray(route.viaAr)) {
        for (const stop of route.viaAr) {
          if (normalizeArabic(stop).includes(q)) return true;
        }
      }

      return false;
    });
  }, [routes, searchQuery]);

  return (
    <section className="reported-routes-section" aria-labelledby="reported-routes-heading" dir="rtl">
      <div className="reported-routes-header">
        <div className="reported-routes-title-group">
          <div className="reported-routes-kicker">رصد متداول ومعلومات غير معتمدة</div>
          <h3 id="reported-routes-heading" className="reported-routes-title">
            خطوط جديدة ومتداولة
          </h3>
        </div>
        {reviewedDate && (
          <div className="reported-review-badge">
            <span className="reported-review-label">تاريخ المراجعة:</span>
            <time dateTime={reviewedDate} className="reported-review-date">{reviewedDate}</time>
          </div>
        )}
      </div>

      <div className="reported-routes-notice" role="note">
        <p className="reported-notice-text">
          هذه المسارات خارج مخطط الرحلات؛ تفاصيلها متداولة وتحتاج إلى تأكيد.
        </p>
        <p className="reported-notice-subtext">
          تاريخ المراجعة المذكور هو تاريخ مراجعة الرصد فقط، دون ادعاء تحقق مستقل أو تاريخ نشر رسمي.
        </p>
      </div>

      <div className="reported-search-container">
        <div className="reported-search-bar">
          <label htmlFor="reported-routes-search-input" className="sr-only">البحث في المسارات المتداولة</label>
          <Search size={18} className="reported-search-icon" aria-hidden="true" />
          <input
            id="reported-routes-search-input"
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم الخط، المشغل، البداية أو النهاية، أو نقطة مرور…"
            className="reported-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="reported-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="مسح البحث"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="reported-search-stats" aria-live="polite">
          <span>{filteredRoutes.length} من {routes.length} مسار متداول</span>
        </div>
      </div>

      {filteredRoutes.length === 0 ? (
        <div className="reported-empty-state" role="status">
          <p>لا توجد مسارات متداولة تطابق بحثك "{searchQuery}".</p>
          <button
            type="button"
            className="pill"
            onClick={() => setSearchQuery('')}
          >
            عرض جميع المسارات
          </button>
        </div>
      ) : (
        <div className="reported-routes-grid">
          {filteredRoutes.map(route => {
            const isTrial = route.status === 'trial-reported';
            const statusLabel = isTrial ? 'تشغيل تجريبي حسب المنشور' : 'قيد التأكيد';
            const statusClass = isTrial ? 'pill-trial' : 'pill-unconfirmed';
            const lineNum = route.number;

            return (
              <article key={route.id} className="reported-card">
                <div className="reported-card-header">
                  <div className="reported-number-wrapper">
                    <span className={`reported-card-number ${lineNum ? 'm' : 'no-num'}`}>
                      {lineNum || 'بدون رقم'}
                    </span>
                  </div>

                  <div className="reported-badges-wrapper">
                    <span className="reported-pill pill-unplanned">
                      غير متاح في المخطط
                    </span>
                    <span className={`reported-pill ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                </div>

                {route.operatorAr && (
                  <div className="reported-card-operator">
                    <span>المشغل:</span>
                    <strong>{route.operatorAr}</strong>
                  </div>
                )}

                <div className="reported-card-endpoints">
                  <div className="reported-endpoint-row origin">
                    <span className="reported-endpoint-label">من:</span>
                    <strong className="reported-endpoint-text">{route.originAr}</strong>
                  </div>
                  <div className="reported-endpoint-divider" aria-hidden="true">
                    <span>←</span>
                    <span className="reported-endpoint-divider-line" />
                  </div>
                  <div className="reported-endpoint-row destination">
                    <span className="reported-endpoint-label">إلى:</span>
                    <strong className="reported-endpoint-text">{route.destinationAr}</strong>
                  </div>
                </div>

                {Array.isArray(route.viaAr) && route.viaAr.length > 0 && (
                  <div className="reported-via-preview">
                    <span className="reported-via-preview-label">نقاط المرور:</span>
                    <span>
                      {route.viaAr.slice(0, 3).join(' • ')}
                      {route.viaAr.length > 3 ? ` … (+${route.viaAr.length - 3})` : ''}
                    </span>
                  </div>
                )}

                <details className="reported-card-details">
                  <summary className="reported-details-toggle">
                    <span>التفاصيل ونقاط المرور ({route.viaAr?.length || 0})</span>
                    <ChevronDown size={16} className="reported-chevron" aria-hidden="true" />
                  </summary>

                  <div className="reported-details-pane">
                    {route.reportedHeadwayMinutes && (
                      <div className="reported-headway-row">
                        <span>زمن التقاطر المتداول:</span>
                        <strong>{route.reportedHeadwayMinutes} دقيقة تقريباً</strong>
                      </div>
                    )}

                    {Array.isArray(route.notes) && route.notes.length > 0 && (
                      <div className="reported-notes-block">
                        <h4 className="reported-subheading">ملاحظات الرصد:</h4>
                        <ul className="reported-notes-list">
                          {route.notes.map((note, index) => (
                            <li key={index}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(route.viaAr) && route.viaAr.length > 0 && (
                      <div className="reported-via-block">
                        <h4 className="reported-subheading">
                          نقاط المرور الوصفية بالترتيب ({route.viaAr.length}):
                        </h4>
                        <ol className="reported-via-ordered-list">
                          {route.viaAr.map((stop, index) => (
                            <li key={index} className="reported-via-step">
                              <span className="reported-via-num" aria-hidden="true">{index + 1}</span>
                              <span className="reported-via-name">{stop}</span>
                            </li>
                          ))}
                        </ol>
                        <p className="reported-via-caption">
                          نقاط المرور معلومات وصفية وليست محطات صعود معتمدة.
                        </p>
                      </div>
                    )}

                    {route.sourceUrl && (
                      <div className="reported-source-wrapper">
                        <a
                          href={route.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="reported-source-link"
                        >
                          <span>الصفحة المرجعية</span>
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      </div>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
