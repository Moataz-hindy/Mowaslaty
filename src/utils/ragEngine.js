import { normalizeText } from './geoUtils.js';


// Cairo Metro Comprehensive Knowledge Base
export const METRO_LINES_DATA = {
  M1: {
    id: "M1",
    name_ar: "مترو الخط الأول (الأزرق)",
    name_en: "Metro Line 1 (Blue)",
    color: "#2E4A78",
    terminals_ar: "حلوان ➔ المرج الجديدة",
    terminals_en: "Helwan ➔ New El-Marg",
    stations_count: 35,
    key_stations: ["حلوان", "المعادي", "دار السلام", "السيدة زينب", "السادات (التحرير)", "جمال عبد الناصر", "الشهداء (رمسيس)", "غمرة", "الدمرداش", "سراي القبة", "عين شمس", "المرج الجديدة"],
    interchanges: [
      { station: "السادات", lines: ["M2"], desc: "تبادل مع الخط الثاني (شبرا - المنيب) وميدان التحرير" },
      { station: "الشهداء", lines: ["M2"], desc: "تبادل مع الخط الثاني ومحطة قطارات رمسيس" },
      { station: "جمال عبد الناصر", lines: ["M3"], desc: "تبادل مع الخط الثالث (عدلي منصور - الكيت كات)" }
    ]
  },
  M2: {
    id: "M2",
    name_ar: "مترو الخط الثاني (الأحمر)",
    name_en: "Metro Line 2 (Red)",
    color: "#A63457",
    terminals_ar: "شبرا الخيمة ➔ المنيب",
    terminals_en: "Shubra El-Kheima ➔ El Mounib",
    stations_count: 20,
    key_stations: ["شبرا الخيمة", "كلية الزراعة", "المظلات", "الخلفاوي", "الشهداء (رمسيس)", "العتبة", "محمد نجيب", "السادات (التحرير)", "الأوبرا", "الدقي", "البحوث", "جامعة القاهرة", "الجيزة", "المنيب"],
    interchanges: [
      { station: "الشهداء", lines: ["M1"], desc: "تبادل مع الخط الأول ومحطة مصر" },
      { station: "السادات", lines: ["M1"], desc: "تبادل مع الخط الأول وميدان التحرير" },
      { station: "العتبة", lines: ["M3"], desc: "تبادل مع الخط الثالث باتجاه مصر الجديدة وعدلي منصور أو الكيت كات" },
      { station: "جامعة القاهرة", lines: ["M3"], desc: "تبادل مع تفريعة الخط الثالث (بولاق الدكرور - جامعة الدول)" }
    ]
  },
  M3: {
    id: "M3",
    name_ar: "مترو الخط الثالث (الأخضر)",
    name_en: "Metro Line 3 (Green)",
    color: "#325F3B",
    terminals_ar: "عدلي منصور ➔ الكيت كات (تفريعة روض الفرج / جامعة القاهرة)",
    terminals_en: "Adly Mansour ➔ Kit Kat (Rod El Farag / Cairo Univ. branches)",
    stations_count: 34,
    key_stations: [
      "عدلي منصور", "الهايكستب", "عمر بن الخطاب", "قباء", "هشام بركات", "النزهة", "نادي الشمس", "ألف مسكن",
      "هليوبوليس", "هارون", "الأهرام", "كلية البنات", "الاستاد", "أرض المعارض", "العباسية", "عبده باشا",
      "الجيش", "باب الشعرية", "العتبة", "جمال عبد الناصر", "ماسبيرو", "صفاء حجازي (الزمالك)", "الكيت كات",
      "السودان", "إمبابة", "البوهي", "القومية العربية", "محور روض الفرج",
      "التوفيقية", "وادي النيل", "جامعة الدول العربية", "بولاق الدكرور", "جامعة القاهرة"
    ],
    interchanges: [
      { station: "العتبة", lines: ["M2"], desc: "تبادل مع الخط الثاني (شبرا - المنيب)" },
      { station: "جمال عبد الناصر", lines: ["M1"], desc: "تبادل مع الخط الأول (حلوان - المرج)" },
      { station: "جامعة القاهرة", lines: ["M2"], desc: "تبادل مع الخط الثاني بالجيزة" },
      { station: "عدلي منصور", lines: ["LRT"], desc: "المحطة التبادلية الكبرى مع القطار الكهربائي الخفيف LRT والسوبر جيت" },
      { station: "الكيت كات", lines: ["M3_Fork"], desc: "محطة التفرع بين فرع إمبابة ومحور روض الفرج وفرع جامعة القاهرة" }
    ]
  }
};

export const METRO_INTERCHANGES_LIST = [
  { name_ar: "الشهداء (رمسيس)", name_en: "Al-Shohadaa", lines: ["M1", "M2"], location: "ميدان رمسيس / محطة مصر" },
  { name_ar: "السادات (التحرير)", name_en: "Sadat", lines: ["M1", "M2"], location: "ميدان التحرير وموقف عبد المنعم رياض" },
  { name_ar: "العتبة", name_en: "Attaba", lines: ["M2", "M3"], location: "ميدان العتبة والأوبرا القديمة" },
  { name_ar: "جمال عبد الناصر", name_en: "Nasser", lines: ["M1", "M3"], location: "شارع 26 يوليو والإسعاف" },
  { name_ar: "جامعة القاهرة", name_en: "Cairo University", lines: ["M2", "M3"], location: "بين السرايات وجامعة القاهرة" },
  { name_ar: "الكيت كات", name_en: "Kit Kat", lines: ["M3"], location: "ميدان الكيت كات وتفريعة فرعي إمبابة والمهندسين" },
  { name_ar: "عدلي منصور", name_en: "Adly Mansour", lines: ["M3", "LRT"], location: "طريق مصر الإسماعيلية الصحراوي والسلام" }
];

export const METRO_TICKETS_PRICING = [
  { zone: "منطقة واحدة (حتى 9 محطات)", price: 8 },
  { zone: "منطقتين (10 إلى 16 محطة)", price: 10 },
  { zone: "3 مناطق (17 إلى 23 محطة)", price: 15 },
  { zone: "أكثر من 23 محطة", price: 20 }
];

// Cairo Transit Locations dictionary
const CAIRO_LOCATIONS = [
  { ar: 'شبرا', en: 'shubra', metroStations: ['شبرا الخيمة', 'كلية الزراعة', 'المظلات', 'الخلفاوي', 'سانت تريزا'], match: ['شبرا', 'دوران شبرا', 'مظلات', 'الخلفاوي'] },
  { ar: 'شيراتون', en: 'sheraton', metroStations: ['هليوبوليس', 'النزهة'], match: ['شيراتون', 'مساكن شيراتون', 'النزهة'] },
  { ar: 'رمسيس', en: 'ramses', metroStations: ['الشهداء (رمسيس)', 'عرابي'], match: ['رمسيس', 'محطة مصر', 'الاسعاف', 'الشهداء'] },
  { ar: 'التحرير', en: 'tahrir', metroStations: ['السادات (التحرير)', 'محمد نجيب'], match: ['تحرير', 'التحرير', 'عبد المنعم رياض', 'وسط البلد', 'السادات'] },
  { ar: 'العباسية', en: 'abbasseya', metroStations: ['العباسية', 'عبده باشا', 'الجيش'], match: ['عباسية', 'العباسية', 'جامعة عين شمس'] },
  { ar: 'التجمع', en: 'new cairo', metroStations: [], match: ['تجمع', 'التجمع', 'التجمع الخامس', 'fifth settlement', 'new cairo', 'كايرو فيستيفال', 'الجامعة الامريكية', 'auc', 'guc', 'الجامعة الالمانية', 'شارع التسعين', 'التسعين'] },
  { ar: 'الجيزة', en: 'giza', metroStations: ['الجيزة', 'جامعة القاهرة', 'فيصل', 'ساقية مكي', 'أم المصريين'], match: ['جيزة', 'الجيزة', 'ميدان الجيزة', 'جامعة القاهرة', 'بين السرايات'] },
  { ar: 'الدقي', en: 'dokki', metroStations: ['الدقي', 'البحوث'], match: ['دقي', 'الدقي', 'دقى', 'الدقى', 'ميدان الدقي', 'مصدق', 'محي الدين'] },
  { ar: 'المهندسين', en: 'mohandessin', metroStations: ['وادي النيل', 'جامعة الدول العربية', 'التوفيقية'], match: ['مهندسين', 'المهندسين', 'جامعة الدول', 'ميدان لبنان', 'شارع السودان', 'شهاب'] },
  { ar: 'الزمالك', en: 'zamalek', metroStations: ['صفاء حجازي (الزمالك)'], match: ['زمالك', 'الزمالك', 'صفاء حجازي', 'شارع البرازيل', 'ماريوت الزمالك'] },
  { ar: 'إمبابة', en: 'imbaba', metroStations: ['إمبابة', 'البوهي', 'الكيت كات', 'القومية العربية', 'السودان'], match: ['امبابة', 'إمبابة', 'امبابه', 'إمبابه', 'الكيت كات', 'بشتيل', 'البوهي'] },
  { ar: 'المعادي', en: 'maadi', metroStations: ['المعادي', 'ثكنات المعادي', 'حدائق المعادي', 'طرة البلد'], match: ['معادي', 'المعادي', 'معادى', 'المعادى', 'صقر قريش', 'ميدان الاتحاد', 'دجلة'] },
  { ar: 'مصر الجديدة', en: 'heliopolis', metroStations: ['الأهرام (مصر الجديدة)', 'هارون', 'هليوبوليس', 'كلية البنات', 'روكسي'], match: ['مصر الجديدة', 'روكسي', 'الكوربة', 'كلية البنات', 'هارون', 'هليوبوليس'] },
  { ar: 'حلوان', en: 'helwan', metroStations: ['حلوان', 'عين حلوان', 'جامعة حلوان', 'وادي حوف', 'حدائق حلوان'], match: ['حلوان', '15 مايو', 'التبين'] },
  { ar: 'المرج', en: 'marg', metroStations: ['المرج', 'المرج الجديدة', 'عزبة النخل'], match: ['مرج', 'المرج', 'المرج الجديدة', 'عزبة النخل'] },
  { ar: 'العتبة', en: 'ataba', metroStations: ['العتبة', 'باب الشعرية'], match: ['عتبة', 'العتبة', 'الموسكي', 'باب الشعرية', 'الأزهر'] },
  { ar: 'الهرم', en: 'haram', metroStations: ['الجيزة', 'فيصل'], match: ['هرم', 'الهرم', 'فيصل', 'الطالبية', 'المريوطية'] },
  { ar: 'أكتوبر', en: 'october', metroStations: [], match: ['اكتوبر', 'أكتوبر', 'الشيخ زايد', 'الحصري', 'مول العرب', 'هايبر وان'] }
];

/**
 * Extracts entities from user query (Metro lines, bus lines, Cairo locations, intents)
 */
export function extractEntities(userText) {
  const norm = normalizeText(userText);

  // 1. Metro Intent detection
  const isMetroInquiry = norm.includes('مترو') || norm.includes('metro');
  const isPricingInquiry = norm.includes('سعر') || norm.includes('تذكر') || norm.includes('اسعار') || norm.includes('بكام') || norm.includes('اشتراك');
  const isInterchangeInquiry = norm.includes('تبادل') || norm.includes('احول') || norm.includes('تحويل') || norm.includes('تغيير الخط');

  // Detect specific metro line
  let detectedMetroLine = null;
  if (norm.includes('خط اول') || norm.includes('خط 1') || norm.includes('m1') || norm.includes('الخط الاول') || norm.includes('حلوان المرج')) {
    detectedMetroLine = 'M1';
  } else if (norm.includes('خط تاني') || norm.includes('خط ثاني') || norm.includes('خط 2') || norm.includes('m2') || norm.includes('الخط التاني') || norm.includes('الخط الثاني') || norm.includes('شبرا المنيب')) {
    detectedMetroLine = 'M2';
  } else if (norm.includes('خط تالت') || norm.includes('خط ثالث') || norm.includes('خط 3') || norm.includes('m3') || norm.includes('الخط التالت') || norm.includes('الخط الثالث') || norm.includes('عدلي منصور') || norm.includes('كيت كات')) {
    detectedMetroLine = 'M3';
  }


  // 2. Bus line numbers (e.g. 305, 204, 112)
  const numberMatches = norm.match(/\b\d{1,4}\b/g) || [];

  // 3. Locations detection
  const detectedLocations = [];
  for (const loc of CAIRO_LOCATIONS) {
    for (const kw of loc.match) {
      if (norm.includes(normalizeText(kw))) {
        detectedLocations.push(loc);
        break;
      }
    }
  }

  return {
    isMetroInquiry,
    isPricingInquiry,
    isInterchangeInquiry,
    detectedMetroLine,
    lineNumbers: numberMatches,
    locations: detectedLocations
  };
}

/**
 * Queries routes dataset (Bus + Metro) using extracted entities
 */
export function retrieveRelevantRoutes(query, routes) {
  const entities = extractEntities(query);
  const matchedRoutes = [];

  // 1. Direct Metro Line Query
  if (entities.detectedMetroLine) {
    const metroLine = routes.filter(r => r.vehicle === 'Metro' && r.num === entities.detectedMetroLine);
    matchedRoutes.push(...metroLine);
  } else if (entities.isMetroInquiry && matchedRoutes.length === 0 && entities.locations.length === 0) {
    const allMetro = routes.filter(r => r.vehicle === 'Metro');
    matchedRoutes.push(...allMetro.slice(0, 4));
  }

  // 2. Bus line number lookup
  if (entities.lineNumbers.length > 0) {
    for (const num of entities.lineNumbers) {
      const found = routes.filter(r => r.num === num);
      matchedRoutes.push(...found);
    }
  }

  // 3. Origin -> Destination matching
  if (entities.locations.length >= 2) {
    const locA = entities.locations[0];
    const locB = entities.locations[1];

    const connecting = routes.filter(r => {
      const stopsText = r.via_stops ? r.via_stops.join(' ') : '';
      const text = normalizeText(`${r.origin} ${r.dest} ${r.long_ar} ${r.long_en} ${stopsText}`);
      const matchesA = locA.match.some(m => text.includes(normalizeText(m)));
      const matchesB = locB.match.some(m => text.includes(normalizeText(m)));
      return matchesA && matchesB;
    });

    // Check if both locations have Metro stations (Metro connection possible)
    if (locA.metroStations && locA.metroStations.length > 0 && locB.metroStations && locB.metroStations.length > 0) {
      const metroConnecting = routes.filter(r => r.vehicle === 'Metro');
      matchedRoutes.push(...metroConnecting.slice(0, 2));
    }

    matchedRoutes.push(...connecting);
  } else if (entities.locations.length === 1 && matchedRoutes.length === 0) {
    // Single location search
    const loc = entities.locations[0];
    const nearby = routes.filter(r => {
      const stopsText = r.via_stops ? r.via_stops.join(' ') : '';
      const text = normalizeText(`${r.origin} ${r.dest} ${r.long_ar} ${stopsText}`);
      return loc.match.some(m => text.includes(normalizeText(m)));
    });
    matchedRoutes.push(...nearby.slice(0, 6));
  }

  // Deduplicate
  const unique = [];
  const seenIds = new Set();
  for (const r of matchedRoutes) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      unique.push(r);
    }
  }

  return {
    entities,
    retrievedRoutes: unique.slice(0, 8)
  };
}

/**
 * Synthesizes an Egyptian Arabic conversational response (RAG grounded on verified Cairo transit & Metro data)
 */
export function generateTransitResponse(userText, retrievedData) {
  const { entities, retrievedRoutes } = retrievedData;

  // Case A: Metro Pricing Inquiry
  if (entities.isPricingInquiry && (entities.isMetroInquiry || userText.includes('مترو'))) {
    let reply = `🚇 **أسعار تذاكر مترو أنفاق القاهرة الرسمية الحالية:**\n\n`;
    METRO_TICKETS_PRICING.forEach((tier, i) => {
      reply += `• **${tier.zone}:** ${tier.price} جنيه مصري.\n`;
    });
    reply += `\n💡 **ملاحظة:** تتوفر اشتراكات مخفضة جداً للطلبة وكبار السن وذوي الهمم في جميع مكاتب الاشتراكات بمحطات المترو الرئيسية.`;
    return { text: reply, routes: retrievedRoutes };
  }

  // Case B: Metro Interchange Inquiry
  if (entities.isInterchangeInquiry || (entities.isMetroInquiry && (userText.includes('تحويل') || userText.includes('تبادل')))) {
    let reply = `⚡ **محطات التبادل والتحويل بين خطوط مترو القاهرة الكبرى:**\n\n`;
    METRO_INTERCHANGES_LIST.forEach((h, i) => {
      reply += `${i + 1}. **محطة ${h.name_ar}:** تبادل بين *${h.lines.join(' و ')}* (${h.location}).\n`;
    });
    reply += `\n💡 **نصيحة للمسافرين:** التحويل داخل نفس المحطة مجاني بالتذكرة الواحدة دون الحاجة لشراء تذكرة جديدة.`;
    return { text: reply, routes: retrievedRoutes };
  }

  // Case C: Specific Metro Line Inquiry
  if (entities.detectedMetroLine) {
    const info = METRO_LINES_DATA[entities.detectedMetroLine];
    if (info) {
      let reply = `🚇 **معلومات ${info.name_ar}:**\n\n`;
      reply += `• **المسار:** من **${info.terminals_ar}**.\n`;
      reply += `• **عدد المحطات:** حوالي ${info.stations_count} محطة.\n`;
      reply += `• **محطات التبادل:**\n`;
      info.interchanges.forEach(inc => {
        reply += `  - **${inc.station}**: ${inc.desc}.\n`;
      });
      reply += `• **أبرز المحطات على الخط:** ${info.key_stations.slice(0, 8).join(' • ')}...\n\n`;
      reply += `اضغط على كارت الخط بالأسفل لعرض مسار المترو بالكامل على الخريطة!`;
      return { text: reply, routes: retrievedRoutes };
    }
  }

  // Case D: General Metro Inquiry
  if (entities.isMetroInquiry && entities.locations.length === 0 && entities.lineNumbers.length === 0) {
    let reply = `🚇 **شبكة مترو أنفاق القاهرة الكبرى تتكون من 3 خطوط رئيسية:**\n\n`;
    reply += `1. **الخط الأول (الأزرق):** حلوان ➔ المرج الجديدة (35 محطة).\n`;
    reply += `2. **الخط الثاني (الأحمر):** شبرا الخيمة ➔ المنيب (20 محطة).\n`;
    reply += `3. **الخط الثالث (الأخضر):** عدلي منصور ➔ الكيت كات وتفريعاته إلى روض الفرج وجامعة القاهرة (34 محطة).\n\n`;
    reply += `محطات التبادل الرئيسية: **الشهداء (رمسيس)**، **السادات (التحرير)**، **العتبة**، **ناصر**، و**جامعة القاهرة**.\n`;
    reply += `تقدر تضغط على كارت أي خط مترو تحت عشان تشوف مساره ومحطاته بالكامل على الخريطة!`;
    return { text: reply, routes: retrievedRoutes };
  }

  // Case E: Specific Bus Line Query
  if (entities.lineNumbers.length > 0 && retrievedRoutes.length > 0) {
    const main = retrievedRoutes[0];
    const opposite = retrievedRoutes.find(r => r.dir !== main.dir && r.route_id === main.route_id);

    let reply = `أهلاً بيك! بالنسبة لـ **${main.short_ar || main.short_en}**:`;
    reply += `\n\n- **خط السير:** من **${main.origin}** إلى **${main.dest}**.`;
    reply += `\n- **نوع المركبة:** ${main.vehicle === 'Minibus' ? 'ميني باص' : (main.vehicle === 'Metro' ? 'مترو الأنفاق 🚇' : 'أتوبيس هيئة نقل عام')}.`;
    reply += `\n- **طول الرحلة:** حوالي **${main.len_km} كم**.`;
    
    if (main.via_stops && main.via_stops.length > 0) {
      reply += `\n- **يمر بـ:** ${main.via_stops.slice(0, 6).join(' • ')}...`;
    }

    if (opposite) {
      reply += `\n- **الاتجاه المعاكس:** متوفر برضه من **${opposite.origin}** إلى **${opposite.dest}**.`;
    }
    
    reply += `\n\nتقدر تضغط على كارت الخط تحت عشان تشوف مساره بالكامل على الخريطة!`;
    return { text: reply, routes: retrievedRoutes };
  }

  // Case F: Origin to Destination Multimodal Query (e.g. من شبرا للمعادي أو شبرا للتجمع)
  if (entities.locations.length >= 2) {
    const locA = entities.locations[0];
    const locB = entities.locations[1];
    const nameA = locA.ar;
    const nameB = locB.ar;

    // Subcase 1: Both locations have Metro stations (Metro journey recommended)
    if (locA.metroStations && locA.metroStations.length > 0 && locB.metroStations && locB.metroStations.length > 0) {
      let reply = `🚇 **أفضل وأسرع وسيلة بين ${nameA} و ${nameB} هي مترو الأنفاق:**\n\n`;
      reply += `• **محطة الركوب في ${nameA}:** ${locA.metroStations.slice(0, 2).join(' أو ')}.\n`;
      reply += `• **محطة النزول في ${nameB}:** ${locB.metroStations.slice(0, 2).join(' أو ')}.\n`;

      // Smart interchange tip
      if ((nameA === 'شبرا' && nameB === 'المعادي') || (nameA === 'المعادي' && nameB === 'شبرا')) {
        reply += `• **خط السير والتحويل:** اركب مترو الخط الثاني وانزل محطة **الشهداء (رمسيس)** أو **السادات (التحرير)**، وحوّل للخط الأول اتجاه حلوان للنزول في المعادي.\n`;
      } else if (nameA === 'شبرا' && nameB === 'الدقي') {
        reply += `• **خط السير:** خط مباشر بالكامل على **الخط الثاني (الأحمر)** اتجاه المنيب، النزول مباشرة في محطة الدقي!\n`;
      } else if (nameA === 'حلوان' && (nameB === 'رمسيس' || nameB === 'التحرير')) {
        reply += `• **خط السير:** خط مباشر على **الخط الأول (الأزرق)** اتجاه المرج.\n`;
      }

      reply += `\nبالإضافة لخطوط الأتوبيس والميني باص المتاحة في القائمة بالأسفل:`;
      return { text: reply, routes: retrievedRoutes };
    }

    // Subcase 2: One location has Metro and one does not (e.g. شبرا أو رمسيس للتجمع)
    if ((nameB === 'التجمع' || nameB === 'أكتوبر') && locA.metroStations && locA.metroStations.length > 0) {
      let reply = `🚌 **أفضل مسار مدمج (مترو + أتوبيس) من ${nameA} إلى ${nameB}:**\n\n`;
      if (nameB === 'التجمع') {
        reply += `1. **المرحلة الأولى:** اركب المترو حتى محطة **الشهداء (رمسيس)** أو **سراي القبة** أو **السادات (عبد المنعم رياض)**.\n`;
        reply += `2. **المرحلة الثانية:** من موقف الأتوبيسات هناك، اركب أتوبيس أو ميكروباص التجمع الخامس وشارع التسعين (مثل ميني باص 305 أو خط 1062 من عبد المنعم رياض أو خطوط المرج/رمسيس).\n`;
      } else if (nameB === 'أكتوبر') {
        reply += `1. **المرحلة الأولى:** اركب المترو للوصول إلى محطة **الجيزة** أو **عبد المنعم رياض** أو **محور روض الفرج**.\n`;
        reply += `2. **المرحلة الثانية:** اركب ميكروباص أو أتوبيس 6 أكتوبر / الشيخ زايد.\n`;
      }
      reply += `\nتفضل الخطوط المباشرة المسجلة المتاحة:`;
      return { text: reply, routes: retrievedRoutes };
    }

    // Subcase 3: Direct bus found
    if (retrievedRoutes.length > 0) {
      let reply = `لقيتلك ${retrievedRoutes.length} خط متاح بين **${nameA}** و **${nameB}**:\n`;
      retrievedRoutes.forEach((r, idx) => {
        const vehicleLabel = r.vehicle === 'Metro' ? 'مترو الأنفاق 🚇' : (r.vehicle === 'Minibus' ? 'ميني باص' : 'أتوبيس');
        reply += `\n${idx + 1}. **${r.short_ar || r.num}** (${vehicleLabel}): من *${r.origin}* لحد *${r.dest}* (${r.len_km} كم).`;
      });
      reply += `\n\nاضغط على أي خط منهم لعرض مساره ومحطاته على الخريطة!`;
      return { text: reply, routes: retrievedRoutes };
    } else {
      let reply = `مفيش خط مباشر مباشر مسجل في البيانات بيوصل من **${nameA}** لـ **${nameB}** مباشرة بدون تبديل.`;
      reply += `\n\n💡 **الحل الأفضل:** استخدم تبويب **"مخطط الرحلة من أ إلى ب"** فوق، وهيديلك أسهل تحويلة من خلال المترو أو مواقف رمسيس والتحرير والعباسية!`;
      return { text: reply, routes: [] };
    }
  }

  // Case G: Single Location Inquiry
  if (entities.locations.length === 1 && retrievedRoutes.length > 0) {
    const loc = entities.locations[0];
    const locName = loc.ar;
    let reply = `أبرز خطوط النقل والمترو التي تخدم منطقة **${locName}**:\n`;
    
    if (loc.metroStations && loc.metroStations.length > 0) {
      reply += `🚇 **محطات المترو في المنطقة:** ${loc.metroStations.join(' • ')}\n\n`;
    }

    retrievedRoutes.forEach((r, idx) => {
      const typeLabel = r.vehicle === 'Metro' ? 'مترو' : r.vehicle;
      reply += `${idx + 1}. **${r.num}** (${typeLabel}): ${r.origin} ➔ ${r.dest}.\n`;
    });

    reply += `\nاضغط على أي كارت لعرض مسار الخط بالكامل على الخريطة!`;
    return { text: reply, routes: retrievedRoutes };
  }

  // Default Guidance
  return {
    text: `أهلاً بيك في مواصلاتي! أنا مساعدك الذكي لشبكة حافلات ومترو أنفاق القاهرة الكبرى 🇪🇬🚇\n\nتقدر تسألني مثلاً:\n- *"ازاي اروح من شبرا للمعادي؟"*\n- *"اسعار تذاكر المترو كام؟"*\n- *"محطات التبادل بين خطوط المترو فين؟"*\n- *"ازاي اروح التجمع من رمسيس؟"*\n- *"مترو الخط الثالث بيمر على ايه؟"*\n- *"أتوبيس 1062 بيعدي على ايه؟"*`,
    routes: []
  };
}
