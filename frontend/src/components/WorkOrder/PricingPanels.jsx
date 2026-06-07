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

export function PricingStatusBadge({ status }) {
  const map = {
    draft: { text: 'Draft / Negotiating', color: 'bg-gray-500', bg: 'bg-gray-500/10' },
    pending_review: { text: 'SAGEMRO Review', color: 'bg-amber-500', bg: 'bg-amber-500/10' },
    submitted: { text: 'Submitted, Awaiting Confirmation', color: 'bg-purple-500', bg: 'bg-purple-500/10' },
    confirmed: { text: 'Confirmed', color: 'bg-green-500', bg: 'bg-green-500/10' },
  };
  const c = map[status] || map.draft;
  return (
    <span className={`px-2 py-0.5 text-xs text-white rounded ${c.color}`}>{c.text}</span>
  );
}

export function AIPriceCheck({ check }) {
  if (!check) return null;
  let data;
  try { data = typeof check === 'string' ? JSON.parse(check) : check; } catch { return null; }
  const map = {
    reasonable: { text: 'Price is reasonable', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
    high: { text: 'Price is on the high side', icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    low: { text: 'Price is on the low side', icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
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
      toastSuccess('Quote submitted for SAGEMRO official review.');
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
      <div className="text-xs text-[var(--color-text-muted)]">Fill in the fee details as an internal quote proposal. SAGEMRO operations will review it before the customer sees an official quote.</div>
      <div className="grid grid-cols-2 gap-3">
        {field('labor_fee', 'Labor Fee', 'Hours × Rate')}
        {field('parts_fee', 'Parts Fee', 'Total parts cost')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('travel_fee', 'Travel Fee', 'Transport + Accommodation')}
        {field('other_fee', 'Other Fees', 'Miscellaneous')}
      </div>
      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Parts Detail (Optional)</label>
        <textarea
          value={form.parts_detail}
          onChange={(e) => setForm({ ...form, parts_detail: e.target.value })}
          placeholder="e.g. Laser lens × 1, unit price 800 CNY"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
        />
      </div>
      {/* 费用汇总 */}
      <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Labor Fee</span><span>{form.labor_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Parts Fee</span><span>{form.parts_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Travel Fee</span><span>{form.travel_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Other Fees</span><span>{form.other_fee || 0} CNY</span></div>
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5"><span className="text-[var(--color-text-secondary)]">Quote Subtotal (Customer Pays)</span><span className="font-medium">{subtotal} CNY</span></div>
        <div className="flex justify-between font-semibold text-[var(--color-primary)]">
          <span>Internal Settlement Estimate</span>
          <span>{internalEstimate} CNY</span>
        </div>
      </div>
      <button
        data-testid="submit-pricing-button"
        onClick={handleSubmit}
        disabled={submitting || subtotal === 0}
        className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-medium"
      >
        {submitting ? 'Submitting...' : 'Submit for SAGEMRO Review'}
      </button>
    </div>
  );
}

// ========== 报价确认区（客户查看） ==========
export function CustomerPricingPanel({ workOrderId, customerId, onConfirmed }) {
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
      toastSuccess('Quote confirmed. SAGEMRO will proceed with service scheduling.');
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
    if (!rejectReason.trim()) { toastWarning('Please enter a reason for negotiation'); return; }
    setSubmitting(true);
    try {
      await rejectWorkOrderPricing(workOrderId, customerId, rejectReason, counterOffer ? parseInt(counterOffer) : null);
      toastSuccess('Negotiation initiated. SAGEMRO will review and submit a revised quote.');
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
        SAGEMRO is preparing the official quote. You will be notified once diagnosis, scope, and safety requirements are reviewed.
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
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Labor Fee</span><span>{pricing.labor_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Parts Fee</span><span>{pricing.parts_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Travel Fee</span><span>{pricing.travel_fee || 0} CNY</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Other Fees</span><span>{pricing.other_fee || 0} CNY</span></div>
        {pricing.parts_detail && pricing.parts_detail !== '[]' && pricing.parts_detail !== '' && (
          <div className="text-xs text-[var(--color-text-secondary)] pt-1 border-t border-[var(--color-border)]">
            Parts Detail: {(() => { try { return JSON.parse(pricing.parts_detail).map(p => `${p.name || 'Part'} ${p.qty || 1}×${p.unit_price || 0} CNY`).join('; '); } catch { return pricing.parts_detail; } })()}
          </div>
        )}
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5"><span className="text-[var(--color-text-secondary)]">Quote Subtotal</span><span className="font-medium">{pricing.subtotal || 0} CNY</span></div>
        {/* Legacy platform fee fields are not exposed as marketplace fees in Service OS. */}
        {pricing.platform_fee > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Service Fee</span>
              <span>{(pricing.subtotal || 0) - (pricing.platform_fee || 0)} CNY</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">SAGEMRO Service Management Fee</span>
              <span>{pricing.platform_fee} CNY</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-semibold text-base text-[var(--color-primary)]">
          <span>Total Payable</span><span>{pricing.total_amount || pricing.subtotal || 0} CNY</span>
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
            Confirm Quote
          </button>
          <button
            onClick={() => setAction('reject')}
            className="flex-1 py-2.5 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl font-medium"
          >
            Negotiate
          </button>
        </div>
      )}

      {action === 'reject' && (
        <div className="space-y-2 p-3 bg-[var(--color-surface-elevated)] rounded-xl">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Please explain your reason for negotiation..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
          <input
            type="number"
            value={counterOffer}
            onChange={(e) => setCounterOffer(e.target.value)}
            data-testid="counter-offer-input"
            placeholder="Your expected price (CNY, optional)"
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <div className="flex gap-2">
            <button onClick={() => setAction(null)} className="flex-1 py-2 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl text-sm">Cancel</button>
            <button data-testid="reject-pricing-button" onClick={handleReject} disabled={submitting} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm">
              {submitting ? 'Submitting...' : 'Negotiate'}
            </button>
          </div>
        </div>
      )}

      {action === 'confirm' && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl space-y-2">
          <div className="text-sm text-[var(--color-text-primary)]">After confirmation, SAGEMRO will begin service scheduling.</div>
          <div className="flex gap-2">
            <button onClick={() => setAction(null)} className="flex-1 py-2 bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] rounded-xl text-sm">Cancel</button>
            <button data-testid="confirm-pricing-button" onClick={handleConfirm} disabled={submitting} className="flex-1 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm">
              {submitting ? 'Confirming...' : 'Confirm Quote'}
            </button>
          </div>
        </div>
      )}

      {pricing.status === 'confirmed' && (
        <div className="space-y-3">
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-center text-sm text-green-500">
            ✓ Quote Confirmed
          </div>
          <button
            onClick={() => setPaymentOpen(true)}
            className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-semibold text-sm transition-colors"
          >
            Proceed to Payment ({(pricing.total_amount || pricing.subtotal || 0).toLocaleString()} CNY)
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
