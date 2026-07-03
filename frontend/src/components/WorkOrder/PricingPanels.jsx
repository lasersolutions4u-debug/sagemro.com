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

const PRICING_COPY = {
  en: {
    status: {
      draft: 'Draft / Negotiating',
      pending_review: 'SAGEMRO Review',
      submitted: 'Submitted, Awaiting Confirmation',
      confirmed: 'Confirmed',
    },
    priceCheck: {
      reasonable: 'Price is reasonable',
      high: 'Price is on the high side',
      low: 'Price is on the low side',
    },
    engineer: {
      submitted: 'Quote submitted for SAGEMRO review.',
      helper: 'Fill in the fee details as an internal quote proposal. SAGEMRO operations will review it before the customer sees a formal quote.',
      laborFee: 'Labor Fee',
      laborPlaceholder: 'Hours × Rate',
      partsFee: 'Parts Fee',
      partsPlaceholder: 'Total parts cost',
      travelFee: 'Travel Fee',
      travelPlaceholder: 'Transport + Accommodation',
      otherFee: 'Other Fees',
      otherPlaceholder: 'Miscellaneous',
      partsDetail: 'Parts Detail (Optional)',
      partsDetailPlaceholder: 'e.g. Laser lens × 1, unit price 800 CNY',
      quoteSubtotal: 'Quote Subtotal (Customer Pays)',
      internalSettlement: 'Internal Settlement Estimate',
      submitting: 'Submitting...',
      submit: 'Submit for SAGEMRO Review',
    },
    customer: {
      confirmedToast: 'Quote confirmed. SAGEMRO will proceed with service scheduling.',
      negotiationRequired: 'Please enter a reason for negotiation',
      negotiationToast: 'Negotiation initiated. SAGEMRO will review and submit a revised quote.',
      preparingQuote: 'SAGEMRO is preparing a formal quote. You will be notified once diagnosis, scope, and safety requirements are reviewed.',
      serviceFee: 'Service Fee',
      serviceManagementFee: 'SAGEMRO Service Management Fee',
      totalPayable: 'Total Payable',
      confirmQuote: 'Confirm Quote',
      negotiate: 'Negotiate',
      negotiationPlaceholder: 'Please explain your reason for negotiation...',
      counterOfferPlaceholder: 'Your expected price (CNY, optional)',
      cancel: 'Cancel',
      submitting: 'Submitting...',
      confirmNotice: 'After confirmation, SAGEMRO will begin service scheduling.',
      confirming: 'Confirming...',
      quoteConfirmed: 'Quote Confirmed',
      payment: (amount) => `Proceed to Payment (${amount} CNY)`,
    },
  },
  cn: {
    status: {
      draft: '草稿 / 协商中',
      pending_review: 'SAGEMRO 审核',
      submitted: '已提交，待客户确认',
      confirmed: '已确认',
    },
    priceCheck: {
      reasonable: '报价在合理范围内',
      high: '报价偏高',
      low: '报价偏低',
    },
    engineer: {
      submitted: '报价建议已提交，等待 SAGEMRO 审核。',
      helper: '请填写费用明细作为内部报价建议。SAGEMRO 运营审核后，客户才能看到正式报价。',
      laborFee: '人工费',
      laborPlaceholder: '工时 × 单价',
      partsFee: '备件费',
      partsPlaceholder: '备件合计',
      travelFee: '差旅费',
      travelPlaceholder: '交通 + 住宿',
      otherFee: '其他费用',
      otherPlaceholder: '其他必要费用',
      partsDetail: '备件明细（可选）',
      partsDetailPlaceholder: '例如：保护镜 × 1，单价 800 元',
      quoteSubtotal: '报价小计（客户支付）',
      internalSettlement: '内部结算预估',
      submitting: '提交中...',
      submit: '提交 SAGEMRO 审核',
    },
    customer: {
      confirmedToast: '报价已确认。SAGEMRO 将继续推进服务排期。',
      negotiationRequired: '请填写需要协商的原因',
      negotiationToast: '已发起协商。SAGEMRO 将审核并提交调整后的报价。',
      preparingQuote: 'SAGEMRO 正在准备正式报价。诊断方向、服务范围和安全要求审核后会通知你确认。',
      serviceFee: '服务费用',
      serviceManagementFee: 'SAGEMRO 服务管理费',
      totalPayable: '应付合计',
      confirmQuote: '确认报价',
      negotiate: '协商',
      negotiationPlaceholder: '请说明需要协商的原因...',
      counterOfferPlaceholder: '你的期望价格（人民币，可选）',
      cancel: '取消',
      submitting: '提交中...',
      confirmNotice: '确认后，SAGEMRO 将开始推进服务排期。',
      confirming: '确认中...',
      quoteConfirmed: '报价已确认',
      payment: (amount) => `继续支付（${amount} CNY）`,
    },
  },
};

function getPricingCopy() {
  return isCnLocale() ? PRICING_COPY.cn : PRICING_COPY.en;
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

// ========== 核价区（工程师填写） ==========
export function EngineerPricingPanel({ workOrderId, engineerId, onSubmitted, commissionRate = 0.80, engineerLevel = 'junior' }) {
  const t = getPricingCopy();
  const [form, setForm] = useState({ labor_fee: '', parts_fee: '', travel_fee: '', other_fee: '', parts_detail: '' });
  const [submitting, setSubmitting] = useState(false);

  const subtotal = (parseInt(form.labor_fee) || 0) + (parseInt(form.parts_fee) || 0) + (parseInt(form.travel_fee) || 0) + (parseInt(form.other_fee) || 0);
  const internalEstimate = Math.round(subtotal * commissionRate); // Internal legacy estimate; customer-facing quote uses SAGEMRO-reviewed pricing.

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitWorkOrderPricing(workOrderId, {
        labor_fee: parseInt(form.labor_fee) || 0,
        parts_fee: parseInt(form.parts_fee) || 0,
        travel_fee: parseInt(form.travel_fee) || 0,
        other_fee: parseInt(form.other_fee) || 0,
        parts_detail: form.parts_detail,
        engineer_id: engineerId,
      });
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
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">CNY</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--color-text-muted)]">{t.engineer.helper}</div>
      <div className="grid grid-cols-2 gap-3">
        {field('labor_fee', t.engineer.laborFee, t.engineer.laborPlaceholder)}
        {field('parts_fee', t.engineer.partsFee, t.engineer.partsPlaceholder)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('travel_fee', t.engineer.travelFee, t.engineer.travelPlaceholder)}
        {field('other_fee', t.engineer.otherFee, t.engineer.otherPlaceholder)}
      </div>
      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{t.engineer.partsDetail}</label>
        <textarea
          value={form.parts_detail}
          onChange={(e) => setForm({ ...form, parts_detail: e.target.value })}
          placeholder={t.engineer.partsDetailPlaceholder}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
        />
      </div>
      {/* 费用汇总 */}
      <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.laborFee}</span><span>{form.labor_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.partsFee}</span><span>{form.parts_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.travelFee}</span><span>{form.travel_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.otherFee}</span><span>{form.other_fee || 0} CNY</span></div>
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5"><span className="text-[var(--color-text-secondary)]">{t.engineer.quoteSubtotal}</span><span className="font-medium">{subtotal} CNY</span></div>
        <div className="flex justify-between font-semibold text-[var(--color-primary)]">
          <span>{t.engineer.internalSettlement}</span>
          <span>{internalEstimate} CNY</span>
        </div>
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

// ========== 报价确认区（客户查看） ==========
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

      {/* 费用明细 */}
      <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.laborFee}</span><span>{pricing.labor_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.partsFee}</span><span>{pricing.parts_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.travelFee}</span><span>{pricing.travel_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.otherFee}</span><span>{pricing.other_fee || 0} CNY</span></div>
        {pricing.parts_detail && pricing.parts_detail !== '[]' && pricing.parts_detail !== '' && (
          <div className="text-xs text-[var(--color-text-secondary)] pt-1 border-t border-[var(--color-border)]">
            Parts Detail: {(() => { try { return JSON.parse(pricing.parts_detail).map(p => `${p.name || 'Part'} ${p.qty || 1}×${p.unit_price || 0} CNY`).join('; '); } catch { return pricing.parts_detail; } })()}
          </div>
        )}
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5"><span className="text-[var(--color-text-secondary)]">{t.engineer.quoteSubtotal}</span><span className="font-medium">{pricing.subtotal || 0} CNY</span></div>
        {/* Legacy platform fee fields are not exposed as marketplace fees in Service OS. */}
        {pricing.platform_fee > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">{t.customer.serviceFee}</span>
              <span>{(pricing.subtotal || 0) - (pricing.platform_fee || 0)} CNY</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">{t.customer.serviceManagementFee}</span>
              <span>{pricing.platform_fee} CNY</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-semibold text-base text-[var(--color-primary)]">
          <span>{t.customer.totalPayable}</span><span>{pricing.total_amount || pricing.subtotal || 0} CNY</span>
        </div>
      </div>

      {/* AI 审核 */}
      {pricing.status === 'submitted' && <AIPriceCheck check={pricing.ai_price_check} />}

      {/* 操作区 */}
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
            ✓ {t.customer.quoteConfirmed}
          </div>
          <button
            onClick={() => setPaymentOpen(true)}
            className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-semibold text-sm transition-colors"
          >
            {t.customer.payment((pricing.total_amount || pricing.subtotal || 0).toLocaleString())}
          </button>
        </div>
      )}

      {/* 付款弹窗 */}
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
