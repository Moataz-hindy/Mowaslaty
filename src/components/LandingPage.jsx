import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, BusFront, Map, Route, Waypoints } from 'lucide-react';
import { formatReleaseSize, validateReleaseManifest } from '../utils/experienceEntry.js';
import { RAIL_NETWORKS, hashForHomeSection, hashForRailNetwork, resolveLandingHash } from '../utils/railNetworkNavigation.js';

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

      <section className="home-tabs-section" aria-label="استكشف مواصلاتي">
        <div className="home-tabs" role="tablist" aria-label="أقسام الصفحة الرئيسية">
          <button id="home-tab-home" role="tab" tabIndex={activeSection === 'home' ? 0 : -1} aria-selected={activeSection === 'home'} aria-controls="home-panel" type="button" onKeyDown={event => handleTabKeyDown(event, 'home')} onClick={() => selectSection('home')}>الرئيسية</button>
          <button id="home-tab-routes" role="tab" tabIndex={activeSection === 'routes' ? 0 : -1} aria-selected={activeSection === 'routes'} aria-controls="routes-panel" type="button" onKeyDown={event => handleTabKeyDown(event, 'routes')} onClick={() => selectSection('routes')}>خطوط المواصلات</button>
          <button id="home-tab-metro" role="tab" tabIndex={activeSection === 'metro' ? 0 : -1} aria-selected={activeSection === 'metro'} aria-controls="metro-panel" type="button" onKeyDown={event => handleTabKeyDown(event, 'metro')} onClick={() => selectSection('metro')}>القطارات</button>
          <button id="home-tab-community" role="tab" tabIndex={activeSection === 'community' ? 0 : -1} aria-selected={activeSection === 'community'} aria-controls="community-panel" type="button" onKeyDown={event => handleTabKeyDown(event, 'community')} onClick={() => selectSection('community')}>مجتمع الركاب</button>
        </div>
      </section>

      <section id="community-panel" className="home-tab-panel landing-content-width" hidden={activeSection !== 'community'} role="tabpanel" aria-labelledby="home-tab-community">
        {activeSection === 'community' && <Suspense fallback={<p className="directory-message" role="status">جارٍ فتح مجتمع الركاب…</p>}><HomeCommunity onOpenPlanner={onOpenPlanner}/></Suspense>}
      </section>

      <section id="home-panel" className="home-tab-panel landing-content-width" hidden={activeSection !== 'home'} role="tabpanel" aria-labelledby="home-tab-home">
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

      <footer className="landing-footer"><a className="footer-brand" href="/">مواصلاتي</a><span>تخطيط تنقلك في القاهرة</span><a href="/app" onClick={onOpenPlanner}>ابدأ التخطيط <ArrowLeft size={14}/></a></footer>
    </main>
  );
}
