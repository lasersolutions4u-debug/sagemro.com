import { useState } from 'react';
import { Lightbulb, Send } from 'lucide-react';
import { Modal } from '../common/Modal';
import { createUpsellRequest } from '../../services/api';
import { isCnLocale } from '../../utils/locale';
import {
  buildUpsellPayload,
  UPSELL_BUDGET_SIGNALS,
  UPSELL_CATEGORIES,
  UPSELL_TIMELINES,
} from './upsellRequestModel';

const EMPTY_FORM = {
  category: 'laser_peripheral',
  title: '',
  description: '',
  site_context: '',
  expected_timeline: 'unclear',
  budget_signal: 'unknown',
  contact_name: '',
  contact_phone: '',
};

function label(item, isCn) {
  return isCn ? item.cn : item.en;
}

export function UpsellRequestModal({ isOpen, onClose, context = {}, onSubmitted }) {
  const isCn = isCnLocale();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    const payload = buildUpsellPayload(form, context);
    if (!payload.title || !payload.description) {
      setMessage(isCn ? '请填写需求标题和需求描述。' : 'Please enter a title and description.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createUpsellRequest(payload);
      setForm(EMPTY_FORM);
      onSubmitted?.(result.request);
      onClose?.();
    } catch (error) {
      setMessage((isCn ? '提交失败：' : 'Submit failed: ') + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isCn ? '增购与改造需求' : 'Upsell & Retrofit Need'} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4 text-sm text-[var(--color-text-secondary)]">
          <div className="mb-2 flex items-center gap-2 font-medium text-[var(--color-text-primary)]">
            <Lightbulb size={16} />
            {isCn ? '记录现场发现的配套、改造、配件或易损件需求。' : 'Capture field needs for retrofit, peripheral equipment, parts, or consumables.'}
          </div>
          {context.workOrderNo && (
            <div>{isCn ? '关联工单：' : 'Linked work order: '}{context.workOrderNo}</div>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '需求分类' : 'Category'}</span>
          <select value={form.category} onChange={(e) => update('category', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
            {UPSELL_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{label(item, isCn)}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '需求标题' : 'Title'}</span>
          <input value={form.title} onChange={(e) => update('title', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '客户现场情况' : 'Site context'}</span>
          <textarea value={form.site_context} onChange={(e) => update('site_context', e.target.value)} rows={3} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '需求描述' : 'Description'}</span>
          <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={4} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '预计时间' : 'Timeline'}</span>
            <select value={form.expected_timeline} onChange={(e) => update('expected_timeline', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              {UPSELL_TIMELINES.map((item) => <option key={item.value} value={item.value}>{label(item, isCn)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '预算信号' : 'Budget signal'}</span>
            <select value={form.budget_signal} onChange={(e) => update('budget_signal', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              {UPSELL_BUDGET_SIGNALS.map((item) => <option key={item.value} value={item.value}>{label(item, isCn)}</option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '联系人' : 'Contact'}</span>
            <input value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '联系电话' : 'Phone'}</span>
            <input value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />
          </label>
        </div>

        {message && <div className="text-sm text-red-500">{message}</div>}

        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60">
          <Send size={16} />
          {submitting ? (isCn ? '提交中...' : 'Submitting...') : (isCn ? '提交需求' : 'Submit request')}
        </button>
      </form>
    </Modal>
  );
}
