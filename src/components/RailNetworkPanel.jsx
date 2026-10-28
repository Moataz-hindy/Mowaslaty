import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';

const LRT_MAP = 'https://files.mobilitycairo.com/cairo/master/public/fichiers/PDF/Line%20Maps/20220628_Capital%20train%20Line%20MAP.pdf';
const MOBILITY_MAPS = 'https://www.mobilitycairo.com/ar/travel-information/maps';
const CAIRO_MONORAIL = 'https://www.cairo.gov.eg/ar/governorate-services/transportation-services/monorail/';
const NAT_EAST_OPERATION = 'https://www.nat.gov.eg/NewsDetailsAr.aspx?id=1304';
const NAT_EAST_UPDATE = 'https://www.nat.gov.eg/NewsDetailsAr.aspx?id=1310';

const eastStationsListedByGovernorate = [
  'المشير طنطاوي', 'المستثمرين', 'اللوتس', 'وان ناينتي', 'بيت الوطن', 'مسجد الفتاح العليم',
  'المستشفى الجوي', 'R2 الحي', 'R1 الحي', 'مدينة العدالة', 'الحي الحكومي', 'مسجد مصر',
  'حي المال والأعمال', 'جولدن سكوير', 'النرجس', 'مدينة الفنون والثقافة',
];
const westStations = [
  'أكتوبر الجديدة', 'جامعة الأهرام الكندية', 'السادات', 'جامعة 6 أكتوبر', 'نقابة المهندسين',
  'مول مصر', 'مدينة الشيخ زايد', 'طريق الإسكندرية', 'المنصورية', 'المريوطية', 'الطريق الدائري', 'بشتيل', 'وادي النيل',
];

function SourceLink({ href, children }) {
  return <a href={href} target="_blank" rel="noreferrer">{children} <ExternalLink size={14} aria-hidden="true"/></a>;
}

function CapitalTrain() {
  const [imageFailed, setImageFailed] = useState(false);
  return <section className="rail-reference" aria-labelledby="lrt-title" dir="rtl">
    <div className="metro-heading"><div><p className="section-kicker">خريطة الشبكة</p><h2 id="lrt-title">القطار الكهربائي الخفيف LRT</h2>
      <p>خريطة قطار العاصمة المنشورة من Mobility Cairo. ألوانها ووسم «الافتتاح قريبًا» من المصدر، وقد تغيرت حالة بعض المراحل منذ إعدادها.</p></div>
      <SourceLink href={LRT_MAP}>ملف الخريطة الأصلي</SourceLink>
    </div>
    <div className="metro-map-frame rail-map-frame">
      {imageFailed
        ? <p className="metro-map-error" role="alert">تعذر عرض صورة الخريطة. <SourceLink href={LRT_MAP}>افتح ملف الخريطة الأصلي</SourceLink>.</p>
        : <a className="metro-map-image-link" href="/capital-train-map-preview.png" target="_blank" rel="noreferrer" aria-label="افتح خريطة قطار العاصمة بالحجم الكامل">
          <img src="/capital-train-map-preview.png" alt="خريطة قطار العاصمة المنشورة من Mobility Cairo، مع أسماء المحطات ووسم مراحل الافتتاح القادم كما ورد في المصدر" loading="lazy" onError={() => setImageFailed(true)} />
        </a>}
      <p>اضغط على الصورة لعرضها بالحجم الكامل. تعرض الخريطة حالة ووسوم المصدر وقت النشر.</p>
    </div>
    <p className="metro-credit">المصدر: <SourceLink href={MOBILITY_MAPS}>صفحة الخرائط لدى Mobility Cairo</SourceLink> · الخريطة مؤرخة 2022؛ تُعرض كمرجع لمسار المحطات والاتصالات فقط.</p>
  </section>;
}

function StationList({ title, stations, label, ordered = false }) {
  return <section className="monorail-list" aria-label={title}>
    <div><h3>{title}</h3><p>{label}</p></div>
    <ul>{stations.map((station, index) => <li key={station}>{ordered && <span>{String(index + 1).padStart(2, '0')}</span>}{station}</li>)}</ul>
  </section>;
}

function Monorail() {
  return <section className="rail-reference monorail-reference" aria-labelledby="monorail-title" dir="rtl">
    <div className="metro-heading"><div><p className="section-kicker">المحطات والحالة</p><h2 id="monorail-title">مونوريل شرق وغرب النيل</h2>
      <p>مرجع للمحطات والحالة التشغيلية وفق المصادر الرسمية المتاحة.</p></div>
      <SourceLink href={CAIRO_MONORAIL}>صفحة المونوريل بمحافظة القاهرة</SourceLink>
    </div>
    <article className="monorail-status">
      <span className="monorail-status-dot" aria-hidden="true"/><div><h3>شرق النيل · يعمل بالكامل</h3>
        <p>من محطة استاد القاهرة إلى مدينة العدالة بالعاصمة الجديدة، ويضم 22 محطة. أُعلن التشغيل الكامل في يونيو 2026.</p>
        <div className="monorail-sources"><SourceLink href={NAT_EAST_OPERATION}>إعلان التشغيل الكامل · 28 يونيو 2026</SourceLink><SourceLink href={NAT_EAST_UPDATE}>متابعة انتظام الخدمة · سبتمبر 2026</SourceLink></div>
      </div>
    </article>
    <StationList title="محطات يذكرها مصدر المحافظة لشرق النيل" stations={eastStationsListedByGovernorate} label="قائمة جزئية وغير مرتبة؛ المصدر يسرد 16 محطة ولا يغطي إجمالي المحطات الـ22 العاملة." />
    <StationList title="غرب النيل · المشروع قيد التنفيذ" stations={westStations} label="ترتيب المحطات كما ورد في صفحة المحافظة. القائمة تصف مشروع الخط ولا تعني أنه يعمل." ordered />
    <p className="metro-credit">المصادر: <SourceLink href={CAIRO_MONORAIL}>محافظة القاهرة</SourceLink> للمحطات · <SourceLink href={NAT_EAST_OPERATION}>الهيئة القومية للأنفاق</SourceLink> لحالة التشغيل وعدد محطات شرق النيل.</p>
  </section>;
}

export default function RailNetworkPanel({ network }) {
  return network === 'lrt' ? <CapitalTrain/> : <Monorail/>;
}
