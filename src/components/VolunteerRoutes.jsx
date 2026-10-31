import React from 'react';
import { ArrowUpRight, MapPinned, Route } from 'lucide-react';
import FeedbackEntry from './FeedbackEntry';
import './VolunteerRoutes.css';

export default function VolunteerRoutes() {
  return (
    <section className="volunteer-routes" aria-labelledby="volunteer-routes-title">
      <div className="volunteer-routes-topline">
        <span className="volunteer-routes-icon" aria-hidden="true"><MapPinned size={22}/></span>
        <span>مشاركة تطوعية</span>
      </div>
      <div className="volunteer-routes-intro">
        <div>
          <h2 id="volunteer-routes-title">ساهم بمسار ميكروباص</h2>
          <p>مشوارك اليومي يكمّل الخريطة. تسجيلك لمسار حقيقي يساعد الركاب في منطقتك على معرفة خطوط أكثر.</p>
        </div>
        <Route className="volunteer-routes-mark" size={34} aria-hidden="true"/>
      </div>

      <ol className="volunteer-routes-steps">
        <li><span className="volunteer-step-number">١</span><span><strong>سجّل مشوارك</strong><small>وأنت راكب في ميكروباص فعلي، استخدم متتبع GPS لتسجيل الجزء الذي تخدمه المركبة.</small></span></li>
        <li><span className="volunteer-step-number">٢</span><span><strong>أضف التفاصيل</strong><small>دوّن البداية والنهاية والاتجاه وتاريخ الرحلة، واذكر إن كان التسجيل كاملًا أم جزئيًا.</small></span></li>
        <li><span className="volunteer-step-number">٣</span><span><strong>صدّر الملف وأرسله</strong><small>احفظه بصيغة GPX أو KML أو GeoJSON وأرسله للمراجعة؛ يمكننا تحويل GPX وKML إلى GeoJSON.</small></span></li>
      </ol>

      <p className="volunteer-routes-privacy">لخصوصيتك: سجّل جزء خط الخدمة فقط، واحذف نقاط المنزل أو الأماكن الخاصة قبل المشاركة.</p>

      <div className="volunteer-routes-actions">
        <FeedbackEntry kind="route" title="أرسل ملف المسار" />
        <a className="volunteer-routes-tool" href="https://play.google.com/store/apps/details?id=com.ilyabogdanovich.geotracker" target="_blank" rel="noreferrer">
          تطبيق Geo Tracker لأندرويد <ArrowUpRight size={15} aria-hidden="true"/>
        </a>
      </div>
      <p className="volunteer-routes-email-note">أرفق ملف المسار في النموذج وأضف البداية والنهاية والاتجاه. يُرسل للإدارة للمراجعة ولا يُنشر تلقائيًا.</p>

      <details className="volunteer-routes-howto">
        <summary>طريقة التسجيل والتصدير</summary>
        <p>ابدأ التسجيل عند دخول الميكروباص وأوقفه عند نهاية الجزء المطلوب. اذكر بداية ونهاية الجزء المسجّل، وبداية الخط ونهايته إن عرفتهما، وهل يغطي التسجيل الخط كاملًا أم جزءًا منه. أضف رقم الخط أو اسم المشغّل إن عُرف، وتاريخ التسجيل؛ أسماء المحطات اختيارية. راجع المسار واحذف أي نقاط شخصية، ثم صدّره كملف GPX أو KML أو GeoJSON وأرفقه برسالتك.</p>
      </details>
    </section>
  );
}
