import { useState, useEffect } from 'react';
import { X, CheckCircle, CreditCard, Building2, Shield, Loader2, Send, FileText } from 'lucide-react';
import { getWorkOrderPricing, getWorkOrderPayment, payWorkOrder, getWorkOrder, submitInvoiceRequest, getInvoiceRequest } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Bank Transfer / Wire Transfer', icon: Building2, desc: 'Request TT bank details, then send the bank slip to the engineer in Messages.' },
  { id: 'paypal_card', label: 'PayPal / Credit or Debit Card', icon: CreditCard, desc: 'Pay through the official PayPal page, then send the payment screenshot in Messages.' },
];

const CURRENCY = isCnLocale() ? 'CNY' : 'USD';
const PAYPAL_PAYMENT_LINK = 'https://www.paypal.com/ncp/payment/4YLFXRSUSZJ5N';

// China edition bank account info for 公对公转账
const CN_BANK_INFO = {
  bank_name: '中国银行济南高新支行',
  account_name: '济南钰峭机械有限公司',
  account_number: '218252321255',
};

function cnPaymentMethods() {
  return [
    { id: 'bank_transfer', label: '公对公转账', icon: Building2, desc: '请通过网银或柜台向下方对公账户转账。付款成功后点击底部按钮，再前往消息发送付款水单。' },
  ];
}

function cnBankInfoDisplay() {
  const bank = CN_BANK_INFO;
  return (
    <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-1.5 text-xs text-blue-900">
      <p className="font-medium text-blue-950">对公账户收款信息</p>
      <p>收款银行：{bank.bank_name}</p>
      <p>收款户名：{bank.account_name}</p>
      <p>收款账号：{bank.account_number}</p>
    </div>
  );
}

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
    invoiceTitle: 'Request an Invoice',
    invoiceDesc: 'Need a Chinese  VAT invoice for your company? Fill in the information below.',
    invoiceBtn: 'Submit Invoice Request',
    invoiceSubmitted: 'Invoice request submitted. We will contact you after issuing.',
    invoiceSkip: 'Skip, I don\'t need an invoice',
    invoiceCompanyName: 'Company Name',
    invoiceTaxId: 'Tax ID',
    invoiceAddress: 'Company Address',
    invoicePhone: 'Company Phone',
    invoiceBankName: 'Bank Name',
    invoiceBankAccount: 'Bank Account',
    invoiceNote: 'Notes (optional)',
  },
  cn: {
    methods: [
      { id: 'bank_transfer', label: '公对公转账', desc: '请通过网银或柜台向对公账户转账，付款后在消息中发送水单。' },
    ],
    status: {
      instructions_requested: '已通知工程师，等待核对付款凭证',
      pending_admin_confirmation: '等待 Admin 确认收款',
      completed: 'SAGEMRO 已确认收款',
      fallback: '等待付款跟进',
    },
    titleProcessing: '正在通知工程师...',
    titleSubmitted: '付款跟进',
    titlePay: '线下付款',
    loading: '加载中...',
    confirming: '正在通知工程师...',
    received: '已通知工程师',
    amount: '金额',
    paymentMethod: '付款方式',
    statusLabel: '状态',
    orderNo: '工单号',
    bankFallback: '公对公转账',
    followup: '已通知工程师。请前往消息发送付款水单，工程师核对后将提交 Admin 确认收款。',
    goMessages: '前往消息并发送水单',
    selectMethod: '付款方式',
    noticeTitle: '付款说明',
    noticeBody: '请通过上方对公账户完成线下付款。付款成功后点击下方按钮通知工程师，再前往消息发送付款水单。',
    confirmBank: '付款成功通知工程师',
    bankToast: '已通知工程师，请前往消息发送付款水单。',
    errorToast: '通知工程师失败：',
    invoiceTitle: '申请开具发票',
    invoiceDesc: '需要开具增值税发票吗？请填写贵司开票信息。',
    invoiceBtn: '提交开票申请',
    invoiceSubmitted: '开票申请已提交，开票后我们会联系您。',
    invoiceSkip: '跳过，不需要发票',
    invoiceCompanyName: '公司名称',
    invoiceTaxId: '纳税人识别号',
    invoiceAddress: '公司地址',
    invoicePhone: '公司电话',
    invoiceBankName: '开户银行',
    invoiceBankAccount: '银行账号',
    invoiceNote: '备注（可选）',
  },
};

function getPaymentMethods(isCn, copy) {
  if (isCn) return cnPaymentMethods();
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

export function PaymentModal({ isOpen, onClose, workOrderId, customerId, paymentStage = 'advance', onPaid }) {
  const isCn = isCnLocale();
  const isBalancePayment = paymentStage === 'balance';
  const copy = isCn ? COPY.cn : COPY.en;
  const paymentMethods = getPaymentMethods(isCn, copy);
  const [step, setStep] = useState('pay');
  const [pricing, setPricing] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('bank_transfer');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceData, setInvoiceData] = useState({ company_name: '', tax_id: '', company_address: '', company_phone: '', bank_name: '', bank_account: '', notes: '' });
  const [invoiceSubmitted, setInvoiceSubmitted] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [existingInvoice, setExistingInvoice] = useState(null);

  useEffect(() => {
    if (!isOpen || !workOrderId) return;
    setLoading(true);
    setStep('pay');
    setSubmitting(false);
    setResult(null);
    setShowInvoiceForm(false);
    setInvoiceSubmitted(false);
    setExistingInvoice(null);

    Promise.all([
      getWorkOrderPricing(workOrderId).catch(() => ({ pricing: null })),
      getWorkOrderPayment(workOrderId, paymentStage).catch(() => ({ payment: null })),
      getWorkOrder(workOrderId).catch(() => null),
      isCn ? getInvoiceRequest(workOrderId).catch(() => ({ invoice_request: null })) : Promise.resolve({ invoice_request: null }),
    ]).then(([pricingRes, paymentRes, orderRes, invoiceRes]) => {
      if (paymentRes?.payment) {
        setStep(paymentRes.payment.status === 'awaiting_customer' ? 'pay' : 'submitted');
        setResult(paymentRes.payment);
      }
      setPricing(pricingRes?.pricing || null);
      setOrder(orderRes);
      if (invoiceRes?.invoice_request) setExistingInvoice(invoiceRes.invoice_request);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isCn, isOpen, paymentStage, workOrderId]);

  const paymentPolicy = pricing?.payment_policy || {};
  const amount = isBalancePayment
    ? paymentPolicy.balance_amount || 0
    : paymentPolicy.advance_amount ?? pricing?.total_amount ?? pricing?.subtotal ?? 0;
  const MethodIcon = paymentMethods.find(m => m.id === method)?.icon || Building2;

  const handlePay = async () => {
    setSubmitting(true);
    setStep('processing');
    try {
      const res = await payWorkOrder(workOrderId, { payment_method: method, payment_stage: paymentStage });
      setResult(res.payment);
      setStep('submitted');
      if (method === 'paypal_card') {
        window.open(PAYPAL_PAYMENT_LINK, '_blank', 'noopener,noreferrer');
        toastSuccess(copy.paypalToast);
      } else {
        toastSuccess(copy.bankToast);
      }
      onPaid?.();
      if (isCn && !isBalancePayment) setShowInvoiceForm(true);
    } catch (e) {
      toastError(copy.errorToast + e.message);
      setStep('pay');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvoiceSubmit = async () => {
    if (!invoiceData.company_name || !invoiceData.tax_id) {
      toastError(isCn ? '请填写公司名称和纳税人识别号' : 'Please fill in company name and tax ID');
      return;
    }
    setInvoiceSubmitting(true);
    try {
      await submitInvoiceRequest(workOrderId, invoiceData);
      setInvoiceSubmitted(true);
      setShowInvoiceForm(false);
      toastSuccess(copy.invoiceSubmitted);
    } catch (e) {
      toastError(isCn ? '开票申请提交失败：' : 'Invoice request failed: ' + e.message);
    } finally {
      setInvoiceSubmitting(false);
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
            <div className="py-6 space-y-3">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle size={36} className="text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-950">{copy.received}</h3>
              </div>
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
              {!isCn && result?.payment_method === 'paypal_card' && (
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
              {isCn && cnBankInfoDisplay()}
              <p className="text-xs text-slate-500">{copy.followup}</p>

              {/* Invoice request section */}
              {isCn && !existingInvoice && !invoiceSubmitted && showInvoiceForm && (
                <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                    <FileText size={16} />
                    {copy.invoiceTitle}
                  </div>
                  <p className="text-xs text-slate-500">{copy.invoiceDesc}</p>
                  {[
                    { key: 'company_name', label: copy.invoiceCompanyName, required: true },
                    { key: 'tax_id', label: copy.invoiceTaxId, required: true },
                    { key: 'company_address', label: copy.invoiceAddress },
                    { key: 'company_phone', label: copy.invoicePhone },
                    { key: 'bank_name', label: copy.invoiceBankName },
                    { key: 'bank_account', label: copy.invoiceBankAccount },
                  ].map((field) => (
                    <input
                      key={field.key}
                      type="text"
                      value={invoiceData[field.key]}
                      onChange={(e) => setInvoiceData({ ...invoiceData, [field.key]: e.target.value })}
                      placeholder={`${field.label}${field.required ? ' *' : ''}`}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-950 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none"
                    />
                  ))}
                  <textarea
                    value={invoiceData.notes}
                    onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
                    placeholder={copy.invoiceNote}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-950 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleInvoiceSubmit}
                      disabled={invoiceSubmitting}
                      className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {invoiceSubmitting ? copy.titleProcessing : copy.invoiceBtn}
                    </button>
                    <button
                      onClick={() => setShowInvoiceForm(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      {copy.invoiceSkip}
                    </button>
                  </div>
                </div>
              )}
              {isCn && existingInvoice && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                  <div className="flex items-center gap-2 font-medium text-blue-950 mb-1">
                    <FileText size={16} />
                    发票申请
                  </div>
                  <p>状态：{existingInvoice.status === 'issued' ? '已开票' : '待处理'}</p>
                  {existingInvoice.invoice_number && <p>发票号码：{existingInvoice.invoice_number}</p>}
                  {existingInvoice.company_name && <p>公司：{existingInvoice.company_name}</p>}
                </div>
              )}
              {isCn && invoiceSubmitted && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-900 flex items-center gap-2">
                  <CheckCircle size={14} />
                  {copy.invoiceSubmitted}
                </div>
              )}

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

              {isCn && cnBankInfoDisplay()}

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
