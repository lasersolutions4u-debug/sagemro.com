import { useState, useEffect } from 'react';
import { X, CheckCircle, CreditCard, Building2, Smartphone, Shield, Loader2 } from 'lucide-react';
import { getWorkOrderPricing, getWorkOrderPayment, payWorkOrder, getWorkOrder } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

const PAYMENT_METHODS = {
  cn: [
    { id: 'bank_transfer', label: '对公转账', icon: Building2, desc: '模拟企业对公转账' },
    { id: 'alipay', label: '支付宝', icon: CreditCard, desc: '模拟支付宝付款' },
    { id: 'wechat', label: '微信支付', icon: Smartphone, desc: '模拟微信支付' },
  ],
  en: [
    { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2, desc: 'Simulated corporate bank transfer' },
    { id: 'alipay', label: 'Alipay', icon: CreditCard, desc: 'Simulated Alipay payment' },
    { id: 'wechat', label: 'WeChat Pay', icon: Smartphone, desc: 'Simulated WeChat Pay' },
  ],
};

const COPY = {
  cn: {
    paymentSuccessfulToast: '付款成功',
    paymentFailed: '付款失败',
    headerProcessing: '处理中...',
    headerSuccess: '付款成功',
    headerAlreadyPaid: '已付款',
    headerConfirm: '确认付款',
    loading: '加载中...',
    processingText: '正在处理付款，请稍候...',
    simulatedNotice: '这是用于演示服务流程的模拟付款环境，不会发生真实资金转移。',
    amount: '金额',
    paymentMethod: '付款方式',
    transactionId: '交易编号',
    orderNo: '订单编号',
    scheduleAfterPayment: 'SAGEMRO 会在付款确认后安排服务。',
    done: '完成',
    alreadyPaid: '该订单已付款',
    close: '关闭',
    selectMethod: '选择付款方式',
    paymentNotice: '付款说明',
    paymentNoticeText: '这是用于演示服务流程的模拟付款环境。正式付款条款以 SAGEMRO 确认为准。',
    pay: (amount) => `支付 ${amount.toLocaleString()} CNY`,
    processing: '处理中...',
    fallbackMethod: '对公转账',
  },
  en: {
    paymentSuccessfulToast: 'Payment successful',
    paymentFailed: 'Payment failed',
    headerProcessing: 'Processing...',
    headerSuccess: 'Payment Successful',
    headerAlreadyPaid: 'Already Paid',
    headerConfirm: 'Confirm Payment',
    loading: 'Loading...',
    processingText: 'Processing payment, please wait...',
    simulatedNotice: 'This is a simulated payment environment. No real funds will be transferred.',
    amount: 'Amount',
    paymentMethod: 'Payment Method',
    transactionId: 'Transaction ID',
    orderNo: 'Order No',
    scheduleAfterPayment: 'SAGEMRO will schedule service after payment confirmation.',
    done: 'Done',
    alreadyPaid: 'This order has been paid',
    close: 'Close',
    selectMethod: 'Select Payment Method',
    paymentNotice: 'Payment Notice',
    paymentNoticeText: 'This is a simulated payment environment for demonstrating the service flow. Formal payment terms are subject to SAGEMRO confirmation.',
    pay: (amount) => `Pay ${amount.toLocaleString()} CNY`,
    processing: 'Processing...',
    fallbackMethod: 'Bank Transfer',
  },
};

export function PaymentModal({ isOpen, onClose, workOrderId, customerId, onPaid }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const methods = isCn ? PAYMENT_METHODS.cn : PAYMENT_METHODS.en;
  const [step, setStep] = useState('pay'); // pay | processing | success | already_paid
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
        setStep('already_paid');
        setResult(paymentRes.payment);
      }
      setPricing(pricingRes?.pricing || null);
      setOrder(orderRes);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isOpen, workOrderId]);

  const amount = pricing?.total_amount || pricing?.subtotal || 0;
  const MethodIcon = methods.find(m => m.id === method)?.icon || Building2;

  const handlePay = async () => {
    setSubmitting(true);
    setStep('processing');
    try {
      const res = await payWorkOrder(workOrderId, { payment_method: method });
      setResult(res.payment);
      setStep('success');
      toastSuccess(copy.paymentSuccessfulToast);
      onPaid?.();
    } catch (e) {
      toastError(`${copy.paymentFailed}: ${e.message}`);
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {step === 'processing' ? copy.headerProcessing : step === 'success' ? copy.headerSuccess : step === 'already_paid' ? copy.headerAlreadyPaid : copy.headerConfirm}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              {copy.loading}
            </div>
          ) : step === 'processing' ? (
            <div className="text-center py-8 space-y-3">
              <Loader2 size={48} className="animate-spin mx-auto text-[var(--color-primary)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">{copy.processingText}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{copy.simulatedNotice}</p>
            </div>
          ) : step === 'success' ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle size={36} className="text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{copy.headerSuccess}</h3>
              <div className="bg-[var(--color-surface-elevated)] rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">{copy.amount}</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">{result?.amount?.toLocaleString() || amount.toLocaleString()} CNY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">{copy.paymentMethod}</span>
                  <span className="text-[var(--color-text-primary)]">{methods.find(m => m.id === result?.payment_method)?.label || copy.fallbackMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">{copy.transactionId}</span>
                  <span className="text-[var(--color-text-primary)] font-mono text-xs">{result?.transaction_id || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">{copy.orderNo}</span>
                  <span className="text-[var(--color-text-primary)]">{order?.order_no || workOrderId?.slice(0, 14)}</span>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">{copy.scheduleAfterPayment}</p>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium text-sm"
              >
                {copy.done}
              </button>
            </div>
          ) : step === 'already_paid' ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle size={36} className="text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{copy.alreadyPaid}</h3>
              <div className="bg-[var(--color-surface-elevated)] rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">{copy.amount}</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">{result?.amount?.toLocaleString()} CNY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">{copy.transactionId}</span>
                  <span className="text-[var(--color-text-primary)] font-mono text-xs">{result?.transaction_id}</span>
                </div>
              </div>
              <button onClick={onClose} className="w-full py-2.5 bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] rounded-xl font-medium text-sm">{copy.close}</button>
            </div>
          ) : (
            <>
              {/* 订单摘要 */}
              <div className="bg-[var(--color-surface-elevated)] rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">{copy.orderNo}</span>
                  <span className="text-[var(--color-text-primary)]">{order?.order_no || workOrderId?.slice(0, 14)}</span>
                </div>
                <div className="border-t border-[var(--color-border)] pt-1.5 flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">{copy.amount}</span>
                  <span className="text-lg font-bold text-[var(--color-text-primary)]">{amount.toLocaleString()} CNY</span>
                </div>
              </div>

              {/* 付款方式选择 */}
              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-2">{copy.selectMethod}</label>
                <div className="space-y-2">
                  {methods.map((m) => {
                    const Icon = m.icon;
                    const selected = method === m.id;
                    return (
                      <button
                        key={m.id}
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
                        <div>
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">{m.label}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{m.desc}</div>
                        </div>
                        {selected && (
                          <div className="ml-auto w-4 h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                            <CheckCircle size={12} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 安全提示 */}
              <div className="flex items-start gap-2 p-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                <Shield size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-[var(--color-text-secondary)]">
                  <p className="font-medium text-[var(--color-text-primary)] mb-0.5">{copy.paymentNotice}</p>
                  <p>{copy.paymentNoticeText}</p>
                </div>
              </div>

              {/* 付款按钮 */}
              <button
                onClick={handlePay}
                disabled={submitting}
                className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <MethodIcon size={20} />
                {submitting ? copy.processing : copy.pay(amount)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
