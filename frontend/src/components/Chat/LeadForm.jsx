import { useEffect, useState } from 'react';
import { X, Send, Loader2, CheckCircle } from 'lucide-react';
import { submitLead } from '../../services/api';
import { isCnLocale } from '../../utils/locale';

const LEAD_COPY = {
  en: {
    title: 'Request SAGEMRO Follow-up',
    submitted: 'Submitted successfully.',
    submittedDesc: 'The SAGEMRO team will review your request and contact you shortly.',
    close: 'Close',
    intro: 'Leave your contact info and SAGEMRO will review your AI intake, service need, spare parts request, or machine selection project, then guide the next step.',
    name: 'Name *',
    namePlaceholder: 'Your name',
    email: 'Email',
    emailPlaceholder: 'your@email.com',
    phone: 'Phone',
    phonePlaceholder: 'Phone (email or phone required)',
    message: 'Message (optional)',
    messagePlaceholder: 'Briefly describe your equipment needs...',
    submit: 'Submit',
    submitting: 'Submitting...',
    error: 'Submission failed, please try again',
  },
  cn: {
    title: '请求 SAGEMRO 跟进',
    submitted: '已提交成功。',
    submittedDesc: 'SAGEMRO 团队会审核你的需求，并尽快与你联系。',
    close: '关闭',
    intro: '留下联系方式后，SAGEMRO 会结合你的 AI 咨询、服务需求、备件需求或新机项目，确认更合适的下一步。',
    name: '姓名 *',
    namePlaceholder: '请输入姓名',
    email: '邮箱',
    emailPlaceholder: '可选',
    phone: '手机 / 电话',
    phonePlaceholder: '邮箱或电话至少填写一项',
    message: '需求说明（可选）',
    messagePlaceholder: '可以简单说明设备情况、问题或需要支持的事项',
    submit: '提交',
    submitting: '提交中...',
    error: '提交失败，请稍后重试',
  },
};

export function LeadForm({ isOpen, onClose, conversationId, interest, source = 'chat', initialMessage = '' }) {
  const copy = isCnLocale() ? LEAD_COPY.cn : LEAD_COPY.en;
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isOpen && initialMessage) {
      setForm((prev) => ({ ...prev, message: prev.message || initialMessage }));
    }
  }, [isOpen, initialMessage]);

  if (!isOpen) return null;

  const canSubmit = form.name.trim() && (form.email.trim() || form.phone.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await submitLead({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        interest: interest || undefined,
        message: form.message || undefined,
        conversation_id: conversationId || undefined,
        source,
      });
      setDone(true);
    } catch (err) {
      setError(err.message || copy.error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm({ name: '', email: '', phone: '', message: '' });
    setError('');
    setDone(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="bg-[var(--color-surface)] rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-medium text-[var(--color-text-primary)]">{copy.title}</h3>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-text-muted)]">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-[var(--color-text-primary)] font-medium mb-1">{copy.submitted}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">{copy.submittedDesc}</p>
            <button
              onClick={handleClose}
              className="mt-4 px-6 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl text-sm transition-colors"
            >
              {copy.close}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {copy.intro}
            </p>

            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.name}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={copy.namePlaceholder}
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.email}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={copy.emailPlaceholder}
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.phone}</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={copy.phonePlaceholder}
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.message}</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder={copy.messagePlaceholder}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> {copy.submitting}</>
              ) : (
                <><Send size={16} /> {copy.submit}</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
