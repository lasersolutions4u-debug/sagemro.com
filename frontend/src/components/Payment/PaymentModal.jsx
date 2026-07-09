import { useState, useEffect } from 'react';
import { X, CheckCircle, CreditCard, Building2, Shield, Loader2, Send } from 'lucide-react';
import { getWorkOrderPricing, getWorkOrderPayment, payWorkOrder, getWorkOrder } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';

const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Bank Transfer / Wire Transfer', icon: Building2, desc: 'Best for formal B2B payments and larger orders.' },
  { id: 'paypal_card', label: 'PayPal / Credit or Debit Card', icon: CreditCard, desc: 'Pay securely by PayPal invoice. No PayPal account is required for eligible card payments.' },
];

const CURRENCY = 'USD';

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
      toastSuccess('Payment method confirmed. SAGEMRO will provide payment instructions.');
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {step === 'processing' ? 'Confirming...' : step === 'submitted' ? 'Payment Follow-up' : 'Confirm Payment Method'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : step === 'processing' ? (
            <div className="text-center py-8 space-y-3">
              <Loader2 size={48} className="animate-spin mx-auto text-[var(--color-primary)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">Confirming payment method...</p>
            </div>
          ) : step === 'submitted' ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
                <CheckCircle size={36} className="text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Payment method received</h3>
              <div className="bg-[var(--color-surface-elevated)] rounded-xl p-3 space-y-1.5 text-sm text-left">
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--color-text-secondary)]">Amount</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">{result?.amount?.toLocaleString() || amount.toLocaleString()} {CURRENCY}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--color-text-secondary)]">Payment Method</span>
                  <span className="text-[var(--color-text-primary)] text-right">{PAYMENT_METHODS.find(m => m.id === result?.payment_method)?.label || 'Bank Transfer'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--color-text-secondary)]">Status</span>
                  <span className="text-[var(--color-text-primary)] text-right">{paymentStatusCopy(result?.status)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--color-text-secondary)]">Order No</span>
                  <span className="text-[var(--color-text-primary)]">{order?.order_no || workOrderId?.slice(0, 14)}</span>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">The assigned engineer will follow up collection. Service starts only after Admin confirms receipt.</p>
              <button onClick={onClose} className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium text-sm">
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="bg-[var(--color-surface-elevated)] rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Order No</span>
                  <span className="text-[var(--color-text-primary)]">{order?.order_no || workOrderId?.slice(0, 14)}</span>
                </div>
                <div className="border-t border-[var(--color-border)] pt-1.5 flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Amount</span>
                  <span className="text-lg font-bold text-[var(--color-text-primary)]">{amount.toLocaleString()} {CURRENCY}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-2">Select Payment Method</label>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    const selected = method === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          selected
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                            : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selected ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]'}`}>
                          <Icon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">{m.label}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{m.desc}</div>
                        </div>
                        {selected && <CheckCircle size={18} className="text-[var(--color-primary)]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                <Shield size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-[var(--color-text-secondary)]">
                  <p className="font-medium text-[var(--color-text-primary)] mb-0.5">Payment Notice</p>
                  <p>SAGEMRO will send bank transfer details or a secure PayPal invoice/payment link. The engineer follows up collection, then requests Admin approval to start service.</p>
                </div>
              </div>

              <button
                onClick={handlePay}
                disabled={submitting}
                className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Send size={20} />
                {submitting ? 'Confirming...' : 'Request Payment Instructions'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
