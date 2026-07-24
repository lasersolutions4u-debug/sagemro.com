import { useEffect, useState } from 'react';
import { Building2, CheckCircle, CreditCard, Loader2, Send, Shield, X } from 'lucide-react';
import {
  getWorkOrder,
  getWorkOrderPayment,
  getWorkOrderPricing,
  payWorkOrder,
  selectInstallmentPaymentMethod,
} from '../../services/api';
import { toastError, toastSuccess } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

const PAYPAL_PAYMENT_LINK = 'https://www.paypal.com/ncp/payment/4YLFXRSUSZJ5N';

const COPY = {
  en: {
    methods: [
      { id: 'bank_transfer', label: 'Bank Transfer / Wire Transfer', icon: Building2, desc: 'Request TT bank details, then send the bank slip to the engineer in Messages.' },
      { id: 'paypal_card', label: 'PayPal / Credit or Debit Card', icon: CreditCard, desc: 'Pay through the official PayPal page, then send the payment screenshot in Messages.' },
    ],
    loading: 'Loading...',
    confirming: 'Confirming...',
    confirmingMethod: 'Confirming payment method...',
    followUp: 'Payment Follow-up',
    confirmInstallment: 'Confirm Installment Payment Method',
    confirmBalance: 'Confirm Balance Payment',
    confirmAdvance: 'Confirm Advance Payment',
    methodReceived: 'Payment method received',
    installment: 'Installment amount',
    serviceBalance: 'Service Balance',
    advance: 'Advance Payment',
    quoteTotal: 'Quote Total',
    paymentMethod: 'Payment Method',
    status: 'Status',
    orderNo: 'Order No',
    trigger: 'Payment trigger',
    selectMethod: 'Select Payment Method',
    paymentNotice: 'Payment Notice',
    openPayPal: 'Open PayPal Payment Page',
    goMessages: 'Go to Messages',
    installmentNotice: 'This payment method applies only to this installment. Complete payment using the official instructions, then send the bank slip or PayPal screenshot in Messages. Admin confirms the actual receipt.',
    balanceSubmitted: 'Please complete the service balance payment, then send the bank slip or PayPal screenshot in Messages. Admin will confirm receipt and close the payment record.',
    advanceSubmitted: 'Please complete the advance payment, then send the bank slip or PayPal screenshot in Messages. The advance covers parts, dispatch preparation, and part of the service fee. Service starts only after Admin confirms receipt; the remaining balance is payable after completion.',
    balanceNotice: 'The service balance is due after the service report is submitted. Admin confirms receipt before the payment record is closed.',
    advanceNotice: 'The advance covers parts, engineer dispatch preparation, and part of the service fee. The remaining balance is payable after completion.',
    continuePayPal: 'Continue with PayPal Instructions',
    requestBalance: 'Request Balance TT Instructions',
    requestInstallment: 'Request Installment TT Instructions',
    requestAdvance: 'Request TT Instructions',
    failure: 'Payment method confirmation failed',
    successPayPal: 'Payment method confirmed. PayPal opened in a new tab. Send the payment screenshot in Messages after payment.',
    successBank: 'Payment method confirmed. Send the payment proof in Messages after payment.',
    states: {
      awaiting_customer: 'Payment request ready',
      instructions_requested: 'Payment instructions requested',
      pending_admin_confirmation: 'Waiting for Admin payment confirmation',
      collecting: 'Collection in progress',
      partially_received: 'Partially received',
      overdue: 'Overdue',
      completed: 'Payment confirmed by SAGEMRO',
      received: 'Payment confirmed by SAGEMRO',
    },
    triggers: {
      before_start: 'Before service starts', on_arrival: 'On arrival', milestone: 'At agreed milestone',
      on_completion: 'On service completion', on_acceptance: 'On customer acceptance', fixed_date: 'On fixed date',
    },
  },
  cn: {
    methods: [
      { id: 'bank_transfer', label: '银行转账', icon: Building2, desc: '获取对公账户信息，付款后在工单消息中发送银行回单。' },
      { id: 'paypal_card', label: 'PayPal / 信用卡或借记卡', icon: CreditCard, desc: '通过 SAGEMRO 官方 PayPal 页面付款，完成后在工单消息中发送付款截图。' },
    ],
    loading: '正在加载...',
    confirming: '正在确认...',
    confirmingMethod: '正在确认付款方式...',
    followUp: '付款跟进',
    confirmInstallment: '确认本期付款方式',
    confirmBalance: '确认尾款付款方式',
    confirmAdvance: '确认预付款方式',
    methodReceived: '已收到付款方式',
    installment: '本期金额',
    serviceBalance: '服务尾款',
    advance: '服务预付款',
    quoteTotal: '报价总额',
    paymentMethod: '付款方式',
    status: '状态',
    orderNo: '工单号',
    trigger: '付款节点',
    selectMethod: '选择付款方式',
    paymentNotice: '付款说明',
    openPayPal: '打开 PayPal 付款页面',
    goMessages: '前往工单消息',
    installmentNotice: '此付款方式仅用于当前一期。请按官方指引完成付款，并在工单消息中发送银行回单或 PayPal 截图，实际到账由 Admin 确认。',
    balanceSubmitted: '请完成服务尾款支付，并在工单消息中发送银行回单或 PayPal 截图。Admin 确认到账后将关闭付款记录。',
    advanceSubmitted: '请完成服务预付款，并在工单消息中发送银行回单或 PayPal 截图。Admin 确认到账后服务才可开始，剩余尾款在服务完成后支付。',
    balanceNotice: '服务报告提交后支付尾款，Admin 确认到账后关闭付款记录。',
    advanceNotice: '预付款用于配件、工程师派工准备和部分服务费用，剩余尾款在服务完成后支付。',
    continuePayPal: '继续查看 PayPal 付款指引',
    requestBalance: '获取尾款银行转账信息',
    requestInstallment: '获取本期银行转账信息',
    requestAdvance: '获取银行转账信息',
    failure: '付款方式确认失败',
    successPayPal: '付款方式已确认，PayPal 已在新页面打开。付款后请在工单消息中发送付款截图。',
    successBank: '付款方式已确认。付款后请在工单消息中发送付款凭证。',
    states: {
      awaiting_customer: '待选择付款方式',
      instructions_requested: '已获取付款指引',
      pending_admin_confirmation: '等待 Admin 确认到账',
      collecting: '收款中',
      partially_received: '部分到账',
      overdue: '已逾期',
      completed: 'SAGEMRO 已确认到账',
      received: 'SAGEMRO 已确认到账',
    },
    triggers: {
      before_start: '服务开始前', on_arrival: '工程师到场时', milestone: '约定里程碑完成时',
      on_completion: '服务完成时', on_acceptance: '客户验收时', fixed_date: '指定日期',
    },
  },
};

export function PaymentModal({
  isOpen,
  onClose,
  workOrderId,
  customerId: _customerId,
  paymentStage = 'advance',
  installmentId = null,
  amount: installmentAmount = null,
  trigger = null,
  currency: installmentCurrency = null,
  onPaid,
}) {
  const copy = isCnLocale() ? COPY.cn : COPY.en;
  const localeCurrency = isCnLocale() ? 'CNY' : 'USD';
  const isInstallmentMode = Boolean(installmentId);
  const currency = isInstallmentMode
    ? (installmentCurrency || localeCurrency)
    : localeCurrency;
  const [step, setStep] = useState('pay');
  const [pricing, setPricing] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('bank_transfer');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!isOpen || !workOrderId) return;
    setLoading(true);
    setStep('pay');
    setSubmitting(false);
    setResult(null);

    Promise.all([
      isInstallmentMode ? Promise.resolve({ pricing: null }) : getWorkOrderPricing(workOrderId).catch(() => ({ pricing: null })),
      isInstallmentMode ? Promise.resolve({ payment: null }) : getWorkOrderPayment(workOrderId, paymentStage).catch(() => ({ payment: null })),
      getWorkOrder(workOrderId).catch(() => null),
    ]).then(([pricingRes, paymentRes, orderRes]) => {
      if (paymentRes?.payment && paymentRes.payment.status !== 'awaiting_customer') {
        setStep('submitted');
        setResult(paymentRes.payment);
      }
      setPricing(pricingRes?.pricing || null);
      setOrder(orderRes);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isInstallmentMode, isOpen, paymentStage, workOrderId]);

  const paymentPolicy = pricing?.payment_policy || {};
  const isBalancePayment = paymentStage === 'balance';
  const amount = isInstallmentMode
    ? installmentAmount
    : isBalancePayment
      ? paymentPolicy.balance_amount ?? 0
      : paymentPolicy.advance_amount ?? pricing?.total_amount ?? pricing?.subtotal ?? 0;
  const normalizedAmount = Number(amount || 0);
  const balanceAmount = paymentPolicy.balance_amount ?? Math.max(0, (pricing?.total_amount || pricing?.subtotal || 0) - normalizedAmount);
  const paymentLabel = isInstallmentMode ? copy.installment : isBalancePayment ? copy.serviceBalance : copy.advance;

  const handlePay = async () => {
    setSubmitting(true);
    setStep('processing');
    try {
      let response;
      if (isInstallmentMode) {
        response = await selectInstallmentPaymentMethod(workOrderId, installmentId, { payment_method: method });
      } else {
        response = await payWorkOrder(workOrderId, { payment_method: method, payment_stage: paymentStage });
      }
      setResult(isInstallmentMode ? response.installment : response.payment);
      setStep('submitted');
      if (method === 'paypal_card') {
        window.open(PAYPAL_PAYMENT_LINK, '_blank', 'noopener,noreferrer');
        toastSuccess(copy.successPayPal);
      } else {
        toastSuccess(copy.successBank);
      }
      onPaid?.();
    } catch (error) {
      toastError(`${copy.failure}: ${error.message}`);
      setStep('pay');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const title = step === 'processing'
    ? copy.confirming
    : step === 'submitted'
      ? copy.followUp
      : isInstallmentMode ? copy.confirmInstallment : isBalancePayment ? copy.confirmBalance : copy.confirmAdvance;
  const submittedNotice = isInstallmentMode ? copy.installmentNotice : isBalancePayment ? copy.balanceSubmitted : copy.advanceSubmitted;
  const paymentNotice = isInstallmentMode ? copy.installmentNotice : isBalancePayment ? copy.balanceNotice : copy.advanceNotice;
  const submittedAmount = isInstallmentMode
    ? normalizedAmount
    : Number(result?.amount ?? normalizedAmount);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[calc(100dvh-16px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 p-3 sm:p-4">
          <h2 className="min-w-0 truncate text-base font-semibold text-slate-950 sm:text-lg">{title}</h2>
          <button type="button" onClick={onClose} aria-label={isCnLocale() ? '关闭' : 'Close'} title={isCnLocale() ? '关闭' : 'Close'} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500"><Loader2 size={24} className="mx-auto mb-2 animate-spin" />{copy.loading}</div>
          ) : step === 'processing' ? (
            <div className="space-y-3 py-8 text-center"><Loader2 size={48} className="mx-auto animate-spin text-amber-500" /><p className="text-sm text-slate-600">{copy.confirmingMethod}</p></div>
          ) : step === 'submitted' ? (
            <div className="space-y-3 py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10"><CheckCircle size={36} className="text-blue-500" /></div>
              <h3 className="text-lg font-semibold text-slate-950">{copy.methodReceived}</h3>
              <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-left text-sm">
                <div className="flex justify-between gap-3"><span className="text-slate-500">{paymentLabel}</span><span className="font-semibold text-slate-950">{submittedAmount.toLocaleString()} {currency}</span></div>
                {!isInstallmentMode && (
                  <div className="flex justify-between gap-3"><span className="text-slate-500">{isBalancePayment ? copy.quoteTotal : copy.serviceBalance}</span><span className="text-right text-slate-950">{Number(isBalancePayment ? (result?.quote_total_amount ?? paymentPolicy.subtotal ?? 0) : (result?.balance_amount ?? balanceAmount)).toLocaleString()} {currency}</span></div>
                )}
                {isInstallmentMode && trigger && (
                  <div className="flex justify-between gap-3"><span className="text-slate-500">{copy.trigger}</span><span className="text-right text-slate-950">{copy.triggers[trigger] || trigger}</span></div>
                )}
                <div className="flex justify-between gap-3"><span className="text-slate-500">{copy.paymentMethod}</span><span className="text-right text-slate-950">{copy.methods.find((item) => item.id === (result?.payment_method || method))?.label}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">{copy.status}</span><span className="text-right text-slate-950">{copy.states[result?.status] || result?.status || copy.states.collecting}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">{copy.orderNo}</span><span className="text-slate-950">{order?.order_no || workOrderId?.slice(0, 14)}</span></div>
              </div>
              {(result?.payment_method || method) === 'paypal_card' && (
                <a href={PAYPAL_PAYMENT_LINK} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100"><CreditCard size={18} />{copy.openPayPal}</a>
              )}
              <p className="text-xs text-slate-500">{submittedNotice}</p>
              <button type="button" onClick={onClose} className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600">{copy.goMessages}</button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">{copy.orderNo}</span><span className="text-slate-950">{order?.order_no || workOrderId?.slice(0, 14)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="text-slate-500">{paymentLabel}</span><span className="text-lg font-bold text-slate-950">{normalizedAmount.toLocaleString()} {currency}</span></div>
                {isInstallmentMode && trigger && <div className="flex justify-between gap-3"><span className="text-slate-500">{copy.trigger}</span><span className="text-right text-slate-950">{copy.triggers[trigger] || trigger}</span></div>}
                {!isInstallmentMode && <div className="flex justify-between"><span className="text-slate-500">{isBalancePayment ? copy.quoteTotal : copy.serviceBalance}</span><span className="text-slate-950">{Number(isBalancePayment ? (paymentPolicy.subtotal || 0) : balanceAmount).toLocaleString()} {currency}</span></div>}
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500">{copy.selectMethod}</label>
                <div className="space-y-2">
                  {copy.methods.map((item) => {
                    const Icon = item.icon;
                    const selected = method === item.id;
                    return (
                      <button key={item.id} type="button" onClick={() => setMethod(item.id)} className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all ${selected ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}><Icon size={20} /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-950">{item.label}</span><span className="block text-xs leading-5 text-slate-500">{item.desc}</span></span>
                        {selected && <CheckCircle size={18} className="shrink-0 text-amber-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                <Shield size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <div className="text-xs text-blue-900"><p className="mb-0.5 font-medium text-blue-950">{copy.paymentNotice}</p><p>{paymentNotice}</p></div>
              </div>

              <button type="button" onClick={handlePay} disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-amber-500 px-3 font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50">
                <Send size={20} />
                {submitting ? copy.confirming : method === 'paypal_card' ? copy.continuePayPal : isInstallmentMode ? copy.requestInstallment : isBalancePayment ? copy.requestBalance : copy.requestAdvance}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
