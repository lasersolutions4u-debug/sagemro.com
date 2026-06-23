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

const COPY = {
  cn: {
    pricingStatus: {
      draft: '草稿 / 协商中',
      pending_review: 'SAGEMRO 审核中',
      submitted: '已提交，待确认',
      confirmed: '已确认',
    },
    priceCheck: {
      reasonable: '价格合理',
      high: '价格偏高',
      low: '价格偏低',
    },
    quoteSubmitted: '报价已提交，等待 SAGEMRO 官方审核。',
    submitFailed: '提交失败',
    engineerIntro: '请填写内部报价建议。SAGEMRO 运营团队审核后，客户才会看到官方报价。',
    laborFee: '人工费',
    partsFee: '备件费',
    travelFee: '差旅费',
    otherFees: '其他费用',
    laborPlaceholder: '工时 × 费率',
    partsPlaceholder: '备件总费用',
    travelPlaceholder: '交通 + 住宿',
    otherPlaceholder: '其他杂费',
    partsDetail: '备件明细（可选）',
    partsDetailPlaceholder: '例如：保护镜片 × 1，单价 800 元',
    quoteSubtotal: '报价小计（客户支付）',
    internalSettlement: '内部结算预估',
    submitting: '正在提交...',
    submitForReview: '提交给 SAGEMRO 审核',
    quoteConfirmed: '报价已确认，SAGEMRO 将继续安排服务。',
    confirmFailed: '确认失败',
    negotiationReasonRequired: '请输入协商原因',
    negotiationStarted: '已发起协商，SAGEMRO 会审核并提交修订报价。',
    operationFailed: '操作失败',
    loading: '加载中...',
    preparingQuote: 'SAGEMRO 正在准备官方报价。诊断、范围和安全要求审核后，你会收到通知。',
    partsDetailLabel: '备件明细',
    part: '备件',
    quoteSubtotalLabel: '报价小计',
    serviceFee: '服务费用',
    serviceManagementFee: 'SAGEMRO 服务管理费',
    totalPayable: '应付总额',
    confirmQuote: '确认报价',
    negotiate: '协商',
    negotiatePlaceholder: '请说明需要协商的原因...',
    counterOfferPlaceholder: '你的期望价格（元，可选）',
    cancel: '取消',
    afterConfirm: '确认后，SAGEMRO 将开始安排服务。',
    confirming: '确认中...',
    quoteConfirmedBadge: '✓ 报价已确认',
    proceedPayment: (amount) => `继续付款（${amount.toLocaleString()} CNY）`,
  },
  en: {
    pricingStatus: {
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
    quoteSubmitted: 'Quote submitted for SAGEMRO official review.',
    submitFailed: 'Submission failed',
    engineerIntro: 'Fill in the fee details as an internal quote proposal. SAGEMRO operations will review it before the customer sees an official quote.',
    laborFee: 'Labor Fee',
    partsFee: 'Parts Fee',
    travelFee: 'Travel Fee',
    otherFees: 'Other Fees',
    laborPlaceholder: 'Hours × Rate',
    partsPlaceholder: 'Total parts cost',
    travelPlaceholder: 'Transport + Accommodation',
    otherPlaceholder: 'Miscellaneous',
    partsDetail: 'Parts Detail (Optional)',
    partsDetailPlaceholder: 'e.g. Laser lens × 1, unit price 800 CNY',
    quoteSubtotal: 'Quote Subtotal (Customer Pays)',
    internalSettlement: 'Internal Settlement Estimate',
    submitting: 'Submitting...',
    submitForReview: 'Submit for SAGEMRO Review',
    quoteConfirmed: 'Quote confirmed. SAGEMRO will proceed with service scheduling.',
    confirmFailed: 'Confirmation failed',
    negotiationReasonRequired: 'Please enter a reason for negotiation',
    negotiationStarted: 'Negotiation initiated. SAGEMRO will review and submit a revised quote.',
    operationFailed: 'Operation failed',
    loading: 'Loading...',
    preparingQuote: 'SAGEMRO is preparing the official quote. You will be notified once diagnosis, scope, and safety requirements are reviewed.',
    partsDetailLabel: 'Parts Detail',
    part: 'Part',
    quoteSubtotalLabel: 'Quote Subtotal',
    serviceFee: 'Service Fee',
    serviceManagementFee: 'SAGEMRO Service Management Fee',
    totalPayable: 'Total Payable',
    confirmQuote: 'Confirm Quote',
    negotiate: 'Negotiate',
    negotiatePlaceholder: 'Please explain your reason for negotiation...',
    counterOfferPlaceholder: 'Your expected price (CNY, optional)',
    cancel: 'Cancel',
    afterConfirm: 'After confirmation, SAGEMRO will begin service scheduling.',
    confirming: 'Confirming...',
    quoteConfirmedBadge: '✓ Quote Confirmed',
    proceedPayment: (amount) => `Proceed to Payment (${amount.toLocaleString()} CNY)`,
  },
};

function getCopy() {
  return isCnLocale() ? COPY.cn : COPY.en;
}

export function PricingStatusBadge({ status }) {
  const copy = getCopy();
  const map = {
    draft: { text: copy.pricingStatus.draft, color: 'bg-gray-500', bg: 'bg-gray-500/10' },
    pending_review: { text: copy.pricingStatus.pending_review, color: 'bg-amber-500', bg: 'bg-amber-500/10' },
    submitted: { text: copy.pricingStatus.submitted, color: 'bg-purple-500', bg: 'bg-purple-500/10' },
    confirmed: { text: copy.pricingStatus.confirmed, color: 'bg-green-500', bg: 'bg-green-500/10' },
  };
  const c = map[status] || map.draft;
  return (
    <span className={`px-2 py-0.5 text-xs text-white rounded ${c.color}`}>{c.text}</span>
  );
}

export function AIPriceCheck({ check }) {
  const copy = getCopy();
  if (!check) return null;
  let data;
  try { data = typeof check === 'string' ? JSON.parse(check) : check; } catch { return null; }
  const map = {
    reasonable: { text: copy.priceCheck.reasonable, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
    high: { text: copy.priceCheck.high, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    low: { text: copy.priceCheck.low, icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
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
  const copy = getCopy();
  const [form, setForm] = useState({ labor_fee: '', parts_fee: '', travel_fee: '', other_fee: '', parts_detail: '' });
  const [submitting, setSubmitting] = useState(false);

  const subtotal = (parseInt(form.labor_fee) || 0) + (parseInt(form.parts_fee) || 0) + (parseInt(form.travel_fee) || 0) + (parseInt(form.other_fee) || 0);
  const internalEstimate = Math.round(subtotal * commissionRate); // Internal legacy estimate; customer-facing quote uses SAGEMRO official pricing.

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
      toastSuccess(copy.quoteSubmitted);
      onSubmitted?.();
    } catch (e) {
      toastError(`${copy.submitFailed}: ${e.message}`);
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
      <div className="text-xs text-[var(--color-text-muted)]">{copy.engineerIntro}</div>
      <div className="grid grid-cols-2 gap-3">
        {field('labor_fee', copy.laborFee, copy.laborPlaceholder)}
        {field('parts_fee', copy.partsFee, copy.partsPlaceholder)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('travel_fee', copy.travelFee, copy.travelPlaceholder)}
        {field('other_fee', copy.otherFees, copy.otherPlaceholder)}
      </div>
      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.partsDetail}</label>
        <textarea
          value={form.parts_detail}
          onChange={(e) => setForm({ ...form, parts_detail: e.target.value })}
          placeholder={copy.partsDetailPlaceholder}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
        />
      </div>
      {/* 费用汇总 */}
      <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{copy.laborFee}</span><span>{form.labor_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{copy.partsFee}</span><span>{form.parts_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{copy.travelFee}</span><span>{form.travel_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{copy.otherFees}</span><span>{form.other_fee || 0} CNY</span></div>
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5"><span className="text-[var(--color-text-secondary)]">{copy.quoteSubtotal}</span><span className="font-medium">{subtotal} CNY</span></div>
        <div className="flex justify-between font-semibold text-[var(--color-primary)]">
          <span>{copy.internalSettlement}</span>
          <span>{internalEstimate} CNY</span>
        </div>
      </div>
      <button
        data-testid="submit-pricing-button"
        onClick={handleSubmit}
        disabled={submitting || subtotal === 0}
        className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-medium"
      >
        {submitting ? copy.submitting : copy.submitForReview}
      </button>
    </div>
  );
}

// ========== 报价确认区（客户查看） ==========
export function CustomerPricingPanel({ workOrderId, customerId, onConfirmed }) {
  const copy = getCopy();
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
      toastSuccess(copy.quoteConfirmed);
      onConfirmed?.();
      load();
    } catch (e) {
      toastError(`${copy.confirmFailed}: ${e.message}`);
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toastWarning(copy.negotiationReasonRequired); return; }
    setSubmitting(true);
    try {
      await rejectWorkOrderPricing(workOrderId, customerId, rejectReason, counterOffer ? parseInt(counterOffer) : null);
      toastSuccess(copy.negotiationStarted);
      onConfirmed?.();
      load();
    } catch (e) {
      toastError(`${copy.operationFailed}: ${e.message}`);
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  if (loading) return <div className="text-center py-4 text-sm text-[var(--color-text-muted)]">{copy.loading}</div>;

  if (!pricing) {
    return (
      <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4 text-center text-sm text-[var(--color-text-muted)]">
        {copy.preparingQuote}
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
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{copy.laborFee}</span><span>{pricing.labor_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{copy.partsFee}</span><span>{pricing.parts_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{copy.travelFee}</span><span>{pricing.travel_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{copy.otherFees}</span><span>{pricing.other_fee || 0} CNY</span></div>
        {pricing.parts_detail && pricing.parts_detail !== '[]' && pricing.parts_detail !== '' && (
          <div className="text-xs text-[var(--color-text-secondary)] pt-1 border-t border-[var(--color-border)]">
            {copy.partsDetailLabel}: {(() => { try { return JSON.parse(pricing.parts_detail).map(p => `${p.name || copy.part} ${p.qty || 1}×${p.unit_price || 0} CNY`).join('; '); } catch { return pricing.parts_detail; } })()}
          </div>
        )}
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5"><span className="text-[var(--color-text-secondary)]">{copy.quoteSubtotalLabel}</span><span className="font-medium">{pricing.subtotal || 0} CNY</span></div>
        {/* Legacy platform fee fields are not exposed as marketplace fees in Service OS. */}
        {pricing.platform_fee > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">{copy.serviceFee}</span>
              <span>{(pricing.subtotal || 0) - (pricing.platform_fee || 0)} CNY</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">{copy.serviceManagementFee}</span>
              <span>{pricing.platform_fee} CNY</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-semibold text-base text-[var(--color-primary)]">
          <span>{copy.totalPayable}</span><span>{pricing.total_amount || pricing.subtotal || 0} CNY</span>
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
            {copy.confirmQuote}
          </button>
          <button
            onClick={() => setAction('reject')}
            className="flex-1 py-2.5 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl font-medium"
          >
            {copy.negotiate}
          </button>
        </div>
      )}

      {action === 'reject' && (
        <div className="space-y-2 p-3 bg-[var(--color-surface-elevated)] rounded-xl">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={copy.negotiatePlaceholder}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
          <input
            type="number"
            value={counterOffer}
            onChange={(e) => setCounterOffer(e.target.value)}
            data-testid="counter-offer-input"
            placeholder={copy.counterOfferPlaceholder}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <div className="flex gap-2">
            <button onClick={() => setAction(null)} className="flex-1 py-2 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl text-sm">{copy.cancel}</button>
            <button data-testid="reject-pricing-button" onClick={handleReject} disabled={submitting} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm">
              {submitting ? copy.submitting : copy.negotiate}
            </button>
          </div>
        </div>
      )}

      {action === 'confirm' && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl space-y-2">
          <div className="text-sm text-[var(--color-text-primary)]">{copy.afterConfirm}</div>
          <div className="flex gap-2">
            <button onClick={() => setAction(null)} className="flex-1 py-2 bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] rounded-xl text-sm">{copy.cancel}</button>
            <button data-testid="confirm-pricing-button" onClick={handleConfirm} disabled={submitting} className="flex-1 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm">
              {submitting ? copy.confirming : copy.confirmQuote}
            </button>
          </div>
        </div>
      )}

      {pricing.status === 'confirmed' && (
        <div className="space-y-3">
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-center text-sm text-green-500">
            {copy.quoteConfirmedBadge}
          </div>
          <button
            onClick={() => setPaymentOpen(true)}
            className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-semibold text-sm transition-colors"
          >
            {copy.proceedPayment(pricing.total_amount || pricing.subtotal || 0)}
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
