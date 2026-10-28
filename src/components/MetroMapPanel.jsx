import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';

const MAP_URL = 'https://files2.mobilitycairo.com/s3fs-public/documents/Cairo%20Network%20Map%20-%20V2024.05.09.pdf';
const MAP_IMAGE = '/metro-network-map-preview.png';

export default function MetroMapPanel() {
  const [imageFailed, setImageFailed] = useState(false);
  return <section className="home-metro" aria-labelledby="metro-map-title" dir="rtl">
    <div className="metro-heading"><div><p className="section-kicker">خريطة الشبكة</p><h2 id="metro-map-title">خريطة مترو القاهرة</h2>
      <p>خطوط المترو وأسماء المحطات. اضغط على الصورة لعرضها بالحجم الكامل.</p></div>
      <a href={MAP_URL} target="_blank" rel="noreferrer">افتح ملف المصدر الأصلي <ExternalLink size={16}/></a>
    </div>
    <div className="metro-map-frame">
      {imageFailed
        ? <p className="metro-map-error" role="alert">تعذر عرض الصورة هنا. <a href={MAP_URL} target="_blank" rel="noreferrer">افتح ملف الخريطة الرسمي</a>.</p>
        : <a className="metro-map-image-link" href={MAP_IMAGE} target="_blank" rel="noreferrer" aria-label="افتح صورة خريطة مترو القاهرة بالحجم الكامل">
          <img src={MAP_IMAGE} alt="خريطة مترو القاهرة الرسمية، مع خطوط المترو وملحق لقطار العاصمة" loading="lazy" onError={() => setImageFailed(true)} />
        </a>}
      <p>تتضمن الخريطة ملحقًا منفصلًا لقطار العاصمة. <a href={MAP_URL} target="_blank" rel="noreferrer">افتح ملف المصدر الأصلي</a> لعرضه كاملًا.</p>
    </div>
    <p className="metro-credit">المصدر: <a href="https://www.mobilitycairo.com/ar/travel-information/maps" target="_blank" rel="noreferrer">صفحة الخرائط لدى Mobility Cairo</a> · <a href={MAP_URL} target="_blank" rel="noreferrer">ملف PDF الأصلي</a>. تصميم الخريطة: Transport for Cairo. التواريخ الظاهرة في المصدر محفوظة كما هي؛ قد لا يعكس التغييرات اللاحقة.</p>
  </section>;
}
