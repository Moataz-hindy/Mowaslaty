import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, BusFront, House, Map, Route, TrainFront, UsersRound, Waypoints } from 'lucide-react';
import { formatReleaseSize, validateReleaseManifest } from '../utils/experienceEntry.js';
import { RAIL_NETWORKS, hashForHomeSection, hashForRailNetwork, resolveLandingHash } from '../utils/railNetworkNavigation.js';
import FeedbackEntry from './FeedbackEntry.jsx';
import VolunteerRoutes from './VolunteerRoutes.jsx';

const MANIFEST_URL = '/downloads/android-release.json';
const RouteDirectory = lazy(() => import('./RouteDirectory.jsx'));
const MetroMapPanel = lazy(() => import('./MetroMapPanel.jsx'));
const RailNetworkPanel = lazy(() => import('./RailNetworkPanel.jsx'));
const HomeCommunity = lazy(() => import('./HomeCommunity.jsx'));
const HOME_SECTIONS = ['home', 'routes', 'metro', 'community'];
const NETWORKS = RAIL_NETWORKS;
const locationFromHash = () => resolveLandingHash(window.location.hash);

function TransitSketch() {
  return (
    <div className="transit-sketch" aria-label="لوحة توضيحية لخطوط المواصلات">
      <div className="route-board-head">
        <strong>لوحة الخطوط</strong>
        <span className="route-board-badge">مثال توضيحي</span>
      </div>
      <div className="route-board-item is-current">
        <i className="route-dot microbus" aria-hidden="true"/>
        <div className="route-board-text">
          <span className="route-board-vehicle">ميكروباص</span>
          <strong className="route-board-name">المؤسسة ← مدينة النهضة</strong>
        </div>
        <span className="m route-board-count">30</span>
      </div>
      <div className="route-board-item">
        <i className="route-dot microbus" aria-hidden="true"/>
        <div className="route-board-text">
          <span className="route-board-vehicle">ميكروباص</span>
          <strong className="route-board-name">مدينة النهضة ← ألف مسكن</strong>
        </div>
        <span className="m route-board-count">12</span>
      </div>
      <div className="route-board-item">
        <i className="route-dot cta" aria-hidden="true"/>
        <div className="route-board-text">
          <span className="route-board-vehicle">أتوبيس هيئة CTA</span>
          <strong className="route-board-name">آخر ترسا ← أحمد حلمي</strong>
        </div>
        <span className="m route-board-count">30</span>
      </div>
      <small className="route-board-caption">الرقم = نقاط المرور المسجلة</small>
    </div>
  );
}

export default function LandingPage({ onOpenPlanner, isNative = false }) {
  const [release, setRelease] = useState(null);
  const [checking, setChecking] = useState(true);
  const [location, setLocation] = useState(locationFromHash);
  const { activeSection, railNetwork } = { activeSection: location.section, railNetwork: location.network };

  useEffect(() => {
    const onPopState = () => setLocation(locationFromHash());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const selectSection = section => {
    const sectionHash = hashForHomeSection(section, railNetwork);
    const nextUrl = `${window.location.pathname}${window.location.search}${sectionHash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.pushState({}, '', nextUrl);
    setLocation({ section, network: section === 'metro' ? railNetwork : location.network });
  };

  const selectRailNetwork = network => {
    if (!NETWORKS.includes(network)) return;
    const nextUrl = `${window.location.pathname}${window.location.search}${hashForRailNetwork(network)}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.pushState({}, '', nextUrl);
    setLocation({ section: 'metro', network });
  };

  const handleTabKeyDown = (event, currentSection) => {
    const currentIndex = HOME_SECTIONS.indexOf(currentSection);
    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = HOME_SECTIONS.length - 1;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex + 1) % HOME_SECTIONS.length;
    else if (event.key === 'ArrowRight') nextIndex = (currentIndex + HOME_SECTIONS.length - 1) % HOME_SECTIONS.length;
    else return;
    event.preventDefault();
    const nextSection = HOME_SECTIONS[nextIndex];
    selectSection(nextSection);
    document.getElementById(`home-tab-${nextSection}`)?.focus();
  };

  useEffect(() => {
    if (isNative) {
      setRelease(null);
      setChecking(false);
      return undefined;
    }
    const controller = new AbortController();
    fetch(MANIFEST_URL, { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(manifest => setRelease(validateReleaseManifest(manifest, window.location.origin)))
      .catch(() => setRelease(null))
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, [isNative]);

  return (
    <main className="landing-screen" dir="rtl">
      <header className="landing-header">
        <div className="landing-brand-group">
          <a className="landing-brand" href="/" aria-label="مواصلاتي، الصفحة الرئيسية">مواصلاتي</a>
          <span className="landing-header-note">دليلك للتنقل في القاهرة</span>
        </div>

        <nav className="home-tabs nav" role="tablist" aria-label="أقسام الصفحة الرئيسية">
          <button id="home-tab-home" className={activeSection === 'home' ? 'on' : ''} role="tab" tabIndex={activeSection === 'home' ? 0 : -1} aria-selected={activeSection === 'home'} aria-controls="home-panel" type="button" onKeyDown={event => handleTabKeyDown(event, 'home')} onClick={() => selectSection('home')}><House className="home-tab-icon" size={20} aria-hidden="true"/><span className="home-tab-label">الرئيسية</span></button>
          <button id="home-tab-routes" className={activeSection === 'routes' ? 'on' : ''} role="tab" tabIndex={activeSection === 'routes' ? 0 : -1} aria-selected={activeSection === 'routes'} aria-controls="routes-panel" type="button" onKeyDown={event => handleTabKeyDown(event, 'routes')} onClick={() => selectSection('routes')}><Route className="home-tab-icon" size={20} aria-hidden="true"/><span className="home-tab-label"><span className="home-tab-label-desktop">خطوط المواصلات</span><span className="home-tab-label-mobile">الخطوط</span></span></button>
          <button id="home-tab-metro" className={activeSection === 'metro' ? 'on' : ''} role="tab" tabIndex={activeSection === 'metro' ? 0 : -1} aria-selected={activeSection === 'metro'} aria-controls="metro-panel" type="button" onKeyDown={event => handleTabKeyDown(event, 'metro')} onClick={() => selectSection('metro')}><TrainFront className="home-tab-icon" size={20} aria-hidden="true"/><span className="home-tab-label">القطارات</span></button>
          <button id="home-tab-community" className={activeSection === 'community' ? 'on' : ''} role="tab" tabIndex={activeSection === 'community' ? 0 : -1} aria-selected={activeSection === 'community'} aria-controls="community-panel" type="button" onKeyDown={event => handleTabKeyDown(event, 'community')} onClick={() => selectSection('community')}><UsersRound className="home-tab-icon" size={20} aria-hidden="true"/><span className="home-tab-label"><span className="home-tab-label-desktop">مجتمع الركاب</span><span className="home-tab-label-mobile">المجتمع</span></span></button>
        </nav>
      </header>

      <section id="community-panel" className="home-tab-panel landing-content-width" hidden={activeSection !== 'community'} role="tabpanel" aria-labelledby="home-tab-community">
        {activeSection === 'community' && <Suspense fallback={<p className="directory-message" role="status">جارٍ فتح مجتمع الركاب…</p>}><HomeCommunity onOpenPlanner={onOpenPlanner}/></Suspense>}
      </section>

      <section id="home-panel" className="home-tab-panel" hidden={activeSection !== 'home'} role="tabpanel" aria-labelledby="home-tab-home">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="hero-copy">
            <p className="hero-eyebrow">اكتشف طريقك، بطريقتك</p>
            <h1 id="landing-title" className="hero-title">القاهرة أقرب</h1>
            <div className="hero-cursive">مما تتخيل.</div>
            <p className="hero-description">اعرف خطوط المواصلات، خطط مشوارك، واجمع وجهاتك في رحلة واحدة — بخطوات بسيطة وواضحة.</p>
            <div className="hero-actions">
              {!isNative && (release?.available ? (
                <a className="pill on hero-download-btn" href={release.url} download aria-label={`تحميل تطبيق أندرويد، الإصدار ${release.version}`}>
                  <span>تحميل تطبيق أندرويد</span>
                  <span className="m hero-version-tag">{release.version} · {formatReleaseSize(release.sizeBytes)}</span>
                </a>
              ) : (
                <div className="cta-unavailable" aria-live="polite">
                  <button className="pill on hero-download-btn" type="button" disabled aria-busy={checking} aria-describedby="download-status">
                    <span>تحميل تطبيق أندرويد</span>
                    <span className="m hero-version-tag">{checking ? 'جارٍ التحقق من توفر التطبيق…' : 'سيكون متاحًا قريبًا'}</span>
                  </button>
                </div>
              ))}
              <a className="pill hero-browser-btn" href="/app" onClick={onOpenPlanner}>{isNative ? 'خطط مشوارك ←' : 'المتابعة من المتصفح ←'}</a>
            </div>
            {!isNative && <p className="download-status" id="download-status" role="status">
              {release?.available ? 'يتطلب التثبيت السماح بالتثبيت من هذا المصدر على جهاز أندرويد.' : checking ? 'نتحقق من رابط تنزيل التطبيق.' : 'نسخة أندرويد قيد التجهيز. يمكنك استخدام المخطط من المتصفح الآن.'}
            </p>}
            {!isNative && release?.available && <p className="release-meta">رقم الإصدار {release.versionCode} · حجم الملف {formatReleaseSize(release.sizeBytes)}</p>}
          </div>
          <TransitSketch />
        </section>

        <section className="cd hero-quick-search" aria-label="افتح مخطط الرحلات">
          <p>جاهز تخطط مشوارك؟</p>
          <a href="/app" className="pill on quick-submit" onClick={onOpenPlanner}>افتح المخطط ←</a>
        </section>

        <section className="landing-services" aria-labelledby="services-title">
          <h2 id="services-title" className="services-heading">كل ما تحتاجه للمشوار</h2>
          <div className="services-grid">
            <button type="button" className="cd service-card" onClick={() => selectSection('routes')}>
              <div className="service-card-head">
                <h3 className="service-card-title">خطوط المواصلات</h3>
                <span className="service-card-stat"><Map size={34} aria-hidden="true"/></span>
              </div>
              <p className="service-card-desc">ابحث برقم الخط أو من وإلى، وفلتر حسب وسيلة التنقل.</p>
              <div className="service-samples">
                <div className="lp"><i style={{ background: '#6B46B8' }} aria-hidden="true"/>المؤسسة ← مدينة النهضة</div>
                <div className="lp"><i style={{ background: '#E0A21A' }} aria-hidden="true"/>أبو الريش ← مساكن شيراتون</div>
                <div className="lp"><i style={{ background: '#2E8B57' }} aria-hidden="true"/>آخر ترسا ← أحمد حلمي</div>
              </div>
              <span className="pill on service-card-cta">افتح الخطوط ←</span>
            </button>

            <button type="button" className="cd service-card" onClick={() => selectSection('metro')}>
              <div className="service-card-head">
                <h3 className="service-card-title">القطارات</h3>
                <span className="service-card-icon"><Route size={28} aria-hidden="true"/></span>
              </div>
              <p className="service-card-desc">تصفح خطوط المترو والقطار الكهربائي LRT والمونوريل.</p>
              <div className="train-line-diagram" aria-hidden="true">
                <div className="train-line-track"/>
                <i className="train-node"/>
                <i className="train-node"/>
                <i className="train-node"/>
                <i className="train-node train-node-highlight"/>
              </div>
              <span className="pill on service-card-cta">افتح القطارات ←</span>
            </button>

            <button type="button" className="cd service-card" onClick={() => selectSection('community')}>
              <div className="service-card-head">
                <h3 className="service-card-title">مجتمع الركاب</h3>
                <span className="service-card-icon"><Waypoints size={28} aria-hidden="true"/></span>
              </div>
              <p className="service-card-desc">ملاحظات الركاب: الأجرة، التحويلات، المواعيد، وتصحيح المسار.</p>
              <div className="community-sample-card">
                <span className="lp tip-badge">نصيحة</span>
                <div className="community-sample-text">شارك ملاحظاتك عن المشوار</div>
              </div>
              <span className="pill on service-card-cta">افتح المجتمع ←</span>
            </button>
          </div>
        </section>

        <section className="cd steps-section" aria-labelledby="steps-title">
          <div className="steps-header">
            <div>
              <div className="steps-kicker">ثلاث خطوات</div>
              <h2 id="steps-title" className="steps-title">من أول خطوة، لآخر محطة.</h2>
            </div>
            <span className="m steps-index">01 — 03</span>
          </div>
          <div className="steps-grid">
            <span className="ticket-notch notch-top-1" aria-hidden="true"/>
            <span className="ticket-notch notch-bottom-1" aria-hidden="true"/>
            <span className="ticket-notch notch-top-2" aria-hidden="true"/>
            <span className="ticket-notch notch-bottom-2" aria-hidden="true"/>

            <div className="step-card">
              <svg width="132" height="28" viewBox="0 0 132 28" aria-hidden="true">
                <circle cx="14" cy="14" r="12" fill="#2B4C9B"/>
                <circle cx="40" cy="14" r="12" fill="#E0A21A"/>
                <circle cx="66" cy="14" r="12" fill="#2E8B57"/>
                <circle cx="92" cy="14" r="12" fill="#6B46B8"/>
                <circle cx="118" cy="14" r="12" fill="#C8334F"/>
              </svg>
              <div className="m step-num">01</div>
              <h3 className="step-heading">اكتشف الخطوط</h3>
              <p className="step-desc">ابحث عن خطوط المواصلات ونقاط النزول، وضيّق النتائج حسب وسيلة التنقل.</p>
            </div>

            <div className="step-card">
              <svg width="132" height="28" viewBox="0 0 132 28" aria-hidden="true">
                <path d="M14 14h104" stroke="#0B0B0B" strokeWidth="3"/>
                <circle cx="14" cy="14" r="11" fill="#fff" stroke="#0B0B0B" strokeWidth="3"/>
                <circle cx="118" cy="14" r="11" fill="#E0A21A" stroke="#0B0B0B" strokeWidth="3"/>
              </svg>
              <div className="m step-num">02</div>
              <h3 className="step-heading">خطط رحلتك</h3>
              <p className="step-desc">حدد نقطة البداية والوجهة لتستكشف خيارات الوصول المناسبة لمشوارك.</p>
            </div>

            <div className="step-card">
              <svg width="132" height="28" viewBox="0 0 132 28" aria-hidden="true">
                <path d="M14 14h104" stroke="#0B0B0B" strokeWidth="3"/>
                <circle cx="14" cy="14" r="11" fill="#fff" stroke="#0B0B0B" strokeWidth="3"/>
                <circle cx="66" cy="14" r="11" fill="#fff" stroke="#0B0B0B" strokeWidth="3"/>
                <circle cx="118" cy="14" r="11" fill="#E0A21A" stroke="#0B0B0B" strokeWidth="3"/>
              </svg>
              <div className="m step-num">03</div>
              <h3 className="step-heading">أكثر من وجهة</h3>
              <p className="step-desc">رتب عدة محطات ضمن رحلة واحدة، وعدّل ترتيبها بما يناسب يومك.</p>
            </div>
          </div>
        </section>

        {!isNative && <section className="install-section" aria-labelledby="install-title">
          <div className="install-aside">
            <div className="install-kicker">تثبيت بسيط وآمن</div>
            <h2 id="install-title" className="install-title">كيف تثبت التطبيق؟</h2>
            {release?.available ? (
              <a className="pill on install-download-btn" href={release.url} download aria-label={`تحميل APK، الإصدار ${release.version}`}>
                تحميل APK
              </a>
            ) : (
              <button className="pill on install-download-btn" type="button" disabled>
                تحميل APK
              </button>
            )}
          </div>
          <div className="install-steps-grid">
            <div className="install-step-card">
              <span className="install-step-num">1</span>
              <div className="install-step-text">نزّل ملف التطبيق.</div>
            </div>
            <div className="install-step-card">
              <span className="install-step-num">2</span>
              <div className="install-step-text">افتحه على هاتف أندرويد.</div>
            </div>
            <div className="install-step-card">
              <span className="install-step-num">3</span>
              <div className="install-step-text">اتبع التعليمات، واسمح بالتثبيت من المتصفح لو طلب الهاتف.</div>
            </div>
          </div>
        </section>}

        <VolunteerRoutes />
        <FeedbackEntry className="landing-feedback-entry" />
      </section>

      <section id="routes-panel" className="home-tab-panel landing-content-width" hidden={activeSection !== 'routes'} role="tabpanel" aria-labelledby="home-tab-routes">
        {activeSection === 'routes' && <Suspense fallback={<p className="directory-message" role="status">جارٍ فتح دليل الخطوط…</p>}><RouteDirectory onOpenPlanner={onOpenPlanner}/></Suspense>}
      </section>

      <section id="metro-panel" className="home-tab-panel landing-content-width" hidden={activeSection !== 'metro'} role="tabpanel" aria-labelledby="home-tab-metro">
        {activeSection === 'metro' && <>
          <div className="rail-network-tabs" role="tablist" aria-label="شبكات القطارات">
            {NETWORKS.map((network, index) => <button key={network} id={`rail-tab-${network}`} type="button" role="tab" aria-selected={railNetwork === network} aria-controls="rail-network-panel" tabIndex={railNetwork === network ? 0 : -1} onClick={() => selectRailNetwork(network)} onKeyDown={event => {
              let next = index;
              if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = NETWORKS.length - 1;
              else if (event.key === 'ArrowLeft') next = (index + 1) % NETWORKS.length;
              else if (event.key === 'ArrowRight') next = (index + NETWORKS.length - 1) % NETWORKS.length;
              else return;
              event.preventDefault(); selectRailNetwork(NETWORKS[next]); document.getElementById(`rail-tab-${NETWORKS[next]}`)?.focus();
            }}>{['المترو', 'القطار الكهربائي LRT', 'المونوريل'][index]}</button>)}
          </div>
          <div id="rail-network-panel" role="tabpanel" aria-labelledby={`rail-tab-${railNetwork}`}>
            <Suspense fallback={<p className="directory-message" role="status">جارٍ فتح معلومات الشبكة…</p>}>
              {railNetwork === 'metro' ? <MetroMapPanel/> : <RailNetworkPanel network={railNetwork}/>}
            </Suspense>
          </div>
        </>}
      </section>

      <footer className="landing-footer">
        <a className="footer-brand" href="/">مواصلاتي</a>
        <span className="footer-tagline">تخطيط تنقلك في القاهرة</span>
        <a className="footer-privacy" href="/privacy.html">الخصوصية / Privacy</a>
        <a className="footer-link" href="/app" onClick={onOpenPlanner}>ابدأ التخطيط ←</a>
      </footer>
    </main>
  );
}
