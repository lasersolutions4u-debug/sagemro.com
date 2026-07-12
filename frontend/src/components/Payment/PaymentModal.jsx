import { useState, useEffect } from 'react';
import { X, CheckCircle, CreditCard, Building2, Shield, Loader2, Send } from 'lucide-react';
import { getWorkOrderPricing, getWorkOrderPayment, payWorkOrder, getWorkOrder } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Bank Transfer / Wire Transfer', icon: Building2, desc: 'Request TT bank details, then send the bank slip to the engineer in Messages.' },
  { id: 'paypal_card', label: 'PayPal / Credit or Debit Card', icon: CreditCard, desc: 'Pay through the official PayPal page, then send the payment screenshot in Messages.' },
];

const CURRENCY = 'USD';
const PAYPAL_PAYMENT_LINK = 'https://www.paypal.com/ncp/payment/4YLFXRSUSZJ5N';

const COPY = {
  en: {
    methods: [
      { id: 'bank_transfer', label: 'Bank Transfer / Wire Transfer', desc: 'Request TT bank details, then send the bank slip to the engineer in Messages.' },
      { id: 'paypal_card', label: 'PayPal / Credit or Debit Card', desc: 'Pay through the official PayPal page, then send the payment screenshot in Messages.' },
    ],
    status: {
      instructions_requested: 'Payment instructions requested',
      pending_admin_confirmation: 'Waiting for Admin payment confirmation',
      completed: 'Payment confirmed by SAGEMRO',
      fallback: 'Payment follow-up pending',
    },
    titleProcessing: 'Confirming...',
    titleSubmitted: 'Payment Follow-up',
    titlePay: 'Confirm Payment Method',
    loading: 'Loading...',
    confirming: 'Confirming payment method...',
    received: 'Payment method received',
    amount: 'Amount',
    paymentMethod: 'Payment Method',
    statusLabel: 'Status',
    orderNo: 'Order No',
    bankFallback: 'Bank Transfer',
    openPaypal: 'Open PayPal Payment Page',
    followup: 'Please complete payment, then send the bank slip or PayPal screenshot to the engineer in Messages. Service starts only after Admin confirms receipt.',
    goMessages: 'Go to Messages',
    selectMethod: 'Select Payment Method',
    noticeTitle: 'Payment Notice',
    noticeBody: "TT users receive bank details. PayPal users will be sent to SAGEMRO's official PayPal payment page. After payment, send the proof screenshot in Messages.",
    confirmPaypal: 'Continue with PayPal Instructions',
    confirmBank: 'Request TT Instructions',
    paypalToast: 'Payment method confirmed. PayPal opened in a new tab. Please send the payment screenshot in Messages after payment.',
    bankToast: 'Payment method confirmed. Please send the payment proof to the engineer in Messages after payment.',
    errorToast: 'Payment method confirmation failed: ',
  },
  cn: {
    methods: [
      { id: 'bank_transfer', label: '银行电汇 / TT', desc: '申请收款信息后，请在消息中把银行付款凭证发送给工程师。' },
      { id: 'paypal_card', label: 'PayPal / 信用卡或借记卡', desc: '通过官方 PayPal 页面付款后，请在消息中发送付款截图。' },
    ],
    status: {
      instructions_requested: '已申请付款说明',
      pending_admin_confirmation: '等待 Admin 确认收款',
      completed: 'SAGEMRO 已确认收款',
      fallback: '等待付款跟进',
    },
    titleProcessing: '确认中...',
    titleSubmitted: '付款跟进',
    titlePay: '确认付款方式',
    loading: '加载中...',
    confirming: '正在确认付款方式...',
    received: '付款方式已收到',
    amount: '金额',
    paymentMethod: '付款方式',
    statusLabel: '状态',
    orderNo: '工单号',
    bankFallback: '银行电汇',
    openPaypal: '打开 PayPal 付款页面',
    followup: '请完成付款后，在消息中把银行凭证或 PayPal 截图发送给工程师。Admin 确认收款后再开始服务。',
    goMessages: '前往消息',
    selectMethod: '选择付款方式',
    noticeTitle: '付款说明',
    noticeBody: '选择电汇会获得收款信息；选择 PayPal 会打开 SAGEMRO 官方 PayPal 付款页面。付款后请在消息中发送凭证截图。',
    confirmPaypal: '继续查看 PayPal 付款说明',
    confirmBank: '申请 TT 电汇说明',
    paypalToast: '付款方式已确认。PayPal 已在新标签页打开，付款后请在消息中发送付款截图。',
    bankToast: '付款方式已确认。付款后请在消息中把付款凭证发送给工程师。',
    errorToast: '付款方式确认失败：',
  },
};

function getPaymentMethods(copy) {
  return PAYMENT_METHODS.map((method) => ({
    ...method,
    ...(copy.methods.find((item) => item.id === method.id) || {}),
  }));
}

function paymentStatusCopy(status, copy = COPY.en) {
  const map = {
    instructions_requested: copy.status.instructions_requested,
    pending_admin_confirmation: copy.status.pending_admin_confirmation,
    completed: copy.status.completed,
  };
  return map[status] || status || copy.status.fallback;
}

export function PaymentModal({ isOpen, onClose, workOrderId, customerId, onPaid }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const paymentMethods = getPaymentMethods(copy);
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
      getWorkOrderPricing(workOrderId).catch(() => ({ pricing: null })),
      getWorkOrderPayment(workOrderId).catch(() => ({ payment: null })),
      getWorkOrder(workOrderId).catch(() => null),
    ]).then(([pricingRes, paymentRes, orderRes]) => {
      if (paymentRes?.payment) {
        setStep('submitted');
        setResult(paymentRes.payment);
      }
      setPricing(pricingRes?.pricing || null);
      setOrder(orderRes);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isOpen, workOrderId]);

  const amount = pricing?.total_amount || pricing?.subtotal || 0;
  const MethodIcon = paymentMethods.find(m => m.id === method)?.icon || Building2;

  const handlePay = async () => {
    setSubmitting(true);
    setStep('processing');
    try {
      const res = await payWorkOrder(workOrderId, { payment_method: method });
      setResult(res.payment);
      setStep('submitted');
      if (method === 'paypal_card') {
        window.open(PAYPAL_PAYMENT_LINK, '_blank', 'noopener,noreferrer');
        toastSuccess(copy.paypalToast);
      } else {
        toastSuccess(copy.bankToast);
      }
      onPaid?.();
    } catch (e) {
      toastError(copy.errorToast + e.message);
      setStep('pay');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[calc(100dvh-16px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950 shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 p-3 sm:p-4">
          <h2 className="min-w-0 truncate text-base font-semibold text-slate-950 sm:text-lg">
            {step === 'processing' ? copy.titleProcessing : step === 'submitted' ? copy.titleSubmitted : copy.titlePay}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              {copy.loading}
            </div>
          ) : step === 'processing' ? (
            <div className="text-center py-8 space-y-3">
              <Loader2 size={48} className="mx-auto animate-spin text-amber-500" />
              <p className="text-sm text-slate-600">{copy.confirming}</p>
            </div>
          ) : step === 'submitted' ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
                <CheckCircle size={36} className="text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">{copy.received}</h3>
              <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-left text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{copy.amount}</span>
                  <span className="font-semibold text-slate-950">{result?.amount?.toLocaleString() || amount.toLocaleString()} {CURRENCY}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{copy.paymentMethod}</span>
                  <span className="text-right text-slate-950">{paymentMethods.find(m => m.id === result?.payment_method)?.label || copy.bankFallback}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{copy.statusLabel}</span>
                  <span className="text-right text-slate-950">{paymentStatusCopy(result?.status, copy)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{copy.orderNo}</span>
                  <span className="text-slate-950">{order?.order_no || workOrderId?.slice(0, 14)}</span>
                </div>
              </div>
              {result?.payment_method === 'paypal_card' && (
                <a
                  href={PAYPAL_PAYMENT_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100"
                >
                  <CreditCard size={18} />
                  {copy.openPaypal}
                </a>
              )}
              <p className="text-xs text-slate-500">{copy.followup}</p>
              <button onClick={onClose} className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600">
                {copy.goMessages}
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">{copy.orderNo}</span>
                  <span className="text-slate-950">{order?.order_no || workOrderId?.slice(0, 14)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500">{copy.amount}</span>
                  <span className="text-lg font-bold text-slate-950">{amount.toLocaleString()} {CURRENCY}</span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500">{copy.selectMethod}</label>
                <div className="space-y-2">
                  {paymentMethods.map((m) => {
                    const Icon = m.icon;
                    const selected = method === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                          selected
                            ? 'border-amber-500 bg-amber-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-400'
                        }`}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${selected ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                          <Icon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-950">{m.label}</div>
                          <div className="text-xs leading-5 text-slate-500">{m.desc}</div>
                        </div>
                        {selected && <CheckCircle size={18} className="text-amber-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2.5">
                <Shield size={16} className="mt-0.5 flex-shrink-0 text-blue-600" />
                <div className="text-xs text-blue-900">
                  <p className="mb-0.5 font-medium text-blue-950">{copy.noticeTitle}</p>
                  <p>{copy.noticeBody}</p>
                </div>
              </div>

              <button
                onClick={handlePay}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                <Send size={20} />
                {submitting ? copy.titleProcessing : method === 'paypal_card' ? copy.confirmPaypal : copy.confirmBank}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
