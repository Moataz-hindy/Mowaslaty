import { normalizeText } from './geoUtils.js';
import { 
  searchTransitNetwork, 
  searchMetroKnowledge, 
  findDirectOrTransferRoute,
  METRO_FACTS 
} from './transitSearchTool.js';

/**
 * Parses user query to extract origin and destination if present
 */
export function parseRouteQuery(query) {
  if (!query) return null;
  const clean = query.replace(/[؟?.,!]/g, ' ').trim();

  // Pattern 1: ... من <origin> (إلى|الى|لحد|لغاية|لـ|ل)<dest>
  // Note: Handling attached Arabic preposition 'ل' or 'لـ' or 'لل'
  const match1 = clean.match(/(?:^|\s)من\s+([^\s]+(?:\s+[^\s]+){0,3}?)\s+(?:(?:إلى|الى|لحد|لغاية)\s*|لـ|ل)(.+)$/i);
  if (match1) {
    let orig = match1[1].trim();
    let dest = match1[2].trim();
    return { origin: orig, destination: cleanDestinationPrefix(dest) };
  }

  // Pattern 2: ازاي اروح <dest> من <origin>
  const match2 = clean.match(/(?:ازاي اروح|اروح ازاي|كيف اصل الى|اوصل ازاي|عايز اروح)\s+(.+?)\s+من\s+(.+)$/i);
  if (match2) {
    let dest = match2[1].replace(/^(إلى|الى|لـ|ل)\s*/, '').trim();
    let orig = match2[2].trim();
    return { origin: orig, destination: cleanDestinationPrefix(dest) };
  }

  return null;
}

function cleanDestinationPrefix(dest) {
  let d = dest.trim();
  if (d.startsWith('لل')) {
    d = 'ال' + d.slice(2);
  } else if (d.startsWith('لـ')) {
    d = d.slice(2);
  } else if (d.startsWith('ل') && !d.startsWith('لا') && !d.startsWith('لو')) {
    d = d.slice(1);
  }
  return d.trim();
}

/**
 * Extracts key transit identifiers (numbers, keywords) for search
 */
export function extractTransitKeywords(query) {
  if (!query) return { nums: [], cleanQuery: '' };
  const clean = query.replace(/[؟?.,!]/g, ' ').trim();
  const nums = clean.match(/\b\d+\b/g) || [];
  
  const stopWords = new Set([
    'خط', 'أتوبيس', 'اتوبيس', 'مينى', 'ميني', 'باص', 'بيعدي', 'على', 'علي',
    'ايه', 'إيه', 'فين', 'محطة', 'محطات', 'ازاي', 'اروح', 'عايز', 'اوصل',
    'من', 'الى', 'إلى', 'لـ', 'ل', 'يا', 'تطبيقي', 'عايزين', 'ممكن', 'لو', 'سمحت'
  ]);
  const words = clean.split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));

  return {
    nums,
    words,
    cleanQuery: words.join(' ')
  };
}

/**
 * Search Tool Orchestrator
 * Gathers ground truth data using official transit search tools.
 */
export function executeSearchTools(query, routes) {
  const toolLogs = [];
  const sources = [];
  const seenSourceIds = new Set();

  function addSource(src) {
    if (!src || !src.sourceId || seenSourceIds.has(src.sourceId)) return;
    seenSourceIds.add(src.sourceId);
    sources.push({
      ...src,
      citationIndex: sources.length + 1
    });
  }

  // 1. Tool: searchMetroKnowledge (fares, interchanges)
  const norm = normalizeText(query);
  const isMetroTopic = norm.includes('مترو') || norm.includes('metro') || norm.includes('سعر') || 
                       norm.includes('تذكر') || norm.includes('تبادل') || norm.includes('تحويل');
  
  if (isMetroTopic) {
    const metroRes = searchMetroKnowledge(query);
    if (metroRes.sources.length > 0) {
      toolLogs.push({
        toolName: "searchMetroKnowledge",
        label: "فحص بيانات ومعلومات شبكة المترو الرسمية (أسعار وتحويلات)",
        query,
        resultsCount: metroRes.sources.length
      });
      metroRes.sources.forEach(addSource);
    }
  }

  // 2. Tool: findDirectOrTransferRoute (Origin -> Destination journey)
  const routePair = parseRouteQuery(query);

  if (routePair && routePair.origin && routePair.destination) {
    const routeRes = findDirectOrTransferRoute(routePair.origin, routePair.destination, routes);
    toolLogs.push({
      toolName: "findDirectOrTransferRoute",
      label: `البحث عن مسار موثق بين "${routePair.origin}" و "${routePair.destination}"`,
      query: `${routePair.origin} ➔ ${routePair.destination}`,
      connectionType: routeRes.connectionType,
      resultsCount: routeRes.sources.length
    });

    if (routeRes.sources && routeRes.sources.length > 0) {
      routeRes.sources.forEach(addSource);
    }
    // CRITICAL ANTI-HALLUCINATION:
    // If user asked how to go from A to B and NO route exists between A and B,
    // do NOT run random fallback searches that would grab routes for only A or only B!
    return {
      query,
      routePair,
      toolLogs,
      sources
    };
  }

  // 3. Tool: searchTransitNetwork (Line numbers, specific places, bus lines)
  const { nums, cleanQuery } = extractTransitKeywords(query);
  const searchTerms = [];
  if (nums.length > 0) searchTerms.push(...nums);
  if (cleanQuery && !nums.includes(cleanQuery)) searchTerms.push(cleanQuery);
  if (searchTerms.length === 0) searchTerms.push(query);

  for (const term of searchTerms) {
    const netRes = searchTransitNetwork(term, routes, { limit: 6 });
    if (netRes.sources.length > 0) {
      toolLogs.push({
        toolName: "searchTransitNetwork",
        label: `استعلام شبكة النقل العام عن "${term}"`,
        query: term,
        resultsCount: netRes.sources.length
      });
      netRes.sources.forEach(addSource);
      if (sources.length >= 6) break;
    }
  }

  return {
    query,
    routePair: null,
    toolLogs,
    sources
  };
}

/**
 * Local Grounded Synthesis Engine (Zero Hallucination, Strictly Fact-Constrained)
 */
export function generateLocalGroundedResponse(query, searchResult) {
  const { sources, toolLogs, routePair } = searchResult;

  // STRICT RULE: If no verified sources found, confess ignorance honestly.
  if (sources.length === 0) {
    let refusal = `عذراً، لم أجد في قاعدة البيانات الموثقة لمواصلات القاهرة الكبرى (حافلات ومترو) أي بيانات أو مسارات مسجلة تطابق بحثك عن "${query}".`;
    if (routePair) {
      refusal += `\n\nلم يتم العثور على خط مباشر أو تحويلة مؤكدة بين **${routePair.origin}** و **${routePair.destination}**.`;
    }
    refusal += `\n\n🛡️ **سياسة منع التخمين (Anti-Hallucination):**\nلا يمكنني اقتراح خطوط أو أرقام غير مؤكدة في البيانات الرسمية. يمكنك تجربة:\n1. البحث باسم محطة رئيسية قريبة (مثل رمسيس، العتبة، العباسية، أو الجيزة).\n2. استخدام تبويب **"رحلة أ-ب"** لتخطيط المسار الجغرافي بالأقمار الصناعية ومحطات النزول القريبة.`;
    return {
      text: refusal,
      sources: [],
      toolLogs,
      generationMode: 'local'
    };
  }

  // Format factual response based on source types
  let responseText = "";

  // 1. Metro Knowledge (pricing / interchanges)
  const pricingSrc = sources.find(s => s.type === 'pricing');
  if (pricingSrc) {
    responseText += `🚇 **لائحة أسعار تذاكر مترو أنفاق القاهرة الرسمية [المصدر ${pricingSrc.citationIndex}]:**\n\n`;
    pricingSrc.data.forEach(tier => {
      responseText += `• **${tier.zone}:** ${tier.price} ${tier.unit}.\n`;
    });
    responseText += `\n💡 تتوفر اشتراكات مخفضة للطلبة وكبار السن في محطات المترو الرئيسية [المصدر ${pricingSrc.citationIndex}].\n\n`;
  }

  const interchangeSrc = sources.find(s => s.type === 'interchanges');
  if (interchangeSrc) {
    responseText += `⚡ **محطات التبادل والتحويل الرئيسية لشبكة المترو [المصدر ${interchangeSrc.citationIndex}]:**\n\n`;
    interchangeSrc.data.forEach((hub, idx) => {
      responseText += `${idx + 1}. **محطة ${hub.name_ar}:** تبادل بين خطوط (*${hub.lines.join(' و ')}*) - ${hub.location} [المصدر ${interchangeSrc.citationIndex}].\n`;
    });
    responseText += `\n💡 التحويل داخل المحطات التبادلية مجاني بالتذكرة ذاتها.\n\n`;
  }

  // 2. Direct or Transfer Routes
  const routeSources = sources.filter(s => s.lineNum || s.routeObj);
  if (routeSources.length > 0) {
    if (routePair) {
      responseText += `📍 **نتائج المسار الموثق بين ${routePair.origin} و ${routePair.destination}:**\n\n`;
    } else {
      responseText += `🚌 **الخطوط الموثقة المطابقة لبحثك:**\n\n`;
    }

    routeSources.forEach(src => {
      const vehicleDesc = src.vehicle || (src.routeObj && src.routeObj.vehicle) || 'أتوبيس';
      responseText += `• **${src.title}** (${vehicleDesc}) [المصدر ${src.citationIndex}]:\n`;
      responseText += `  - **خط السير:** من *${src.origin}* إلى *${src.dest}*`;
      if (src.len_km) responseText += ` (المسافة: حوالي ${src.len_km} كم)`;
      responseText += `.\n`;
      
      if (src.via_stops && src.via_stops.length > 0) {
        responseText += `  - **أبرز المحطات:** ${src.via_stops.slice(0, 7).join(' • ')} [المصدر ${src.citationIndex}].\n`;
      }
      responseText += `\n`;
    });

    responseText += `اضغط على أي مصدر أو كارت بالأسفل لعرض مسار الخط بالكامل على الخريطة!`;
  }

  return {
    text: responseText.trim(),
    sources,
    toolLogs,
    generationMode: 'local'
  };
}

/**
 * Gemini API Generative Engine (LLM Mode with Strict Grounding & Anti-Hallucination)
 */
export async function generateGeminiGroundedResponse(query, searchResult, apiKey) {
  const { sources, toolLogs, routePair } = searchResult;

  // STRICT RULE: If no sources found, do NOT call LLM to avoid any risk of hallucination.
  if (sources.length === 0) {
    return generateLocalGroundedResponse(query, searchResult);
  }

  const systemInstruction = `أنت المساعد الذكي الموثق لمنظومة مواصلات القاهرة ومترو الأنفاق (Mowaslaty Cairo Transit).
قواعد صارمة جداً لمنع الهلوسة (Zero Hallucination Policy):
1. يجب أن تعتمد إجابتك حصراً وحرفياً على "نتائج أداة البحث" (Search Tool Results) المرفقة فقط.
2. يمنع منعاً باتاً اختلاق أو تخمين أو افتراض أي أرقام خطوط حافلات، أو محطات مترو، أو مسارات، أو أسعار غير موجودة في نتائج البحث.
3. إذا كانت نتائج البحث لا تحتوي على إجابة كافية، قل بكل صراحة ووضوح: "لا تتوفر بيانات مؤكدة لهذا المسار في قاعدة البيانات الرسمية".
4. يجب أن توثق كل رقم خط، ومسار، ومحطة، وسعر تذكرة بإدراج رقم المصدر بصيغة [المصدر X] حيث X هو رقم citationIndex الموضح في نتائج البحث.
5. أجب بأسلوب ودود، واضح، ومباشر باللهجة المصرية أو العربية الفصحى المبسطة.`;

  const sourcesSummary = sources.map(s => {
    let details = `[المصدر ${s.citationIndex}]: ${s.title} (${s.sourceId})\n`;
    if (s.lineNum) details += `  رقم الخط: ${s.lineNum} | النوع: ${s.vehicle}\n`;
    if (s.origin && s.dest) details += `  المسار: من ${s.origin} إلى ${s.dest}\n`;
    if (s.len_km) details += `  الطول: ${s.len_km} كم\n`;
    if (s.via_stops && s.via_stops.length > 0) details += `  المحطات: ${s.via_stops.join(', ')}\n`;
    if (s.data) details += `  البيانات الرسمية: ${JSON.stringify(s.data, null, 2)}\n`;
    return details;
  }).join('\n');

  const userPrompt = `استفسار المستخدم: "${query}"

نتائج أداة البحث الموثقة (Official Ground Truth Search Results):
${sourcesSummary}

المطلوب:
اكتب إجابة دقيقة ومفيدة ومباشرة للمستخدم مستنداً فقط إلى نتائج أداة البحث أعلاه، مع وضع أرقام التوثيق [المصدر X] بدقة.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.1, // low temperature for maximum factual precision
          maxOutputTokens: 1000
        }
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      console.warn("Gemini API error, falling back to local grounded engine:", errJson);
      const fallback = generateLocalGroundedResponse(query, searchResult);
      fallback.warning = `(تعذر الاتصال بـ Gemini API: ${response.statusText}، تم التوليد محلياً)`;
      return fallback;
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return generateLocalGroundedResponse(query, searchResult);
    }

    return {
      text: candidateText.trim(),
      sources,
      toolLogs,
      generationMode: 'gemini'
    };
  } catch (err) {
    console.warn("Network error during Gemini generation, using local grounding:", err);
    const fallback = generateLocalGroundedResponse(query, searchResult);
    fallback.warning = `(تم التوليد محلياً بسبب خطأ في اتصال الإنترنت أو مفتاح API)`;
    return fallback;
  }
}

/**
 * Main RAG Generator Entrypoint
 * Executes Search Tool -> Grounded Generation (Gemini or Local) -> Returns verified response with citations.
 */
export async function generateGroundedRAGResponse(query, routes, options = {}) {
  const { apiKey = null } = options;

  // 1. Tool execution
  const searchResult = executeSearchTools(query, routes);

  // 2. Actual generation
  if (apiKey && apiKey.trim().length > 10) {
    return await generateGeminiGroundedResponse(query, searchResult, apiKey.trim());
  } else {
    return generateLocalGroundedResponse(query, searchResult);
  }
}
