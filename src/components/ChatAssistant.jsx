import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Bot, User, Sparkles, Compass, ShieldCheck, 
  Search, Database, BookOpen, Settings, Key, Check, 
  ChevronDown, ChevronUp, AlertCircle, Wrench
} from 'lucide-react';
import { generateGroundedRAGResponse } from '../utils/ragGenerator';
import { VEHICLE_COLORS } from '../utils/i18n';

const SUGGESTED_QUERIES = [
  "ازاي اروح من شبرا لمساكن شيراتون؟",
  "اسعار تذاكر المترو الرسمية كام؟",
  "محطات التبادل بين خطوط المترو",
  "خط 1062 بيعدي على ايه؟",
  "ازاي اروح من رمسيس للتجمع الخامس؟",
  "ازاي اروح من شبرا لباريس؟"
];

export default function ChatAssistant({ routes, onSelectRoute, lang }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: `أهلاً بيك! أنا مساعد مواصلاتي التوليدي الذكي الموثق (Grounded RAG) لشبكة أتوبيسات ومترو القاهرة الكبرى.\n\nاسألني عن أي وجهة، أو رقم خط، أو أسعار ومحطات المترو. أستخدم أداة فحص رسمية مدعومة بـ 1,794 خطاً لتقديم إجابة حقيقية وموثقة بالمصادر بدون أي تخمين أو هلوسة!`,
      sources: [],
      toolLogs: [],
      generationMode: 'local'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mowaslaty_gemini_api_key') || '');
  const [aiMode, setAiMode] = useState(() => localStorage.getItem('mowaslaty_ai_mode') || 'local');
  const [expandedTools, setExpandedTools] = useState({});
  const [activeSourceHighlight, setActiveSourceHighlight] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSaveSettings = () => {
    localStorage.setItem('mowaslaty_gemini_api_key', apiKey.trim());
    localStorage.setItem('mowaslaty_ai_mode', aiMode);
    setShowSettings(false);
  };

  const toggleToolLogs = (msgId) => {
    setExpandedTools(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const handleSend = async (textToSend) => {
    const query = textToSend || inputVal;
    if (!query.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      sources: [],
      toolLogs: []
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    try {
      const activeKey = aiMode === 'gemini' ? apiKey : null;
      const response = await generateGroundedRAGResponse(query, routes, {
        apiKey: activeKey
      });

      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: response.text,
        sources: response.sources || [],
        toolLogs: response.toolLogs || [],
        generationMode: response.generationMode || 'local',
        warning: response.warning || null
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error("Error generating RAG response:", err);
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: `حدث خطأ أثناء فحص البيانات: ${err.message}. يرجى المحاولة مرة أخرى.`,
        sources: [],
        toolLogs: []
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Helper to render text with clickable citation badges
  const renderFormattedText = (text, sources) => {
    if (!text) return null;
    const parts = text.split('\n');

    return parts.map((paragraph, pIdx) => {
      // Find citations like [المصدر X]
      const citationRegex = /\[المصدر\s*(\d+)\]/g;
      const elements = [];
      let lastIndex = 0;
      let match;

      while ((match = citationRegex.exec(paragraph)) !== null) {
        const textBefore = paragraph.slice(lastIndex, match.index);
        if (textBefore) elements.push(textBefore);

        const citationNum = parseInt(match[1], 10);
        elements.push(
          <button
            key={`cite-${pIdx}-${match.index}`}
            className="inline-citation-tag"
            title={`عرض المصدر المعتمد ${citationNum}`}
            onClick={() => {
              setActiveSourceHighlight(citationNum);
              const element = document.getElementById(`source-card-${citationNum}`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }}
          >
            [{citationNum}]
          </button>
        );
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < paragraph.length) {
        elements.push(paragraph.slice(lastIndex));
      }

      return (
        <p key={pIdx} style={{ margin: paragraph ? '4px 0' : '8px 0' }}>
          {elements}
        </p>
      );
    });
  };

  return (
    <div className="chat-container">
      {/* Chat header */}
      <div className="chat-banner">
        <div className="chat-bot-avatar">
          <Sparkles size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 className="chat-banner-title">مساعد مواصلاتي التوليدي (Grounded RAG)</h3>
            <span className={`ai-mode-pill ${aiMode}`}>
              {aiMode === 'gemini' && apiKey ? 'Gemini 2.5 Flash' : 'توليد محلي موثق'}
            </span>
          </div>
          <p className="chat-banner-sub">
            إجابات من بيانات شبكة القاهرة فقط، مع ذكر المصدر لكل معلومة
          </p>
        </div>

        <button 
          className="chat-settings-btn" 
          title="إعدادات محرك الذكاء الاصطناعي ومفتاح API"
          aria-label="إعدادات المساعد"
          aria-expanded={showSettings}
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings size={17} />
        </button>
      </div>

      {/* Settings Panel Modal / Popover */}
      {showSettings && (
        <div className="chat-settings-card">
          <div className="settings-card-header">
            <span className="settings-card-title">إعدادات محرك التوليد والبحث</span>
            <button className="settings-close-btn" onClick={() => setShowSettings(false)} aria-label="إغلاق الإعدادات">×</button>
          </div>

          <div className="settings-options">
            <label className="settings-option-label">
              <input 
                type="radio" 
                name="aiMode" 
                value="local" 
                checked={aiMode === 'local'} 
                onChange={(e) => setAiMode(e.target.value)}
              />
              <div>
                <strong>توليد محلي فائق الدقة (موصى به - مجاني 100%)</strong>
                <p>توليد إجابات دقيقة ومنع التخمين بالاعتماد الحرفي على أدوات البحث الداخلية.</p>
              </div>
            </label>

            <label className="settings-option-label">
              <input 
                type="radio" 
                name="aiMode" 
                value="gemini" 
                checked={aiMode === 'gemini'} 
                onChange={(e) => setAiMode(e.target.value)}
              />
              <div>
                <strong>Google Gemini API (LLM Mode)</strong>
                <p>توليد سياقي متقدم عبر Gemini 2.5 Flash مقيد بنتائج أداة البحث المعتمدة.</p>
              </div>
            </label>
          </div>

          {aiMode === 'gemini' && (
            <div className="gemini-key-input-group">
              <label htmlFor="gemini-key"><Key size={13} /> مفتاح Google Gemini API Key:</label>
              <input 
                id="gemini-key"
                type="password" 
                placeholder="AIzaSy..." 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
              />
              <span className="key-hint">يتم حفظ المفتاح محلياً في متصفحك فقط ولا يُرسل لأي جهة أخرى.</span>
            </div>
          )}

          <div className="settings-actions">
            <button className="btn-save-settings" onClick={handleSaveSettings}>
              <Check size={14} /> حفظ الإعدادات
            </button>
          </div>
        </div>
      )}

      {/* Suggested prompts carousel */}
      <div className="suggested-queries">
        {SUGGESTED_QUERIES.map((q, idx) => (
          <button 
            key={idx} 
            className="suggested-btn"
            onClick={() => handleSend(q)}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages stream */}
      <div className="messages-stream">
        {messages.map((m) => (
          <div key={m.id} className={`message-bubble-wrapper ${m.sender}`}>
            <div className="sender-avatar">
              {m.sender === 'bot' ? <Bot size={16} /> : <User size={16} />}
            </div>
            
            <div className="message-content">
              {/* Tool Execution Logs (Agentic Tool Inspection) */}
              {m.sender === 'bot' && m.toolLogs && m.toolLogs.length > 0 && (
                <div className="tool-execution-wrap">
                  <button 
                    className="tool-execution-pill"
                    onClick={() => toggleToolLogs(m.id)}
                    aria-expanded={!!expandedTools[m.id]}
                  >
                    <Wrench size={13} className="tool-icon" />
                    <span>تم فحص شبكة النقل: <strong>{m.sources.length} مصادر موثقة</strong></span>
                    {expandedTools[m.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {expandedTools[m.id] && (
                    <div className="tool-logs-details">
                      {m.toolLogs.map((log, lIdx) => (
                        <div key={lIdx} className="tool-log-item">
                          <div className="tool-log-header">
                            <Database size={12} />
                            <span className="tool-name">{log.toolName}</span>
                            <span className="tool-count">{log.resultsCount} نتيجة</span>
                          </div>
                          <span className="tool-label-text">{log.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Zero-Hallucination Guardrail Badge if no verified sources */}
              {m.sender === 'bot' && m.sources && m.sources.length === 0 && m.id !== 1 && (
                <div className="zero-hallucination-banner">
                  <ShieldCheck size={15} />
                  <span>تفعيل بروتوكول منع التخمين (Zero Hallucination Policy)</span>
                </div>
              )}

              {/* Message text with clickable citations */}
              <div className="message-text">
                {renderFormattedText(m.text, m.sources)}
              </div>

              {/* Verified Sources & Citations Section */}
              {m.sources && m.sources.length > 0 && (
                <div className="chat-sources-section">
                  <div className="chat-sources-header">
                    <BookOpen size={14} />
                    <span>المصادر المعتمدة ({m.sources.length}):</span>
                  </div>

                  <div className="chat-sources-grid">
                    {m.sources.map(src => {
                      const isHighlighted = activeSourceHighlight === src.citationIndex;
                      const routeObj = src.routeObj;
                      const color = routeObj ? (VEHICLE_COLORS[routeObj.vehicle] || VEHICLE_COLORS.Default) : 'var(--accent-cyan)';

                      return (
                        <div 
                          key={src.sourceId || src.citationIndex}
                          id={`source-card-${src.citationIndex}`}
                          className={`source-card ${isHighlighted ? 'highlighted' : ''}`}
                          style={{ '--source-color': color }}
                        >
                          <div className="source-card-top">
                            <span className="source-idx-badge">[{src.citationIndex}]</span>
                            <span className="source-card-title">{src.title}</span>
                            {src.vehicle && <span className="source-vehicle-tag">{src.vehicle}</span>}
                          </div>

                          {src.origin && src.dest && (
                            <div className="source-endpoints">
                              <span>{src.origin} ← {src.dest}</span>
                              {src.len_km && <span className="source-km">({src.len_km} كم)</span>}
                            </div>
                          )}

                          {src.via_stops && src.via_stops.length > 0 && (
                            <div className="source-stops-preview">
                              <strong>أبرز المحطات:</strong> {src.via_stops.slice(0, 5).join(' • ')}...
                            </div>
                          )}

                          {src.data && (
                            <div className="source-pricing-preview">
                              بيانات معتمدة من هيئة مترو الأنفاق الرسمية.
                            </div>
                          )}

                          {routeObj && (
                            <button 
                              className="btn-source-map-focus"
                              onClick={() => onSelectRoute(routeObj)}
                            >
                              <Compass size={13} /> عرض المسار على الخريطة
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="message-bubble-wrapper bot">
            <div className="sender-avatar"><Bot size={16} /></div>
            <div className="typing-status-wrapper">
              <div className="typing-dots">
                <span></span><span></span><span></span>
              </div>
              <span className="typing-status-text">
                <Search size={12} className="spin-icon" /> جاري فحص شبكة النقل وقاعدة البيانات...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <div className="chat-input-bar">
        <input
          type="text"
          aria-label="اكتب سؤالك للمساعد"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="اسألني ازاي تروح، أو عن مسار أي خط، أو تذاكر المترو..."
        />
        <button 
          className="send-btn" 
          aria-label="إرسال"
          onClick={() => handleSend()}
          disabled={!inputVal.trim()}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
