import { useEffect, useState } from 'react';
import { X, Send, Loader2, CheckCircle } from 'lucide-react';
import { submitLead } from '../../services/api';
import { getCurrentUiText } from '../../i18n/uiText';

export function LeadForm({ isOpen, onClose, conversationId, interest, source = 'chat', initialMessage = '' }) {
  const t = getCurrentUiText().leadForm;
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
      setError(err.message || t.failed);
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
          <h3 className="text-base font-medium text-[var(--color-text-primary)]">{t.title}</h3>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-text-muted)]">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-[var(--color-text-primary)] font-medium mb-1">{t.success}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">{t.successBody}</p>
            <button
              onClick={handleClose}
              className="mt-4 px-6 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl text-sm transition-colors"
            >
              {t.close}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t.intro}
            </p>

            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{t.name}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.namePlaceholder}
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{t.email}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t.emailPlaceholder}
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{t.phone}</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={t.phonePlaceholder}
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{t.message}</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder={t.messagePlaceholder}
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
                <><Loader2 size={16} className="animate-spin" /> {t.submitting}</>
              ) : (
                <><Send size={16} /> {t.submit}</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
