import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import {
  getWorkOrderPricing,
  submitWorkOrderPricing,
  confirmWorkOrderPricing,
  rejectWorkOrderPricing,
} from '../../services/api';
import { PaymentModal } from '../Payment/PaymentModal';
import { toastSuccess, toastError, toastWarning } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';
import { MaterialPicker } from './MaterialPicker';
import {
  createEngineerPricingDraft,
  createEngineerPricingDraftFromPricing,
  getEngineerPricingTotals,
} from './pricingDraft';

const CURRENCY = 'USD';

const PRICING_COPY = {
  en: {
    status: {
      draft: 'Draft / Negotiating',
      pending_review: 'Operations Review',
      submitted: 'Submitted, Awaiting Confirmation',
      confirmed: 'Confirmed',
    },
    priceCheck: {
      reasonable: 'According to SAGEMRO AI market research, this price is within a reasonable range.',
      high: 'Price is on the high side',
      low: 'Price is on the low side',
    },
    engineer: {
      submitted: 'Quote submitted for operations review.',
      helper: 'Fill in the fee details as an internal quote proposal. The operations team will review scope, fees, and safety requirements before the customer sees a formal quote.',
      laborFee: 'Labor Fee',
      laborPlaceholder: 'Hours x Rate',
      partsFee: 'Parts Fee',
      partsPlaceholder: 'Total parts cost',
      travelFee: 'Travel Fee',
      travelPlaceholder: 'Transport + Accommodation',
      otherFee: 'Other Fees',
      otherPlaceholder: 'Miscellaneous',
      partsDetail: 'Other Fee Note (Optional)',
      partsDetailPlaceholder: 'e.g. special access, weekend support, crane, overtime',
      quoteSubtotal: 'Quote Subtotal Price',
      submitting: 'Submitting...',
      submit: 'Submit for Operations Review',
    },
    customer: {
      confirmedToast: 'Quote confirmed. Please choose a payment method so SAGEMRO can send instructions.',
      negotiationRequired: 'Please enter a reason for negotiation',
      negotiationToast: 'Negotiation initiated. Operations will review and submit a revised quote.',
      preparingQuote: 'SAGEMRO is preparing a formal quote. You will be notified after diagnosis, scope, and safety requirements are reviewed.',
      totalPayable: 'Quote Subtotal Price',
      confirmQuote: 'Confirm Quote',
      negotiate: 'Negotiate',
      negotiationPlaceholder: 'Please explain your reason for negotiation...',
      counterOfferPlaceholder: 'Your expected price (USD, optional)',
      cancel: 'Cancel',
      submitting: 'Submitting...',
      confirmNotice: 'After confirmation, please choose a payment method. The engineer follows up collection and Admin approves service start after receipt.',
      confirming: 'Confirming...',
      quoteConfirmed: 'Quote Confirmed',
      payment: (amount) => `Request Payment Instructions (${amount} USD)`,
    },
  },
  get cn() {
    return this.en;
  },
};

function getPricingCopy() {
  return isCnLocale() ? PRICING_COPY.cn : PRICING_COPY.en;
}

function readEngineerPricingDraft(workOrderId, pricing) {
  const fallbackDraft = pricing ? createEngineerPricingDraftFromPricing(pricing) : createEngineerPricingDraft();
  if (typeof window === 'undefined') return fallbackDraft;
  try {
    const saved = window.sessionStorage.getItem(`sagemro_quote_draft:${workOrderId}`);
    return saved ? createEngineerPricingDraft(JSON.parse(saved)) : fallbackDraft;
  } catch {
    return fallbackDraft;
  }
}

function writeEngineerPricingDraft(workOrderId, draft) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`sagemro_quote_draft:${workOrderId}`, JSON.stringify(draft));
  } catch {
    // Storage can fail in private mode; the in-memory form remains usable.
  }
}

function clearEngineerPricingDraft(workOrderId) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(`sagemro_quote_draft:${workOrderId}`);
  } catch {
    // Ignore storage failures.
  }
}

function formatQuoteNote(value) {
  if (!value || value === '[]') return '';
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => item.note || item.description || item.name || '')
        .filter(Boolean)
        .join('; ');
    }
    return parsed.note || parsed.description || '';
  } catch {
    return value;
  }
}

export function PricingStatusBadge({ status }) {
  const t = getPricingCopy();
  const map = {
    draft: { text: t.status.draft, color: 'bg-gray-500', bg: 'bg-gray-500/10' },
    pending_review: { text: t.status.pending_review, color: 'bg-amber-500', bg: 'bg-amber-500/10' },
    submitted: { text: t.status.submitted, color: 'bg-purple-500', bg: 'bg-purple-500/10' },
    confirmed: { text: t.status.confirmed, color: 'bg-green-500', bg: 'bg-green-500/10' },
  };
  const c = map[status] || map.draft;
  return (
    <span className={`px-2 py-0.5 text-xs text-white rounded ${c.color}`}>{c.text}</span>
  );
}

export function AIPriceCheck({ check }) {
  if (!check) return null;
  const t = getPricingCopy();
  let data;
  try { data = typeof check === 'string' ? JSON.parse(check) : check; } catch { return null; }
  const map = {
    reasonable: { text: t.priceCheck.reasonable, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
    high: { text: t.priceCheck.high, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    low: { text: t.priceCheck.low, icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  };
  const c = map[data.status] || map.reasonable;
  const Icon = c.icon;
  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg ${c.bg} ${c.color}`}>
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <div className="text-xs">
        <div className="font-medium">{c.text}</div>
        {data.reason && <div className="opacity-80">{data.reason}</div>}
      </div>
    </div>
  );
}

// ========== 閺嶉晲鐜崠鐚寸礄瀹搞儳鈻肩敮鍫濓綖閸愭瑱绱?==========
export function EngineerPricingPanel({ workOrderId, engineerId, pricing, onSubmitted }) {
  const t = getPricingCopy();
  const initialDraft = readEngineerPricingDraft(workOrderId, pricing);
  const [form, setForm] = useState(initialDraft.form);
  const [materialItems, setMaterialItems] = useState(initialDraft.materialItems);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    writeEngineerPricingDraft(workOrderId, { form, materialItems });
  }, [form, materialItems, workOrderId]);

  useEffect(() => {
    const saved = typeof window !== 'undefined'
      ? window.sessionStorage.getItem(`sagemro_quote_draft:${workOrderId}`)
      : null;
    if (!saved && pricing?.status === 'draft') {
      const draft = createEngineerPricingDraftFromPricing(pricing);
      setForm(draft.form);
      setMaterialItems(draft.materialItems);
    }
  }, [pricing, workOrderId]);

  const { partsFee, subtotal } = getEngineerPricingTotals({
    form,
    materialItems,
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitWorkOrderPricing(workOrderId, {
        labor_fee: parseInt(form.labor_fee) || 0,
        parts_fee: partsFee,
        travel_fee: parseInt(form.travel_fee) || 0,
        other_fee: parseInt(form.other_fee) || 0,
        parts_detail: form.other_fee_note,
        material_items: materialItems,
        engineer_id: engineerId,
      });
      clearEngineerPricingDraft(workOrderId);
      toastSuccess(t.engineer.submitted);
      onSubmitted?.();
    } catch (e) {
      toastError('Submission failed: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key, label, placeholder) => (
    <div>
      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">{CURRENCY}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--color-text-muted)]">{t.engineer.helper}</div>
      <div className="grid grid-cols-2 gap-3">
        {field('labor_fee', t.engineer.laborFee, t.engineer.laborPlaceholder)}
        {materialItems.length > 0 ? (
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{t.engineer.partsFee}</label>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
              {partsFee} {CURRENCY}
            </div>
          </div>
        ) : field('parts_fee', t.engineer.partsFee, t.engineer.partsPlaceholder)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('travel_fee', t.engineer.travelFee, t.engineer.travelPlaceholder)}
        {field('other_fee', t.engineer.otherFee, t.engineer.otherPlaceholder)}
      </div>
      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{t.engineer.partsDetail}</label>
        <textarea
          value={form.other_fee_note}
          onChange={(e) => setForm({ ...form, other_fee_note: e.target.value })}
          placeholder={t.engineer.partsDetailPlaceholder}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
        />
      </div>
      <MaterialPicker purpose="quote" workOrderId={workOrderId} items={materialItems} onChange={setMaterialItems} />
      {/* 鐠愬湱鏁ゅЧ鍥ㄢ偓?*/}
      <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.laborFee}</span><span>{form.labor_fee || 0} {CURRENCY}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.partsFee}</span><span>{partsFee} {CURRENCY}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.travelFee}</span><span>{form.travel_fee || 0} {CURRENCY}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.otherFee}</span><span>{form.other_fee || 0} {CURRENCY}</span></div>
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5 font-semibold text-[var(--color-primary)]"><span>{t.engineer.quoteSubtotal}</span><span>{subtotal} {CURRENCY}</span></div>
      </div>
      <button
        data-testid="submit-pricing-button"
        onClick={handleSubmit}
        disabled={submitting || subtotal === 0}
        className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-medium"
      >
        {submitting ? t.engineer.submitting : t.engineer.submit}
      </button>
    </div>
  );
}

// ========== 閹躲儰鐜涵顔款吇閸栫尨绱欑€广垺鍩涢弻銉ф箙閿?==========
export function CustomerPricingPanel({ workOrderId, customerId, onConfirmed }) {
  const t = getPricingCopy();
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null); // 'confirm' | 'reject'
  const [rejectReason, setRejectReason] = useState('');
  const [counterOffer, setCounterOffer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getWorkOrderPricing(workOrderId).then(d => {
      setPricing(d.pricing);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [workOrderId]);

  useEffect(() => { load(); }, [load]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await confirmWorkOrderPricing(workOrderId, customerId);
      toastSuccess(t.customer.confirmedToast);
      onConfirmed?.();
      load();
    } catch (e) {
      toastError('Confirmation failed: ' + e.message);
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toastWarning(t.customer.negotiationRequired); return; }
    setSubmitting(true);
    try {
      await rejectWorkOrderPricing(workOrderId, customerId, rejectReason, counterOffer ? parseInt(counterOffer) : null);
      toastSuccess(t.customer.negotiationToast);
      onConfirmed?.();
      load();
    } catch (e) {
      toastError('Operation failed: ' + e.message);
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  if (loading) return <div className="text-center py-4 text-sm text-[var(--color-text-muted)]">Loading...</div>;

  if (!pricing) {
    return (
      <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4 text-center text-sm text-[var(--color-text-muted)]">
        {t.customer.preparingQuote}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PricingStatusBadge status={pricing.status} />
      </div>

      {/* 鐠愬湱鏁ら弰搴ｇ矎 */}
      <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.laborFee}</span><span>{pricing.labor_fee || 0} {CURRENCY}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.partsFee}</span><span>{pricing.parts_fee || 0} {CURRENCY}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.travelFee}</span><span>{pricing.travel_fee || 0} {CURRENCY}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.otherFee}</span><span>{pricing.other_fee || 0} {CURRENCY}</span></div>
        {formatQuoteNote(pricing.parts_detail) && (
          <div className="text-xs text-[var(--color-text-secondary)] pt-1 border-t border-[var(--color-border)]">
            Other Fee Note: {formatQuoteNote(pricing.parts_detail)}
          </div>
        )}
        {pricing.material_items?.length > 0 && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <div className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">{isCnLocale() ? '闁板秳娆㈠〒鍛礋' : 'Parts List'}</div>
            <MaterialPicker items={pricing.material_items} readonly />
          </div>
        )}
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5 font-semibold text-base text-[var(--color-primary)]">
          <span>{t.engineer.quoteSubtotal}</span><span>{pricing.total_amount || pricing.subtotal || 0} {CURRENCY}</span>
        </div>
      </div>

      {/* AI 鐎光剝鐗?*/}
      {pricing.status === 'submitted' && <AIPriceCheck check={pricing.ai_price_check} />}

      {/* 閹垮秳缍旈崠?*/}
      {pricing.status === 'submitted' && action !== 'reject' && (
        <div className="flex gap-2">
          <button
            onClick={() => setAction('confirm')}
            className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium"
          >
            {t.customer.confirmQuote}
          </button>
          <button
            onClick={() => setAction('reject')}
            className="flex-1 py-2.5 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl font-medium"
          >
            {t.customer.negotiate}
          </button>
        </div>
      )}

      {action === 'reject' && (
        <div className="space-y-2 p-3 bg-[var(--color-surface-elevated)] rounded-xl">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t.customer.negotiationPlaceholder}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
          <input
            type="number"
            value={counterOffer}
            onChange={(e) => setCounterOffer(e.target.value)}
            data-testid="counter-offer-input"
            placeholder={t.customer.counterOfferPlaceholder}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <div className="flex gap-2">
            <button onClick={() => setAction(null)} className="flex-1 py-2 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl text-sm">{t.customer.cancel}</button>
            <button data-testid="reject-pricing-button" onClick={handleReject} disabled={submitting} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm">
              {submitting ? t.customer.submitting : t.customer.negotiate}
            </button>
          </div>
        </div>
      )}

      {action === 'confirm' && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl space-y-2">
          <div className="text-sm text-[var(--color-text-primary)]">{t.customer.confirmNotice}</div>
          <div className="flex gap-2">
            <button onClick={() => setAction(null)} className="flex-1 py-2 bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] rounded-xl text-sm">{t.customer.cancel}</button>
            <button data-testid="confirm-pricing-button" onClick={handleConfirm} disabled={submitting} className="flex-1 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm">
              {submitting ? t.customer.confirming : t.customer.confirmQuote}
            </button>
          </div>
        </div>
      )}

      {pricing.status === 'confirmed' && (
        <div className="space-y-3">
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-center text-sm text-green-500">
            閴?{t.customer.quoteConfirmed}
          </div>
          <button
            onClick={() => setPaymentOpen(true)}
            className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-semibold text-sm transition-colors"
          >
            {t.customer.payment((pricing.total_amount || pricing.subtotal || 0).toLocaleString())}
          </button>
        </div>
      )}

      {/* 娴犳ɑ顑欏鍦崶 */}
      <PaymentModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        workOrderId={workOrderId}
        customerId={customerId}
        onPaid={() => { setPaymentOpen(false); onConfirmed?.(); load(); }}
      />
    </div>
  );
}
