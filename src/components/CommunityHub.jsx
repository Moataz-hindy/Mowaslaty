import React, { useState, useEffect } from 'react';
import { 
  Users, 
  PlusCircle, 
  ThumbsUp, 
  AlertTriangle, 
  DollarSign, 
  Clock, 
  Lightbulb, 
  Filter, 
  X, 
  CheckCircle 
} from 'lucide-react';

const INITIAL_REPORTS = [
  {
    id: 1,
    line: "305",
    author: "أحمد حسام (شبرا)",
    category: "fare",
    timeAgo: "منذ ساعتين",
    text: "أجرة ميني باص 305 بقت 10 جنيه رسمياً من دوران شبرا لمساكن شيراتون، والتكييف شغال في الأتوبيسات الجديدة.",
    upvotes: 28,
    userUpvoted: false
  },
  {
    id: 2,
    line: "204",
    author: "محمود الصاوي",
    category: "detour",
    timeAgo: "منذ 4 ساعات",
    text: "تنبيه: خط 204 بيلف حالياً من تحت كوبري مسطرد بسبب أعمال التوسعة ومبيقفش عند سلم الخصوص القديم.",
    upvotes: 45,
    userUpvoted: false
  },
  {
    id: 3,
    line: "112",
    author: "سارة إبراهيم",
    category: "frequency",
    timeAgo: "أمس",
    text: "ميني باص 112 من أبو الريش لشيراتون منتظم جداً الصبح (بيطلع واحد كل 15 دقيقة تقريباً من موقف أبو الريش).",
    upvotes: 19,
    userUpvoted: false
  },
  {
    id: 4,
    line: "1005",
    author: "عمرو كمال",
    category: "tip",
    timeAgo: "منذ يومين",
    text: "لو رايح التجمع من رمسيس، خط 1005 أسرع بكتير من الميكروباص في وقت الذروة لأن له مسار على محور المشير.",
    upvotes: 34,
    userUpvoted: false
  }
];

export default function CommunityHub({ routes, onSelectRoute }) {
  const [reports, setReports] = useState(() => {
    const saved = localStorage.getItem('mowaslaty_community_reports');
    return saved ? JSON.parse(saved) : INITIAL_REPORTS;
  });

  const [activeCategory, setActiveCategory] = useState('ALL');
  const [lineFilter, setLineFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [newLine, setNewLine] = useState('305');
  const [newCategory, setNewCategory] = useState('fare');
  const [newText, setNewText] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [successToast, setSuccessToast] = useState(false);

  useEffect(() => {
    localStorage.setItem('mowaslaty_community_reports', JSON.stringify(reports));
  }, [reports]);

  // Handle Upvote
  const handleUpvote = (id) => {
    setReports(prev => prev.map(rep => {
      if (rep.id === id) {
        const userUpvoted = !rep.userUpvoted;
        return {
          ...rep,
          userUpvoted,
          upvotes: userUpvoted ? rep.upvotes + 1 : rep.upvotes - 1
        };
      }
      return rep;
    }));
  };

  // Submit New Report
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newText.trim()) return;

    const newReport = {
      id: Date.now(),
      line: newLine,
      author: newAuthor.trim() || "راكب مواصلاتي",
      category: newCategory,
      timeAgo: "الآن",
      text: newText.trim(),
      upvotes: 1,
      userUpvoted: true
    };

    setReports([newReport, ...reports]);
    setNewText('');
    setNewAuthor('');
    setShowAddModal(false);
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 3000);
  };

  // Filter Reports
  const filteredReports = reports.filter(r => {
    if (activeCategory !== 'ALL' && r.category !== activeCategory) return false;
    if (lineFilter && !r.line.includes(lineFilter.trim())) return false;
    return true;
  });

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'fare':
        return { label: 'تحديث أجرة', icon: <DollarSign size={12} />, className: 'fare-badge' };
      case 'detour':
        return { label: 'تعديل مسار / تحويلة', icon: <AlertTriangle size={12} />, className: 'detour-badge' };
      case 'frequency':
        return { label: 'مواعيد وزحمة', icon: <Clock size={12} />, className: 'freq-badge' };
      case 'tip':
      default:
        return { label: 'نصيحة مسافر', icon: <Lightbulb size={12} />, className: 'tip-badge' };
    }
  };

  return (
    <div className="community-container">
      {/* Banner */}
      <div className="community-banner">
        <div className="banner-icon community-icon">
          <Users size={22} />
        </div>
        <div>
          <h3 className="banner-title">مجتمع ركاب القاهرة</h3>
          <p className="banner-sub">شارك تحديثات الخطوط، الأجرة، والتحويلات مع الركاب الآخرين لحظياً</p>
        </div>
      </div>

      {/* Add Report Action Button */}
      <button className="btn-add-report" onClick={() => setShowAddModal(true)}>
        <PlusCircle size={16} />
        <span>شارك تحديث أو بلاغ عن خط</span>
      </button>

      {successToast && (
        <div className="success-toast">
          <CheckCircle size={16} />
          <span>تم نشر تقريرك بنجاح وشكراً لمساعدة الركاب!</span>
        </div>
      )}

      {/* Filter Chips */}
      <div className="filter-chips">
        {[
          { id: 'ALL', label: 'كل التحديثات' },
          { id: 'fare', label: 'الأجرة' },
          { id: 'detour', label: 'تحويلات' },
          { id: 'frequency', label: 'المواعيد' },
          { id: 'tip', label: 'نصائح' }
        ].map(cat => (
          <button
            key={cat.id}
            type="button"
            aria-pressed={activeCategory === cat.id}
            className={`chip ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Line search filter */}
      <div className="community-line-filter">
        <input 
          type="text" 
          aria-label="تصفية برقم الخط"
          placeholder="تصفية برقم الخط (مثلاً 305, 204)..."
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
        />
        {lineFilter && (
          <button type="button" onClick={() => setLineFilter('')} aria-label="مسح التصفية"><X size={14} /></button>
        )}
      </div>

      {/* Reports Feed */}
      <div className="reports-feed">
        {filteredReports.length === 0 ? (
          <div className="empty-state">
            <p>لا توجد بلاغات مسجلة تطابق التصفية الحالية</p>
          </div>
        ) : (
          filteredReports.map(rep => {
            const badge = getCategoryBadge(rep.category);
            return (
              <div key={rep.id} className="report-card">
                <div className="report-header">
                  <div className="badge-group">
                    <button
                      type="button"
                      className="route-num-badge"
                      style={{ cursor: 'pointer', border: '1px solid var(--border-strong)', fontFamily: 'inherit' }}
                      title="اضغط لعرض الخط"
                      onClick={() => {
                        const matched = routes.find(r => r.num === rep.line);
                        if (matched) onSelectRoute(matched);
                      }}
                    >
                      خط {rep.line}
                    </button>
                    <span className={`category-tag ${badge.className}`}>
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                  </div>
                  <span className="report-time">{rep.timeAgo}</span>
                </div>

                <p className="report-text">{rep.text}</p>

                <div className="report-footer">
                  <span className="report-author">بواسطة: {rep.author}</span>
                  <button 
                    type="button"
                    aria-pressed={rep.userUpvoted}
                    className={`btn-upvote ${rep.userUpvoted ? 'voted' : ''}`}
                    onClick={() => handleUpvote(rep.id)}
                  >
                    <ThumbsUp size={13} />
                    <span>مفيد ({rep.upvotes})</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal to Add Report */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="report-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="report-modal-title">إضافة تحديث لمجتمع الركاب</h3>
              <button type="button" className="icon-btn-close" onClick={() => setShowAddModal(false)} aria-label="إغلاق">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="rep-line">رقم الخط:</label>
                <input 
                  id="rep-line"
                  type="text" 
                  value={newLine} 
                  onChange={(e) => setNewLine(e.target.value)} 
                  placeholder="مثال: 305, 204, 112..."
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="rep-cat">نوع التحديث:</label>
                <select id="rep-cat" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                  <option value="fare">تحديث أجرة (زيادة / ثبات)</option>
                  <option value="detour">تعديل مسار أو تحويلة طريق</option>
                  <option value="frequency">مواعيد التردد والزحمة</option>
                  <option value="tip">نصيحة عامة للركاب</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rep-author">اسمك (اختياري):</label>
                <input 
                  id="rep-author"
                  type="text" 
                  value={newAuthor} 
                  onChange={(e) => setNewAuthor(e.target.value)} 
                  placeholder="مثال: أحمد من شبرا"
                />
              </div>

              <div className="form-group">
                <label htmlFor="rep-text">نص البلاغ أو التحديث:</label>
                <textarea 
                  id="rep-text"
                  rows={3} 
                  value={newText} 
                  onChange={(e) => setNewText(e.target.value)} 
                  placeholder="اكتب تفاصيل التحديث بوضوح لمساعدة زملائك الركاب..."
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-primary-outline" onClick={() => setShowAddModal(false)}>
                  إلغاء
                </button>
                <button type="submit" className="btn-primary">
                  نشر التقرير للجميع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
