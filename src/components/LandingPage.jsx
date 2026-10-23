import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, BusFront, Map, Route, Waypoints } from 'lucide-react';
import { formatReleaseSize, validateReleaseManifest } from '../utils/experienceEntry.js';

const MANIFEST_URL = '/downloads/android-release.json';

function TransitSketch() {
  return (
    <div className="transit-sketch" aria-hidden="true">
      <div className="sketch-label sketch-label-top">طريقك يبدأ من هنا</div>
      <svg viewBox="0 0 520 360" role="presentation">
        <path className="sketch-road" d="M52 298 C130 268 122 204 202 199 S306 248 348 173 S399 89 474 67" />
        <path className="sketch-road-secondary" d="M74 70 C152 101 169 153 233 161 S340 123 439 255" />
        <path className="sketch-route" d="M52 298 C130 268 122 204 202 199 S306 248 348 173 S399 89 474 67" />
        <circle className="sketch-stop" cx="52" cy="298" r="10"/><circle className="sketch-stop" cx="202" cy="199" r="10"/><circle className="sketch-stop" cx="348" cy="173" r="10"/><circle className="sketch-stop sketch-stop-end" cx="474" cy="67" r="12"/>
        <g className="sketch-bus" transform="translate(245 206) rotate(-15)"><rect width="68" height="38" rx="8"/><rect className="bus-window" x="8" y="6" width="52" height="15" rx="3"/><circle cx="15" cy="40" r="5"/><circle cx="53" cy="40" r="5"/></g>
      </svg>
      <div className="sketch-note"><span>01</span><span>خطوات أوضح<br/><b>من البداية للنهاية</b></span></div>
      <div className="sketch-compass">م</div>
    </div>
  );
}

export default function LandingPage({ onOpenPlanner }) {
  const [release, setRelease] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(MANIFEST_URL, { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(manifest => setRelease(validateReleaseManifest(manifest, window.location.origin)))
      .catch(() => setRelease(null))
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, []);

  return (
    <main className="landing-screen" dir="rtl">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="مواصلاتي، الصفحة الرئيسية"><span className="brand-mark"><BusFront size={20}/></span><span>مواصلاتي</span></a>
        <span className="landing-header-note">دليلك للتنقل في القاهرة</span>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="hero-copy">
          <p className="hero-eyebrow"><span/> اكتشف طريقك، بطريقتك</p>
          <h1 id="landing-title">القاهرة أقرب<br/><em>مما تتخيل.</em></h1>
          <p className="hero-description">اعرف خطوط المواصلات، خطط مشوارك، واجمع وجهاتك في رحلة واحدة — بخطوات بسيطة وواضحة.</p>
          <div className="hero-actions">
            {release?.available ? (
              <a className="cta cta-primary" href={release.url} download aria-label={`تحميل تطبيق أندرويد، الإصدار ${release.version}`}>
                <ArrowDownToLine size={19}/><span>تحميل تطبيق أندرويد<small>الإصدار {release.version} · {formatReleaseSize(release.sizeBytes)}</small></span>
              </a>
            ) : (
              <div className="cta-unavailable" aria-live="polite">
                <button className="cta cta-primary" type="button" disabled aria-busy={checking} aria-describedby="download-status"><ArrowDownToLine size={19}/><span>تحميل تطبيق أندرويد<small>{checking ? 'جارٍ التحقق من توفر التطبيق…' : 'سيكون متاحًا قريبًا'}</small></span></button>
              </div>
            )}
            <a className="cta cta-secondary" href="/app" onClick={onOpenPlanner}>المتابعة من المتصفح <ArrowLeft size={17}/></a>
          </div>
          <p className="download-status" id="download-status" role="status">{release?.available ? 'يتطلب التثبيت السماح بالتثبيت من هذا المصدر على جهاز أندرويد.' : checking ? 'نتحقق من رابط تنزيل التطبيق.' : 'نسخة أندرويد قيد التجهيز. يمكنك استخدام المخطط من المتصفح الآن.'}</p>
          {release?.available && <p className="release-meta">رقم الإصدار {release.versionCode} · حجم الملف {formatReleaseSize(release.sizeBytes)}</p>}
          <div className="hero-proof"><span className="proof-line"/><span>تخطيط عملي للمشاوير اليومية</span></div>
        </div>
        <TransitSketch />
      </section>

      <section className="landing-features" aria-labelledby="features-title">
        <div className="section-heading"><div><p className="section-kicker">كل ما تحتاجه للمشوار</p><h2 id="features-title">من أول خطوة، لآخر محطة.</h2></div><span className="section-index">01 — 03</span></div>
        <div className="feature-grid">
          <article className="feature-card"><span className="feature-icon"><Map size={20}/></span><span className="feature-number">01</span><h3>اكتشف الخطوط</h3><p>ابحث عن خطوط المواصلات ونقاط النزول، وضيّق النتائج حسب وسيلة التنقل.</p></article>
          <article className="feature-card"><span className="feature-icon"><Route size={20}/></span><span className="feature-number">02</span><h3>خطط رحلتك</h3><p>حدد نقطة البداية والوجهة لتستكشف خيارات الوصول المناسبة لمشوارك.</p></article>
          <article className="feature-card"><span className="feature-icon"><Waypoints size={20}/></span><span className="feature-number">03</span><h3>أكثر من وجهة</h3><p>رتب عدة محطات ضمن رحلة واحدة، وعدّل ترتيبها بما يناسب يومك.</p></article>
        </div>
      </section>

      <section className="install-note" aria-labelledby="install-title">
        <div className="install-icon"><ArrowDownToLine size={20}/></div>
        <div><p className="section-kicker">تثبيت بسيط وآمن</p><h2 id="install-title">كيف تثبت التطبيق؟</h2><p>{release?.available ? 'بعد تنزيل الملف، افتحه على هاتف أندرويد واتبع تعليمات التثبيت. قد يطلب الهاتف السماح بالتثبيت من المتصفح.' : 'عند توفر نسخة أندرويد، نزّل ملف التطبيق من هذه الصفحة وافتحه على هاتفك. سيطلب الهاتف السماح بالتثبيت من المتصفح عند الحاجة.'}</p></div>
        <span className="install-count">APK <span>·</span> أندرويد</span>
      </section>

      <footer className="landing-footer"><a className="footer-brand" href="/">مواصلاتي</a><span>تخطيط تنقلك في القاهرة</span><a href="/app" onClick={onOpenPlanner}>ابدأ التخطيط <ArrowLeft size={14}/></a></footer>
    </main>
  );
}
