import { normalizeText } from './geoUtils.js';
import { expandSearchQuery, routeMatchesTokens } from './transitAliases.js';

/**
 * Official Cairo Transit Search Tool
 * Ground truth tool querying 1,794 bus/minibus/van lines + Metro Lines 1, 2, 3 and 84 stations.
 */

// Ground truth Metro system constants
export const METRO_FACTS = {
  pricing: [
    { zone: "منطقة واحدة (1 إلى 9 محطات)", price: 8, unit: "جنيه" },
    { zone: "منطقتين (10 إلى 16 محطة)", price: 10, unit: "جنيه" },
    { zone: "3 مناطق (17 إلى 23 محطة)", price: 15, unit: "جنيه" },
    { zone: "أكثر من 23 محطة", price: 20, unit: "جنيه" }
  ],
  interchanges: [
    { name_ar: "الشهداء (رمسيس)", name_en: "Al-Shohadaa", lines: ["M1", "M2"], location: "ميدان رمسيس ومحطة القطار الرئيسية" },
    { name_ar: "السادات (التحرير)", name_en: "Sadat", lines: ["M1", "M2"], location: "ميدان التحرير وموقف عبد المنعم رياض" },
    { name_ar: "العتبة", name_en: "Attaba", lines: ["M2", "M3"], location: "ميدان العتبة والأوبرا القديمة" },
    { name_ar: "جمال عبد الناصر", name_en: "Nasser", lines: ["M1", "M3"], location: "شارع 26 يوليو والإسعاف" },
    { name_ar: "جامعة القاهرة", name_en: "Cairo University", lines: ["M2", "M3"], location: "بين السرايات وجامعة القاهرة" },
    { name_ar: "الكيت كات", name_en: "Kit Kat", lines: ["M3"], location: "ميدان الكيت كات وتفريعة إمبابة والمهندسين" },
    { name_ar: "عدلي منصور", name_en: "Adly Mansour", lines: ["M3", "LRT"], location: "مجمع النقل التبادلي بطريق مصر الإسماعيلية" }
  ]
};

/**
 * Tool 1: searchTransitNetwork
 * Searches routes and intermediate stops with strict verification.
 */
export function searchTransitNetwork(query, routes, options = {}) {
  const { vehicleType = 'ALL', limit = 6 } = options;
  if (!query || !routes || routes.length === 0) {
    return {
      toolName: "searchTransitNetwork",
      query,
      foundCount: 0,
      sources: []
    };
  }

  const tokens = expandSearchQuery(query);

  const matches = routes.filter(r => {
    if (vehicleType !== 'ALL' && r.vehicle !== vehicleType) return false;
    return routeMatchesTokens(r, tokens);
  });

  const sources = matches.slice(0, limit).map((r, idx) => ({
    citationIndex: idx + 1,
    sourceId: `SRC-${r.vehicle.toUpperCase()}-${r.num || r.id}`,
    title: r.short_ar || r.long_ar || `${r.vehicle} ${r.num}`,
    vehicle: r.vehicle === 'Metro' ? 'مترو الأنفاق' : (r.agency === 'Madinaty' ? 'باص مدينتي' : (r.vehicle === 'Minibus' ? 'ميني باص' : 'أتوبيس')),
    lineNum: r.num,
    origin: r.origin,
    dest: r.dest,
    len_km: r.len_km,
    fare: r.fare || (r.vehicle === 'Metro' ? '8 - 20 ج.م' : 'غير مسجل'),
    via_stops: (r.via_stops || []).slice(0, 8),
    sub_districts: r.sub_districts || [],
    routeObj: r
  }));

  return {
    toolName: "searchTransitNetwork",
    query,
    tokensUsed: tokens.slice(0, 6),
    foundCount: matches.length,
    sources
  };
}

/**
 * Tool 2: searchMetroKnowledge
 * Queries official Metro pricing, interchange hubs, and station metadata.
 */
export function searchMetroKnowledge(query) {
  const norm = normalizeText(query);
  const isPricing = norm.includes('سعر') || norm.includes('تذكر') || norm.includes('اسعار') || norm.includes('بكام') || norm.includes('اشتراك');
  const isInterchange = norm.includes('تبادل') || norm.includes('احول') || norm.includes('تحويل') || norm.includes('تغيير');
  const isGeneral = norm.includes('مترو') || norm.includes('metro');

  const sources = [];

  if (isPricing) {
    sources.push({
      citationIndex: 1,
      sourceId: "SRC-METRO-PRICING-2024",
      title: "لائحة أسعار تذاكر مترو أنفاق القاهرة الرسمية",
      type: "pricing",
      data: METRO_FACTS.pricing
    });
  }

  if (isInterchange || isGeneral) {
    sources.push({
      citationIndex: sources.length + 1,
      sourceId: "SRC-METRO-INTERCHANGES",
      title: "دليل المحطات التبادلية الست لشبكة مترو القاهرة",
      type: "interchanges",
      data: METRO_FACTS.interchanges
    });
  }

  return {
    toolName: "searchMetroKnowledge",
    query,
    isPricingQuery: isPricing,
    isInterchangeQuery: isInterchange,
    sources
  };
}

/**
 * Checks if token matches text with boundary protection for short words
 */
function isTokenMatch(text, token) {
  if (!text || !token) return false;
  const tNorm = normalizeText(token);
  const textNorm = normalizeText(text);
  if (!textNorm || !tNorm) return false;
  if (tNorm.length <= 4) {
    const words = textNorm.split(/[\s(),\-&/]+/);
    return words.some(w => w === tNorm || w === 'ال' + tNorm || ('ال' + w) === tNorm);
  }
  return textNorm.includes(tNorm);
}

function getMatchIndex(route, tokens) {
  if (!tokens || tokens.length === 0) return -1;
  const origNorm = normalizeText(route.origin);
  if (tokens.some(t => isTokenMatch(origNorm, t))) return 0;

  if (route.via_stops && route.via_stops.length > 0) {
    for (let i = 0; i < route.via_stops.length; i++) {
      const stopNorm = normalizeText(route.via_stops[i]);
      if (tokens.some(t => isTokenMatch(stopNorm, t))) {
        return i + 1;
      }
    }
  }

  const destNorm = normalizeText(route.dest);
  if (tokens.some(t => isTokenMatch(destNorm, t))) {
    return (route.via_stops ? route.via_stops.length : 0) + 1;
  }

  return -1;
}

/**
 * Tool 3: findDirectOrTransferRoute
 * Verifies direct or 1-transfer connections between two locations.
 */
export function findDirectOrTransferRoute(originQuery, destQuery, routes) {
  if (!originQuery || !destQuery || !routes) {
    return { success: false, reason: "INVALID_PARAMETERS", sources: [] };
  }

  const origTokens = expandSearchQuery(originQuery);
  const destTokens = expandSearchQuery(destQuery);

  // 1. Directional Direct connections (Stop A appears before Stop B)
  const directMatches = routes.filter(r => {
    const iA = getMatchIndex(r, origTokens);
    const iB = getMatchIndex(r, destTokens);
    return iA !== -1 && iB !== -1 && iA < iB;
  }).sort((r1, r2) => {
    const score1 = (getMatchIndex(r1, origTokens) === 0 ? 10 : 0) + (getMatchIndex(r1, destTokens) >= (r1.via_stops?.length || 0) ? 10 : 0);
    const score2 = (getMatchIndex(r2, origTokens) === 0 ? 10 : 0) + (getMatchIndex(r2, destTokens) >= (r2.via_stops?.length || 0) ? 10 : 0);
    return score2 - score1;
  });

  if (directMatches.length > 0) {
    const sources = directMatches.slice(0, 5).map((r, i) => ({
      citationIndex: i + 1,
      sourceId: `SRC-DIRECT-${r.vehicle.toUpperCase()}-${r.num || r.id}`,
      title: `خط مباشر: ${r.short_ar || r.num}`,
      vehicle: r.vehicle === 'Metro' ? 'مترو الأنفاق' : (r.agency === 'Madinaty' ? 'باص مدينتي' : (r.vehicle === 'Minibus' ? 'ميني باص' : 'أتوبيس')),
      lineNum: r.num,
      origin: r.origin,
      dest: r.dest,
      len_km: r.len_km,
      via_stops: (r.via_stops || []).slice(0, 7),
      routeObj: r
    }));

    return {
      toolName: "findDirectOrTransferRoute",
      origin: originQuery,
      destination: destQuery,
      connectionType: "DIRECT",
      foundCount: directMatches.length,
      sources
    };
  }

  // 2. Metro Network Interchange check
  const metroLines = routes.filter(r => r.vehicle === 'Metro');
  if (metroLines.length > 0) {
    const origMetro = metroLines.filter(m => getMatchIndex(m, origTokens) !== -1);
    const destMetro = metroLines.filter(m => getMatchIndex(m, destTokens) !== -1);

    if (origMetro.length > 0 && destMetro.length > 0) {
      // Find interchange
      const m1 = origMetro[0];
      const m2 = destMetro[0];
      let hubName = "الشهداء (رمسيس) أو السادات (التحرير)";
      if ((m1.num === 'M1' && m2.num === 'M3') || (m1.num === 'M3' && m2.num === 'M1')) {
        hubName = "جمال عبد الناصر (شارع 26 يوليو)";
      } else if ((m1.num === 'M2' && m2.num === 'M3') || (m1.num === 'M3' && m2.num === 'M2')) {
        hubName = "العتبة أو جامعة القاهرة";
      }

      const sources = [
        {
          citationIndex: 1,
          sourceId: `SRC-METRO-LEG1-${m1.num}`,
          title: `المرحلة 1: ${m1.short_ar} باتجاه محطة التحويل (${hubName})`,
          vehicle: "مترو الأنفاق",
          lineNum: m1.num,
          origin: m1.origin,
          dest: m1.dest,
          routeObj: m1
        },
        {
          citationIndex: 2,
          sourceId: `SRC-METRO-LEG2-${m2.num}`,
          title: `المرحلة 2: ${m2.short_ar} من (${hubName}) إلى الوجهة`,
          vehicle: "مترو الأنفاق",
          lineNum: m2.num,
          origin: m2.origin,
          dest: m2.dest,
          routeObj: m2
        }
      ];

      return {
        toolName: "findDirectOrTransferRoute",
        origin: originQuery,
        destination: destQuery,
        connectionType: "METRO_TRANSFER",
        hubName,
        sources
      };
    }
  }

  // 3. Check transfer via major Cairo bus hubs
  const MAJOR_HUBS = [
    { name: "ميدان رمسيس (الشهداء)", tokens: ["رمسيس", "الشهداء", "ramses"] },
    { name: "ميدان التحرير (السادات / عبد المنعم رياض)", tokens: ["التحرير", "السادات", "عبد المنعم رياض", "tahrir"] },
    { name: "ميدان العتبة", tokens: ["العتبة", "ataba", "attaba"] },
    { name: "ميدان العباسية", tokens: ["العباسية", "عباسية", "abbasseya"] },
    { name: "جامعة القاهرة", tokens: ["جامعة القاهرة", "cairo university"] },
    { name: "عدلي منصور", tokens: ["عدلي منصور", "adly mansour"] }
  ];

  for (const hub of MAJOR_HUBS) {
    const hubTokens = hub.tokens;
    const leg1 = routes.filter(r => {
      const iA = getMatchIndex(r, origTokens);
      const iHub = getMatchIndex(r, hubTokens);
      return iA !== -1 && iHub !== -1 && iA < iHub;
    });

    const leg2 = routes.filter(r => {
      const iHub = getMatchIndex(r, hubTokens);
      const iB = getMatchIndex(r, destTokens);
      return iHub !== -1 && iB !== -1 && iHub < iB;
    });

    if (leg1.length > 0 && leg2.length > 0) {
      const r1 = leg1[0];
      const r2 = leg2[0];
      const sources = [
        {
          citationIndex: 1,
          sourceId: `SRC-TRANSFER-LEG1-${r1.num || r1.id}`,
          title: `المرحلة 1: ${r1.short_ar || r1.num} إلى ${hub.name}`,
          vehicle: r1.vehicle === 'Metro' ? 'مترو الأنفاق' : (r1.vehicle === 'Minibus' ? 'ميني باص' : 'أتوبيس'),
          lineNum: r1.num,
          origin: r1.origin,
          dest: r1.dest,
          len_km: r1.len_km,
          routeObj: r1
        },
        {
          citationIndex: 2,
          sourceId: `SRC-TRANSFER-LEG2-${r2.num || r2.id}`,
          title: `المرحلة 2: ${r2.short_ar || r2.num} من ${hub.name} إلى الوجهة`,
          vehicle: r2.vehicle === 'Metro' ? 'مترو الأنفاق' : (r2.vehicle === 'Minibus' ? 'ميني باص' : 'أتوبيس'),
          lineNum: r2.num,
          origin: r2.origin,
          dest: r2.dest,
          len_km: r2.len_km,
          routeObj: r2
        }
      ];

      return {
        toolName: "findDirectOrTransferRoute",
        origin: originQuery,
        destination: destQuery,
        connectionType: "TRANSFER",
        hubName: hub.name,
        sources
      };
    }
  }

  // No verified route exists!
  return {
    toolName: "findDirectOrTransferRoute",
    origin: originQuery,
    destination: destQuery,
    connectionType: "NONE",
    foundCount: 0,
    sources: []
  };
}
