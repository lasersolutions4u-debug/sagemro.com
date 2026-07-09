import { useState, useEffect } from 'react';
import { X, CheckCircle, CreditCard, Building2, Shield, Loader2, Send } from 'lucide-react';
import { getWorkOrderPricing, getWorkOrderPayment, payWorkOrder, getWorkOrder } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';

const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Bank Transfer / Wire Transfer', icon: Building2, desc: 'Request TT bank details, then send the bank slip to the engineer in Messages.' },
  { id: 'paypal_card', label: 'PayPal / Credit or Debit Card', icon: CreditCard, desc: 'Pay through the official PayPal page, then send the payment screenshot in Messages.' },
];

const CURRENCY = 'USD';
const PAYPAL_PAYMENT_LINK = 'https://www.paypal.com/ncp/payment/4YLFXRSUSZJ5N';

function paymentStatusCopy(status) {
  const map = {
    instructions_requested: 'Payment instructions requested',
    pending_admin_confirmation: 'Waiting for Admin payment confirmation',
    completed: 'Payment confirmed by SAGEMRO',
  };
  return map[status] || status || 'Payment follow-up pending';
}

export function PaymentModal({ isOpen, onClose, workOrderId, customerId, onPaid }) {
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
  const MethodIcon = PAYMENT_METHODS.find(m => m.id === method)?.icon || Building2;

  const handlePay = async () => {
    setSubmitting(true);
    setStep('processing');
    try {
      const res = await payWorkOrder(workOrderId, { payment_method: method });
      setResult(res.payment);
      setStep('submitted');
      if (method === 'paypal_card') {
        window.open(PAYPAL_PAYMENT_LINK, '_blank', 'noopener,noreferrer');
        toastSuccess('Payment method confirmed. PayPal opened in a new tab. Please send the payment screenshot in Messages after payment.');
      } else {
        toastSuccess('Payment method confirmed. Please send the payment proof to the engineer in Messages after payment.');
      }
      onPaid?.();
    } catch (e) {
      toastError('Payment method confirmation failed: ' + e.message);
      setStep('pay');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-950">
            {step === 'processing' ? 'Confirming...' : step === 'submitted' ? 'Payment Follow-up' : 'Confirm Payment Method'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : step === 'processing' ? (
            <div className="text-center py-8 space-y-3">
              <Loader2 size={48} className="mx-auto animate-spin text-amber-500" />
              <p className="text-sm text-slate-600">Confirming payment method...</p>
            </div>
          ) : step === 'submitted' ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
                <CheckCircle size={36} className="text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">Payment method received</h3>
              <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-left text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-semibold text-slate-950">{result?.amount?.toLocaleString() || amount.toLocaleString()} {CURRENCY}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Payment Method</span>
                  <span className="text-right text-slate-950">{PAYMENT_METHODS.find(m => m.id === result?.payment_method)?.label || 'Bank Transfer'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Status</span>
                  <span className="text-right text-slate-950">{paymentStatusCopy(result?.status)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Order No</span>
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
                  Open PayPal Payment Page
                </a>
              )}
              <p className="text-xs text-slate-500">Please complete payment, then send the bank slip or PayPal screenshot to the engineer in Messages. Service starts only after Admin confirms receipt.</p>
              <button onClick={onClose} className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600">
                Go to Messages
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order No</span>
                  <span className="text-slate-950">{order?.order_no || workOrderId?.slice(0, 14)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500">Amount</span>
                  <span className="text-lg font-bold text-slate-950">{amount.toLocaleString()} {CURRENCY}</span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500">Select Payment Method</label>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    const selected = method === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
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
                  <p className="mb-0.5 font-medium text-blue-950">Payment Notice</p>
                  <p>TT users receive bank details. PayPal users will be sent to SAGEMRO's official PayPal payment page. After payment, send the proof screenshot in Messages.</p>
                </div>
              </div>

              <button
                onClick={handlePay}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                <Send size={20} />
                {submitting ? 'Confirming...' : method === 'paypal_card' ? 'Continue with PayPal Instructions' : 'Request TT Instructions'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
