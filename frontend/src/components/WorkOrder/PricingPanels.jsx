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
import { PaymentScheduleEditor } from './PaymentScheduleEditor';
import { PaymentScheduleSummary } from './PaymentScheduleSummary';
import {
  buildPricingPayload,
  createEngineerPricingDraft,
  createEngineerPricingDraftFromPricing,
  getEngineerPricingTotals,
  isPricingFormValid,
  isQuoteTermsValid,
  normalizePricingFormForServiceMode,
  parseCanonicalDecimalInteger,
} from './pricingDraft';

const PRICING_COPY = {
  en: {
    status: {
      draft: 'Draft / Negotiating',
      pending_review: 'Operations Review',
      submitted: 'Submitted, Awaiting Confirmation',
      confirmed: 'Confirmed',
    },
    priceCheck: {
      reasonable: 'Based on current market reference data, this price is within the expected range.',
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
      expectedDays: 'Expected onsite workdays',
      expectedDaysPlaceholder: 'Positive whole days',
      extensionNotice: 'Approved extensions increase the workday allowance only and do not automatically add labor fees.',
      submissionFailed: 'Quote submission failed',
      submitting: 'Submitting...',
      submit: 'Submit for Operations Review',
    },
    schedule: {
      paymentPlanLabel: 'Payment plan',
      single: '100% before service starts',
      installments: 'Installments',
      singleHelp: 'The full quote total is due before service starts.',
      installmentsHelp: 'Add 2 to 6 installments. Scheduled amounts must equal the quote total.',
      installment: 'Installment',
      amount: 'Amount',
      trigger: 'Payment trigger',
      dueDate: 'Due date',
      description: 'Customer-visible description',
      descriptionPlaceholder: 'Optional payment term detail',
      milestonePlaceholder: 'Describe the milestone',
      requiredBeforeStart: 'Required before service starts',
      addInstallment: 'Add installment',
      remove: 'Remove installment',
      moveUp: 'Move installment up',
      moveDown: 'Move installment down',
      total: 'Quote total',
      scheduled: 'Scheduled',
      difference: 'Difference',
      percent: 'Scheduled percent',
      paymentSchedule: 'Payment schedule',
      expectedDays: 'Expected onsite workdays',
      days: 'days',
      version: 'Version',
      completeQuote: 'Complete quote version',
      laborFee: 'Labor Fee',
      partsFee: 'Parts Fee',
      travelFee: 'Travel Fee',
      otherFee: 'Other Fees',
      otherFeeNote: 'Other Fee Note',
      triggerLabels: {
        before_start: 'Before service starts',
        on_arrival: 'On arrival',
        milestone: 'At agreed milestone',
        on_completion: 'On service completion',
        on_acceptance: 'On customer acceptance',
        fixed_date: 'On fixed date',
      },
    },
    customer: {
      confirmedToast: 'Quote confirmed. Please choose a payment method so SAGEMRO can send instructions.',
      confirmationFailed: 'Quote confirmation failed',
      operationFailed: 'Negotiation request failed',
      negotiationRequired: 'Please enter a reason for negotiation',
      counterOfferInvalid: 'Enter a whole-number counteroffer without spaces, signs, or decimals.',
      negotiationToast: 'Negotiation initiated. Operations will review and submit a revised quote.',
      preparingQuote: 'SAGEMRO is preparing a formal quote. You will be notified after diagnosis, scope, and safety requirements are reviewed.',
      loading: 'Loading quote...',
      invalidTerms: 'The quote payment terms are invalid. Confirmation is unavailable until SAGEMRO corrects the quote.',
      advancePayment: 'Advance payment before service',
      serviceBalance: 'Service balance after completion',
      totalPayable: 'Quote Subtotal Price',
      confirmQuote: 'Confirm Complete Quote',
      reviewQuote: 'Review Complete Quote',
      negotiate: 'Negotiate',
      negotiationPlaceholder: 'Please explain your reason for negotiation...',
      counterOfferPlaceholder: 'Your expected price (USD, optional)',
      cancel: 'Cancel',
      submitting: 'Submitting...',
      confirmNotice: 'Confirm this complete quote version, including all fees, onsite workdays, and payment installments. Partial confirmation is not available.',
      confirming: 'Confirming...',
      quoteConfirmed: 'Quote Confirmed',
      payment: (amount) => `Request Payment Instructions (${amount} USD)`,
    },
  },
  cn: {
    status: {
      draft: '草稿 / 协商中',
      pending_review: '运营审核中',
      submitted: '已提交，待确认',
      confirmed: '已确认',
    },
    priceCheck: {
      reasonable: '根据当前市场参考数据，此报价处于预期范围内。',
      high: '报价偏高',
      low: '报价偏低',
    },
    engineer: {
      submitted: '报价已提交运营审核。',
      helper: '请填写内部报价方案。运营团队将在客户看到正式报价前审核服务范围、费用和安全要求。',
      laborFee: '人工费',
      laborPlaceholder: '工时 × 单价',
      partsFee: '配件费',
      partsPlaceholder: '配件总费用',
      travelFee: '差旅费',
      travelPlaceholder: '交通 + 住宿',
      otherFee: '其他费用',
      otherPlaceholder: '其他费用',
      partsDetail: '其他费用说明（选填）',
      partsDetailPlaceholder: '例如特殊进场、周末支持、吊装、加班',
      quoteSubtotal: '报价总额',
      expectedDays: '预计现场作业日',
      expectedDaysPlaceholder: '请输入正整数天数',
      extensionNotice: '获批延期只增加可用作业日，不会自动增加人工费。',
      submissionFailed: '报价提交失败',
      submitting: '提交中...',
      submit: '提交运营审核',
    },
    schedule: {
      paymentPlanLabel: '付款计划',
      single: '开工前一次付清',
      installments: '分次付款',
      singleHelp: '服务开始前支付全部报价金额。',
      installmentsHelp: '可设置 2 至 6 期，计划金额合计必须等于报价总额。',
      installment: '分期',
      amount: '金额',
      trigger: '付款节点',
      dueDate: '到期日期',
      description: '客户可见说明',
      descriptionPlaceholder: '选填付款条款说明',
      milestonePlaceholder: '请说明具体里程碑',
      requiredBeforeStart: '开工前必须到账',
      addInstallment: '添加一期',
      remove: '删除本期',
      moveUp: '上移本期',
      moveDown: '下移本期',
      total: '报价总额',
      scheduled: '计划金额',
      difference: '差额',
      percent: '计划占比',
      paymentSchedule: '付款计划',
      expectedDays: '预计现场作业日',
      days: '天',
      version: '版本',
      completeQuote: '完整报价版本',
      laborFee: '人工费',
      partsFee: '配件费',
      travelFee: '差旅费',
      otherFee: '其他费用',
      otherFeeNote: '其他费用说明',
      triggerLabels: {
        before_start: '服务开始前',
        on_arrival: '工程师到场时',
        milestone: '约定里程碑完成时',
        on_completion: '服务完成时',
        on_acceptance: '客户验收时',
        fixed_date: '指定日期',
      },
    },
    customer: {
      confirmedToast: '报价已确认。请选择付款方式以获取付款指引。',
      confirmationFailed: '报价确认失败',
      operationFailed: '议价请求失败',
      negotiationRequired: '请输入议价原因',
      counterOfferInvalid: '期望价格须为不含空格、正负号或小数点的整数。',
      negotiationToast: '已发起议价，运营团队将审核并提交修订报价。',
      preparingQuote: 'SAGEMRO 正在准备正式报价。完成诊断、范围和安全要求审核后将通知您。',
      loading: '正在加载报价...',
      invalidTerms: '报价付款条款无效。在 SAGEMRO 修正报价前无法确认。',
      advancePayment: '服务前预付款',
      serviceBalance: '服务完成后尾款',
      totalPayable: '报价总额',
      confirmQuote: '确认完整报价',
      reviewQuote: '查看并确认完整报价',
      negotiate: '发起议价',
      negotiationPlaceholder: '请说明议价原因...',
      counterOfferPlaceholder: '您的期望价格（CNY，选填）',
      cancel: '取消',
      submitting: '提交中...',
      confirmNotice: '请确认此完整报价版本，包括全部费用、预计现场作业日和各期付款安排。不支持部分确认。',
      confirming: '确认中...',
      quoteConfirmed: '报价已确认',
      payment: (amount) => `获取付款指引（${amount} CNY）`,
    },
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
export function EngineerPricingPanel({ workOrderId, engineerId, pricing, serviceMode = 'remote', onSubmitted }) {
  const t = getPricingCopy();
  const currency = isCnLocale() ? 'CNY' : 'USD';
  const initialDraft = readEngineerPricingDraft(workOrderId, pricing);
  const [form, setForm] = useState(initialDraft.form);
  const [materialItems, setMaterialItems] = useState(initialDraft.materialItems);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    writeEngineerPricingDraft(workOrderId, { form, materialItems });
  }, [form, materialItems, workOrderId]);

  useEffect(() => {
    setForm((current) => normalizePricingFormForServiceMode(current, serviceMode));
  }, [serviceMode]);

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
  const scheduleIsValid = isPricingFormValid({
    form,
    totalAmount: subtotal,
    serviceMode,
    currency,
  });

  const handleSubmit = async () => {
    const payload = buildPricingPayload({
      form,
      partsFee,
      materialItems,
      engineerId,
      serviceMode,
      currency,
    });
    if (!payload) return;
    setSubmitting(true);
    try {
      await submitWorkOrderPricing(workOrderId, payload);
      clearEngineerPricingDraft(workOrderId);
      toastSuccess(t.engineer.submitted);
      onSubmitted?.();
    } catch (e) {
      toastError(`${t.engineer.submissionFailed}: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key, label, placeholder) => (
    <div>
      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{label}</label>
      <div className="relative">
        <input
          aria-label={label}
          type="number"
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">{currency}</span>
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
              {partsFee} {currency}
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
          aria-label={t.engineer.partsDetail}
          value={form.other_fee_note}
          onChange={(e) => setForm({ ...form, other_fee_note: e.target.value })}
          placeholder={t.engineer.partsDetailPlaceholder}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
        />
      </div>
      <MaterialPicker purpose="quote" workOrderId={workOrderId} items={materialItems} onChange={setMaterialItems} />
      {['onsite', 'hybrid'].includes(serviceMode) && (
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.engineer.expectedDays}</label>
          <input
            aria-label={t.engineer.expectedDays}
            type="number"
            min="1"
            step="1"
            value={form.expected_service_days}
            onChange={(event) => setForm({ ...form, expected_service_days: event.target.value })}
            placeholder={t.engineer.expectedDaysPlaceholder}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">{t.engineer.extensionNotice}</p>
        </div>
      )}
      {/* 鐠愬湱鏁ゅЧ鍥ㄢ偓?*/}
      <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.laborFee}</span><span>{form.labor_fee || 0} {currency}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.partsFee}</span><span>{partsFee} {currency}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.travelFee}</span><span>{form.travel_fee || 0} {currency}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">{t.engineer.otherFee}</span><span>{form.other_fee || 0} {currency}</span></div>
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5 font-semibold text-[var(--color-primary)]"><span>{t.engineer.quoteSubtotal}</span><span>{subtotal} {currency}</span></div>
      </div>
      <PaymentScheduleEditor
        form={form}
        onChange={setForm}
        totalAmount={subtotal}
        currency={currency}
        copy={t.schedule}
      />
      <button
        data-testid="submit-pricing-button"
        onClick={handleSubmit}
        disabled={submitting || !scheduleIsValid}
        className="w-full whitespace-nowrap py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-medium"
      >
        {submitting ? t.engineer.submitting : t.engineer.submit}
      </button>
    </div>
  );
}

// ========== 閹躲儰鐜涵顔款吇閸栫尨绱欑€广垺鍩涢弻銉ф箙閿?==========
export function CustomerPricingPanel({ workOrderId, customerId, serviceMode = 'remote', onConfirmed }) {
  const t = getPricingCopy();
  const currency = isCnLocale() ? 'CNY' : 'USD';
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
      await confirmWorkOrderPricing(workOrderId, customerId, pricing.quote_version);
      toastSuccess(t.customer.confirmedToast);
      onConfirmed?.();
      load();
    } catch (e) {
      toastError(`${t.customer.confirmationFailed}: ${e.message}`);
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toastWarning(t.customer.negotiationRequired); return; }
    const normalizedCounterOffer = counterOffer === ''
      ? null
      : parseCanonicalDecimalInteger(counterOffer);
    if (counterOffer !== '' && (normalizedCounterOffer === null || normalizedCounterOffer <= 0)) {
      toastWarning(t.customer.counterOfferInvalid);
      return;
    }
    setSubmitting(true);
    try {
      await rejectWorkOrderPricing(
        workOrderId,
        customerId,
        rejectReason,
        normalizedCounterOffer
      );
      toastSuccess(t.customer.negotiationToast);
      onConfirmed?.();
      load();
    } catch (e) {
      toastError(`${t.customer.operationFailed}: ${e.message}`);
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  if (loading) return <div className="text-center py-4 text-sm text-[var(--color-text-muted)]">{t.customer.loading}</div>;

  if (!pricing) {
    return (
      <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4 text-center text-sm text-[var(--color-text-muted)]">
        {t.customer.preparingQuote}
      </div>
    );
  }
  const scheduleIsValid = isQuoteTermsValid({ pricing, serviceMode, currency });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PricingStatusBadge status={pricing.status} />
      </div>

      <PaymentScheduleSummary
        pricing={pricing}
        currency={currency}
        copy={t.schedule}
        note={formatQuoteNote(pricing.parts_detail)}
      />
      <div>
        {pricing.material_items?.length > 0 && (
          <div className="border-t border-[var(--color-border)] pt-2">
            <div className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">{isCnLocale() ? '配件清单' : 'Parts List'}</div>
            <MaterialPicker items={pricing.material_items} readonly />
          </div>
        )}
        {pricing.payment_policy && (
          <div className="border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-secondary)]">
            <div className="flex justify-between"><span>{t.customer.advancePayment}</span><span>{pricing.payment_policy.advance_amount || 0} {currency}</span></div>
            <div className="mt-1 flex justify-between"><span>{t.customer.serviceBalance}</span><span>{pricing.payment_policy.balance_amount || 0} {currency}</span></div>
          </div>
        )}
      </div>

      {/* AI 鐎光剝鐗?*/}
      {pricing.status === 'submitted' && <AIPriceCheck check={pricing.ai_price_check} />}

      {pricing.status === 'submitted' && !scheduleIsValid && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
          {t.customer.invalidTerms}
        </div>
      )}

      {/* 閹垮秳缍旈崠?*/}
      {pricing.status === 'submitted' && action !== 'reject' && (
        <div className="flex gap-2">
          <button
            data-testid="open-confirm-pricing-button"
            onClick={() => setAction('confirm')}
            disabled={!scheduleIsValid}
            className="flex-1 whitespace-nowrap py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl font-medium"
          >
            {t.customer.reviewQuote}
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
            <button data-testid="confirm-pricing-button" onClick={handleConfirm} disabled={submitting || !scheduleIsValid} className="flex-1 whitespace-nowrap py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm">
              {submitting ? t.customer.confirming : t.customer.confirmQuote}
            </button>
          </div>
        </div>
      )}

      {pricing.status === 'confirmed' && (
        <div className="space-y-3">
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-center text-sm text-green-500">            {t.customer.quoteConfirmed}
          </div>
          <button
            onClick={() => setPaymentOpen(true)}
            className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-semibold text-sm transition-colors"
          >
            {t.customer.payment((pricing.payment_policy?.advance_amount ?? pricing.total_amount ?? pricing.subtotal ?? 0).toLocaleString())}
          </button>
        </div>
      )}

      {/* 娴犳ɑ顑欏鍦崶 */}
      <PaymentModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        workOrderId={workOrderId}
        customerId={customerId}
        onPaid={() => { setPaymentOpen(false); onConfirmed?.('messages'); load(); }}
      />
    </div>
  );
}
