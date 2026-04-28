import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import {
  getWorkOrderPricing,
  submitWorkOrderPricing,
  confirmWorkOrderPricing,
  rejectWorkOrderPricing,
} from '../../services/api';
import { toastSuccess, toastError, toastWarning } from '../../utils/feedback';

export function PricingStatusBadge({ status }) {
  const map = {
    draft: { text: '草稿/议价中', color: 'bg-gray-500', bg: 'bg-gray-500/10' },
    submitted: { text: '已提交待确认', color: 'bg-purple-500', bg: 'bg-purple-500/10' },
    confirmed: { text: '已确认', color: 'bg-green-500', bg: 'bg-green-500/10' },
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
    reasonable: { text: '价格合理', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
    high: { text: '价格偏高', icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    low: { text: '价格偏低', icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
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

// ========== 核价区（合伙人填写） ==========
export function EngineerPricingPanel({ workOrderId, engineerId, onSubmitted, commissionRate = 0.80, engineerLevel = 'junior' }) {
  const [form, setForm] = useState({ labor_fee: '', parts_fee: '', travel_fee: '', other_fee: '', parts_detail: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submittingPrice, setSubmittingPrice] = useState(null);

  const subtotal = (parseInt(form.labor_fee) || 0) + (parseInt(form.parts_fee) || 0) + (parseInt(form.travel_fee) || 0) + (parseInt(form.other_fee) || 0);
  // 代收代付模式：平台代收全款，扣除技术服务费后转付维修服务费给工程师
  const platformFee = Math.round(subtotal * (1 - commissionRate)); // 平台技术服务费（平台营收）
  const serviceFee = subtotal - platformFee;                        // 维修服务费（代收代付，转付工程师）
  const depositWithhold = Math.round(subtotal * 0.05);             // 动态保证金 5%

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmittingPrice(subtotal);
    try {
      await submitWorkOrderPricing(workOrderId, {
        labor_fee: parseInt(form.labor_fee) || 0,
        parts_fee: parseInt(form.parts_fee) || 0,
        travel_fee: parseInt(form.travel_fee) || 0,
        other_fee: parseInt(form.other_fee) || 0,
        parts_detail: form.parts_detail,
        engineer_id: engineerId,
      });
      toastSuccess('报价已提交，等待客户确认');
      onSubmitted?.();
    } catch (e) {
      toastError('提交失败: ' + e.message);
    } finally {
      setSubmitting(false);
      setSubmittingPrice(null);
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
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">元</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--color-text-muted)]">填写各项费用，系统将自动计算平台技术服务费和工程师实得。</div>
      <div className="grid grid-cols-2 gap-3">
        {field('labor_fee', '人工费', '工时 × 单价')}
        {field('parts_fee', '配件费', '配件费用合计')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('travel_fee', '差旅费', '交通 + 住宿')}
        {field('other_fee', '其他费用', '其他杂项')}
      </div>
      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">配件明细说明（选填）</label>
        <textarea
          value={form.parts_detail}
          onChange={(e) => setForm({ ...form, parts_detail: e.target.value })}
          placeholder="如：激光器镜片 × 1，单价800元"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
        />
      </div>
      {/* 费用汇总 */}
      <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">人工费</span><span>{form.labor_fee || 0} 元</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">配件费</span><span>{form.parts_fee || 0} 元</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">差旅费</span><span>{form.travel_fee || 0} 元</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">其他费用</span><span>{form.other_fee || 0} 元</span></div>
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5"><span className="text-[var(--color-text-secondary)]">报价小计</span><span className="font-medium">{subtotal} 元</span></div>
        {/* 代收代付模式费用拆分 */}
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">平台技术服务费（{Math.round((1-commissionRate)*100)}%）</span><span className="text-orange-500">-{platformFee} 元</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">动态保证金（5%）</span><span className="text-blue-500">-{depositWithhold} 元</span></div>
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5 font-semibold">
          <span className="text-[var(--color-text-primary)]">工程师实得（维修服务费）</span>
          <span className="text-[var(--color-primary)]">{serviceFee} 元</span>
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={submitting || subtotal === 0}
        className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-medium"
      >
        {submitting ? '提交中...' : '提交报价'}
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
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    getWorkOrderPricing(workOrderId).then(d => {
      setPricing(d.pricing);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [workOrderId]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await confirmWorkOrderPricing(workOrderId, customerId);
      toastSuccess('报价已确认，等待工程师上门服务');
      onConfirmed?.();
      load();
    } catch (e) {
      toastError('确认失败: ' + e.message);
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toastWarning('请输入议价原因'); return; }
    setSubmitting(true);
    try {
      await rejectWorkOrderPricing(workOrderId, customerId, rejectReason);
      toastSuccess('已发起议价，工程师会重新报价');
      onConfirmed?.();
      load();
    } catch (e) {
      toastError('操作失败: ' + e.message);
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  if (loading) return <div className="text-center py-4 text-sm text-[var(--color-text-muted)]">加载中...</div>;

  if (!pricing) return <div className="text-center py-4 text-sm text-[var(--color-text-muted)]">工程师尚未提交报价</div>;

  let aiCheck = null;
  try { aiCheck = pricing.ai_price_check ? JSON.parse(pricing.ai_price_check) : null; } catch {}

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PricingStatusBadge status={pricing.status} />
      </div>

      {/* 费用明细 */}
      <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">人工费</span><span>{pricing.labor_fee || 0} 元</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">配件费</span><span>{pricing.parts_fee || 0} 元</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">差旅费</span><span>{pricing.travel_fee || 0} 元</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">其他费用</span><span>{pricing.other_fee || 0} 元</span></div>
        {pricing.parts_detail && pricing.parts_detail !== '[]' && pricing.parts_detail !== '' && (
          <div className="text-xs text-[var(--color-text-secondary)] pt-1 border-t border-[var(--color-border)]">
            配件明细：{(() => { try { return JSON.parse(pricing.parts_detail).map(p => `${p.name || '配件'} ${p.qty || 1}×${p.unit_price || 0}元`).join('；'); } catch { return pricing.parts_detail; } })()}
          </div>
        )}
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5"><span className="text-[var(--color-text-secondary)]">报价小计</span><span className="font-medium">{pricing.subtotal || 0} 元</span></div>
        {/* 代收代付模式：分别展示维修服务费和平台技术服务费 */}
        {pricing.platform_fee > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">维修服务费（支付给工程师）</span>
              <span>{(pricing.subtotal || 0) - (pricing.platform_fee || 0)} 元</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">平台技术服务费</span>
              <span>{pricing.platform_fee} 元</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-semibold text-base text-[var(--color-primary)]">
          <span>合计应付</span><span>{pricing.total_amount || pricing.subtotal || 0} 元</span>
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
            确认报价
          </button>
          <button
            onClick={() => setAction('reject')}
            className="flex-1 py-2.5 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl font-medium"
          >
            议价
          </button>
        </div>
      )}

      {action === 'reject' && (
        <div className="space-y-2 p-3 bg-[var(--color-surface-elevated)] rounded-xl">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="请说明议价原因..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setAction(null)} className="flex-1 py-2 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl text-sm">取消</button>
            <button onClick={handleReject} disabled={submitting} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm">
              {submitting ? '提交中...' : '发起议价'}
            </button>
          </div>
        </div>
      )}

      {action === 'confirm' && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl space-y-2">
          <div className="text-sm text-[var(--color-text-primary)]">确认后工程师将开始上门服务。</div>
          <div className="flex gap-2">
            <button onClick={() => setAction(null)} className="flex-1 py-2 bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] rounded-xl text-sm">取消</button>
            <button onClick={handleConfirm} disabled={submitting} className="flex-1 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm">
              {submitting ? '确认中...' : '确认报价'}
            </button>
          </div>
        </div>
      )}

      {pricing.status === 'confirmed' && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-center text-sm text-green-500">
          ✓ 报价已确认，工程师将上门服务
        </div>
      )}
    </div>
  );
}
