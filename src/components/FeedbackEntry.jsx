import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { sendFeedback } from '../utils/feedbackClient';

export default function FeedbackEntry({ lang = 'ar', className = '', kind = 'feedback', title }) {
  const isArabic = lang === 'ar';
  const [open, setOpen] = useState(() => kind === 'feedback' && typeof window !== 'undefined' && window.location.hash === '#feedback');
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const label = title || (isArabic ? 'إرسال ملاحظة' : 'Send feedback');
  async function submit(event) {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      if (file && file.size > 400000) { setStatus('fileTooLarge'); return; }
      await sendFeedback({ kind, message, ...(replyTo.trim() ? { replyTo: replyTo.trim() } : {}),
        ...(file ? { file: { name: file.name, content: await file.text() } } : {}) });
      setStatus('sent'); setMessage('');
    } catch { setStatus('error'); }
  }
  return (
    <section id={kind === 'feedback' ? 'feedback' : undefined} className={`feedback-entry ${className}`.trim()} aria-label={isArabic ? 'أرسل ملاحظة' : 'Send feedback'}>
      <button type="button" className="feedback-entry-action" aria-expanded={open} onClick={() => setOpen(!open)}>
        <MessageCircle size={18} aria-hidden="true" />
        <span>{label}</span>
      </button>
      <p className="feedback-entry-note">
        {isArabic ? 'أرسل رسالتك مباشرة لإدارة مواصلاتي. لا تُنشر في المجتمع.' : 'Send a private message to Mowaslaty. It will not be posted to the community.'}
      </p>
      {open && <form className="feedback-form" onSubmit={submit}>
        <label>{isArabic ? 'رسالتك' : 'Your message'}<textarea required maxLength={5000} value={message} onChange={event => setMessage(event.target.value)} /></label>
        <label>{isArabic ? 'بريدك للرد (اختياري)' : 'Your email for a reply (optional)'}<input type="email" maxLength={254} value={replyTo} onChange={event => setReplyTo(event.target.value)} /></label>
        {kind === 'route' && <label>ملف GPX أو KML أو GeoJSON (حتى ٤٠٠ كيلوبايت)<input type="file" accept=".gpx,.kml,.geojson,.json" onChange={event => setFile(event.target.files?.[0] || null)} /></label>}
        <button className="feedback-entry-action" disabled={status === 'sending'} type="submit">{status === 'sending' ? (isArabic ? 'جارٍ الإرسال…' : 'Sending…') : (isArabic ? 'إرسال' : 'Send')}</button>
        <p role="status" aria-live="polite">{status === 'sent' ? (isArabic ? 'تم إرسال رسالتك.' : 'Your message was sent.')
          : status === 'error' ? (isArabic ? 'تعذر الإرسال. لم يتم تأكيد التسليم؛ حاول لاحقًا.' : 'Delivery was not confirmed. Please try again later.')
            : status === 'fileTooLarge' ? 'الملف أكبر من ٤٠٠ كيلوبايت؛ صدّر جزءًا أقصر من المسار.' : ''}</p>
      </form>}
    </section>
  );
}
