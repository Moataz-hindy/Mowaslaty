import { normalizeText } from './geoUtils.js';

/**
 * Cairo Transit Synonym & Landmark Mapping
 * 
 * 1. AREA_SYNONYMS: Equivalence groups for districts (Arabic, English, colloquial, typos)
 *    When any term in an area group is searched, parent district and its major sub-hubs are matched.
 * 2. LANDMARK_ALIASES: English & Arabic equivalents of specific landmarks, streets, and universities.
 */

export const AREA_GROUPS = [
  // Cairo Metro Network
  {
    canonical: 'مترو الأنفاق',
    aliases: [
      'مترو', 'المترو', 'metro', 'cairo metro', 'm1', 'm2', 'm3', 'الخط الاول', 'الخط الثاني',
      'الخط التاني', 'الخط الثالث', 'الخط التالت', 'محطات المترو'
    ],
    containedLandmarks: [
      'الشهداء', 'السادات', 'العتبة', 'جمال عبد الناصر', 'ناصر', 'جامعة القاهرة', 'الكيت كات',
      'عدلي منصور', 'صفاء حجازي', 'ماسبيرو', 'شبرا الخيمة', 'المنيب', 'حلوان', 'المرج الجديدة'
    ]
  },
  // New Cairo / Fifth Settlement

  {
    canonical: 'التجمع الخامس',
    aliases: [
      'التجمع', 'التجمع الخامس', 'تجمع', 'fifth settlement', '5th settlement', 'fifth srttlement',
      'settlement', 'new cairo', 'القاهرة الجديدة', 'القاهره الجديده', 'tagamoa', 'tagamo3'
    ],
    // Landmarks located in this area that might be written as the destination instead of the area name
    containedLandmarks: [
      'auc', 'الجامعة الامريكية', 'الجامعه الامريكيه', 'american university',
      'guc', 'الجامعة الالمانية', 'الجامعه الالمانيه', 'german university',
      'شارع التسعين', 'التسعين', '90 st', '90th st',
      'cfc', 'كايرو فيستيفال', 'كايرو فستيفال', 'cairo festival',
      'موقف اللوتس', 'جامعة المستقبل', 'fue', 'مستقبل'
    ]
  },
  // Nasr City
  {
    canonical: 'مدينة نصر',
    aliases: ['مدينة نصر', 'مدينه نصر', 'nasr city'],
    containedLandmarks: [
      'سيتي ستارز', 'سيتى ستارز', 'city stars', 'مكرم عبيد', 'عباس العقاد',
      'الحي العاشر', 'الحي السابع', 'الحي الثامن', 'الحي السادس',
      'رابعة', 'رابعه', 'رابعة العدوية', 'طيبة مول', 'اول عباس', 'مصطفى النحاس',
      'السراج مول', 'جنينة مول', 'زهراء مدينة نصر', 'استاد القاهرة', 'المشير طنطاوي'
    ]
  },
  // Heliopolis
  {
    canonical: 'مصر الجديدة',
    aliases: ['مصر الجديدة', 'مصر الجديده', 'heliopolis'],
    containedLandmarks: [
      'روكسي', 'roxy', 'الكوربة', 'الكوربه', 'korba', 'ميدان الحجاز',
      'الميرغني', 'تريومف', 'ألف مسكن', 'الف مسكن', 'شيراتون', 'sheraton',
      'النزهة', 'النزهه', 'ميدان المحكمة', 'ميدان الاسماعيلية', 'سانت فاتيما', 'نادي الشمس'
    ]
  },
  // Downtown & Tahrir
  {
    canonical: 'وسط البلد',
    aliases: ['وسط البلد', 'وسط القاهره', 'downtown'],
    containedLandmarks: [
      'التحرير', 'تحرير', 'tahrir', 'ميدان التحرير',
      'عبد المنعم رياض', 'عبدالمنعم رياض', 'riad',
      'رمسيس', 'ramses', 'ramsis', 'ميدان رمسيس',
      'العتبة', 'العتبه', 'ataba', 'باب اللوق', 'الاسعاف', 'طلعت حرب', 'احمد حلمي', 'غمرة'
    ]
  },
  // Dokki & Mohandessin
  {
    canonical: 'الدقي والمهندسين',
    aliases: ['الدقي', 'الدقى', 'dokki', 'المهندسين', 'mohandessin', 'mohandeseen'],
    containedLandmarks: [
      'ميدان المساحة', 'مصدق', 'ميدان الدقي', 'جامعة الدول', 'جامعه الدول',
      'ميدان لبنان', 'شارع السودان', 'سفنكس', 'ميدان سفنكس', 'احمد عرابي', 'شهاب'
    ]
  },
  // Giza & Haram & Faisal
  {
    canonical: 'الجيزة',
    aliases: ['الجيزة', 'الجيزه', 'giza'],
    containedLandmarks: [
      'ميدان الجيزة', 'جامعة القاهرة', 'جامعه القاهره', 'cairo university',
      'بين السرايات', 'شارع الهرم', 'الهرم', 'haram', 'شارع فيصل', 'فيصل', 'faisal',
      'العمرانية', 'المنيب', 'monib', 'موقف المنيب'
    ]
  },
  // 6th of October & Sheikh Zayed
  {
    canonical: 'أكتوبر والشيخ زايد',
    aliases: ['اكتوبر', 'أكتوبر', '6th of october', 'october', 'الشيخ زايد', 'sheikh zayed', 'zayed'],
    containedLandmarks: [
      'الحصري', 'الحصرى', 'hosary', 'مول العرب', 'mall of arabia',
      'هايبر وان', 'hyper one', 'ميدان النجدة', 'ليلة القدر', 'موقف اكتوبر', 'دريم لاند'
    ]
  },
  // Maadi
  {
    canonical: 'المعادي',
    aliases: ['المعادي', 'المعادى', 'maadi'],
    containedLandmarks: [
      'دجلة', 'دجله', 'degla', 'جراند مول', 'ميدان الحرية',
      'شارع النصر', 'ثكنات المعادي', 'زهراء المعادي'
    ]
  },
  // Shubra
  {
    canonical: 'شبرا',
    aliases: ['شبرا', 'shubra', 'shoubra'],
    containedLandmarks: [
      'المظلات', 'مظلات', 'mazallat', 'الخلفاوي', 'دوران شبرا',
      'شبرا الخيمة', 'شبرا الخيمه', 'روض الفرج', 'المؤسسة', 'المؤسسه'
    ]
  },
  // Abbasiya
  {
    canonical: 'العباسية',
    aliases: ['العباسية', 'العباسيه', 'abbasiya'],
    containedLandmarks: ['ميدان العباسية', 'جامعة عين شمس', 'جامعه عين شمس', 'عين شمس', 'الوايلي']
  },
  // Helwan
  {
    canonical: 'حلوان',
    aliases: ['حلوان', 'helwan'],
    containedLandmarks: ['جامعة حلوان', 'جامعه حلوان', 'المعصرة', 'طرة']
  },
  // Madinaty
  {
    canonical: 'مدينتي',
    aliases: ['مدينتي', 'مدينتى', 'madinaty', 'الساوث بارك', 'south park', 'أوبن إير مول', 'اوبن اير مول', 'open air mall', 'باص مدينتي'],
    containedLandmarks: ['الساوث بارك', 'منطقة الحركة', 'أوبن إير مول', 'بوابة مدينتي', 'مول مدينتي']
  },
  // Rehab & East Cairo
  {
    canonical: 'مدن شرق القاهرة',
    aliases: ['الرحاب', 'rehab', 'الشروق', 'shorouk', 'بدر', 'badr'],
    containedLandmarks: ['ميدان الرحاب', 'سوق الرحاب', 'بوابة 20 الرحاب']
  }
];

// Specific landmark equivalents (Arabic <-> English <-> Abbreviations)
export const SPECIFIC_LANDMARK_MAP = [
  ['auc', 'الجامعة الامريكية', 'الجامعه الامريكيه', 'american university'],
  ['guc', 'الجامعة الالمانية', 'الجامعه الالمانيه', 'german university'],
  ['cfc', 'كايرو فيستيفال', 'كايرو فستيفال', 'cairo festival', 'cairo festival city'],
  ['fue', 'جامعة المستقبل', 'جامعه المستقبل', 'future university'],
  ['سيتي ستارز', 'سيتى ستارز', 'city stars'],
  ['مكرم عبيد', 'makram ebeid', 'makram obaid'],
  ['عباس العقاد', 'abbas el akkad', 'abbas elakad'],
  ['روكسي', 'roxy'],
  ['الكوربة', 'الكوربه', 'korba'],
  ['شارع التسعين', 'التسعين', '90 st', '90th st', 'south 90', 'north 90'],
  ['الحصري', 'الحصرى', 'hosary', 'elhosary'],
  ['مول العرب', 'mall of arabia'],
  ['هايبر وان', 'hyper one'],
  ['عبد المنعم رياض', 'عبدالمنعم رياض', 'riad', 'abdel moneim riad'],
  ['رمسيس', 'ramses', 'ramsis'],
  ['جامعة القاهرة', 'جامعه القاهره', 'cairo university'],
  ['المشير طنطاوي', 'مسجد المشير', 'tantawy mosque', 'al moshir'],
  ['مترو', 'metro', 'مترو الانفاق', 'مترو الأنفاق', 'cairo metro'],
  ['الشهداء', 'al-shohadaa', 'shohadaa', 'shohada', 'محطة الشهداء'],
  ['السادات', 'sadat', 'al-sadat', 'محطة السادات'],
  ['العتبة', 'attaba', 'ataba', 'محطة العتبة'],
  ['جمال عبد الناصر', 'ناصر', 'nasser', 'محطة ناصر'],
  ['الكيت كات', 'kit kat', 'kitkat', 'محطة الكيت كات'],
  ['عدلي منصور', 'adly mansour', 'adly mansoor'],
  ['صفاء حجازي', 'safaa hegazy', 'مترو الزمالك'],
  ['ماسبيرو', 'maspero'],
  ['شبرا الخيمة', 'shubra el kheima', 'مترو شبرا'],
  ['المنيب', 'el mounib', 'mounib', 'مترو المنيب'],
  ['حلوان', 'helwan', 'مترو حلوان'],
  ['المرج الجديدة', 'new el marg', 'المرج']
];


// Pre-normalize for speed
const NORMALIZED_AREAS = AREA_GROUPS.map(g => ({
  canonical: g.canonical,
  aliases: g.aliases.map(a => normalizeText(a)),
  containedLandmarks: g.containedLandmarks.map(l => normalizeText(l))
}));

const NORMALIZED_LANDMARKS = SPECIFIC_LANDMARK_MAP.map(list => 
  list.map(item => normalizeText(item))
);

/**
 * Expands a search query into an array of search tokens.
 * Handles:
 * 1. Direct normalized query
 * 2. Specific landmark synonyms (e.g. "auc" -> ["auc", "الجامعة الامريكية"])
 * 3. Area name search expands to include area aliases AND its major destination landmarks
 *    (e.g. "fifth settlement" or "التجمع" -> ["التجمع", "تجمع", "fifth settlement", "new cairo", "auc", "الجامعة الامريكية", "شارع التسعين", ...])
 * 
 * @param {string} rawQuery 
 * @returns {Array<string>} Array of normalized query tokens
 */
export function expandSearchQuery(rawQuery) {
  if (!rawQuery) return [];
  const normalized = normalizeText(rawQuery);
  if (!normalized) return [];

  const tokens = new Set([normalized]);

  // 1. Check specific landmark equivalents
  for (const group of NORMALIZED_LANDMARKS) {
    if (group.some(item => item === normalized || normalized.includes(item) || item.includes(normalized))) {
      for (const item of group) {
        tokens.add(item);
      }
    }
  }

  // 2. Check area groups
  for (const area of NORMALIZED_AREAS) {
    const matchesArea = area.aliases.some(a => 
      normalized.includes(a) || a.includes(normalized)
    );

    if (matchesArea) {
      // Add all area aliases
      for (const a of area.aliases) {
        tokens.add(a);
      }
      // Also add key destination landmarks in this area (e.g. AUC, 90th St for Fifth Settlement)
      for (const l of area.containedLandmarks) {
        tokens.add(l);
      }
    }
  }

  return Array.from(tokens);
}

/**
 * Checks whether a route matches the expanded query tokens.
 * Supports:
 * - Line numbers (r.num)
 * - Names (r.short_ar, r.short_en, r.long_ar, r.long_en)
 * - Terminals (r.origin, r.dest)
 * - Intermediate stops in the middle of the route (r.via_stops)
 * - Administrative districts (r.sub_districts)
 * 
 * @param {Object} route Route object from routes_summary.json
 * @param {Array<string>} tokens Array of normalized search tokens
 * @returns {boolean}
 */
export function routeMatchesTokens(route, tokens) {
  if (!tokens || tokens.length === 0) return true;

  const numNorm = normalizeText(route.num);
  const shortArNorm = normalizeText(route.short_ar);
  const shortEnNorm = normalizeText(route.short_en);
  const longArNorm = normalizeText(route.long_ar);
  const longEnNorm = normalizeText(route.long_en);
  const originNorm = normalizeText(route.origin);
  const destNorm = normalizeText(route.dest);

  const subDistrictsJoined = route.sub_districts 
    ? normalizeText(route.sub_districts.join(' ')) 
    : '';

  const viaStopsJoined = route.via_stops 
    ? normalizeText(route.via_stops.join(' ')) 
    : '';

  for (const token of tokens) {
    if (!token) continue;

    // Line number exact or prefix
    if (numNorm && (numNorm === token || numNorm.includes(token))) {
      return true;
    }

    // Origin or Destination
    if (originNorm.includes(token) || destNorm.includes(token)) {
      return true;
    }

    // Route title / description
    if (
      shortArNorm.includes(token) ||
      shortEnNorm.includes(token) ||
      longArNorm.includes(token) ||
      longEnNorm.includes(token)
    ) {
      return true;
    }

    // Sub-districts
    if (subDistrictsJoined && subDistrictsJoined.includes(token)) {
      return true;
    }

    // Intermediate stops along the route!
    if (viaStopsJoined && viaStopsJoined.includes(token)) {
      return true;
    }
  }

  return false;
}
