import { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Star, Send, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import {
  getWorkOrder,
  getWorkOrderMessages,
  postWorkOrderMessage,
  getWorkOrderPricing,
  submitWorkOrderPricing,
  confirmWorkOrderPricing,
  rejectWorkOrderPricing,
  submitRating,
  resolveWorkOrder,
} from '../../services/api';
import { PartnerLevelLabels } from '../../types';

const statusConfig = {
  pending: { text: '待处理', color: 'bg-blue-500' },
  assigned: { text: '已分配', color: 'bg-yellow-500' },
  in_progress: { text: '处理中', color: 'bg-orange-500' },
  pricing: { text: '等待报价确认', color: 'bg-purple-500' },
  in_service: { text: '服务中', color: 'bg-cyan-500' },
  resolved: { text: '已解决', color: 'bg-green-500' },
  pending_review: { text: '待评价', color: 'bg-teal-500' },
  completed: { text: '已完成', color: 'bg-gray-500' },
  rejected: { text: '已拒绝', color: 'bg-red-500' },
  cancelled: { text: '已取消', color: 'bg-gray-400' },
};

const urgencyConfig = {
  normal: { text: '普通', color: 'text-gray-500' },
  urgent: { text: '紧急', color: 'text-orange-500' },
  critical: { text: '非常紧急', color: 'text-red-500' },
};

const typeLabels = {
  fault: '设备故障',
  maintenance: '维护保养',
  parameter: '参数调试',
  consult: '技术咨询',
  parts: '配件采购',
  aftersales: '售后服务',
  other: '其他',
};

function Stars({ value, onChange, readonly }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
          className={`p-0.5 ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
        >
          <Star
            size={16}
            className={star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
          />
        </button>
      ))}
    </div>
  );
}

function PricingStatusBadge({ status }) {
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

function AIPriceCheck({ check }) {
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

// ========== 消息对话区 ==========
function MessagePanel({ workOrderId, userType, userId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => {
    getWorkOrderMessages(workOrderId).then(d => {
      setMessages(d.list || []);
    }).catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [workOrderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await postWorkOrderMessage(workOrderId, {
        sender_type: userType,
        sender_id: userId,
        content: input.trim(),
        message_type: 'text',
      });
      setInput('');
      load();
    } catch (e) {
      alert('发送失败: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="max-h-64 overflow-y-auto space-y-2 p-2 bg-[var(--color-surface-elevated)] rounded-xl">
        {messages.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--color-text-muted)]">暂无消息，开始对话吧</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_type === userType;
            const isSystem = msg.sender_type === 'system';
            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)] px-3 py-1 rounded-full">
                    {msg.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-[var(--color-primary)] text-white rounded-br-md'
                    : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] rounded-bl-md'
                }`}>
                  {!isMe && msg.sender_name && (
                    <div className="text-xs opacity-70 mb-0.5">{msg.sender_name}</div>
                  )}
                  <div>{msg.content}</div>
                  <div className={`text-xs mt-1 ${isMe ? 'text-white/50 text-right' : 'text-[var(--color-text-muted)]'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
          className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="px-3 py-2 bg-[var(--color-primary)] disabled:opacity-40 text-white rounded-xl"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ========== 核价区（合伙人填写） ==========
function EngineerPricingPanel({ workOrderId, engineerId, onSubmitted, commissionRate = 0.80, engineerLevel = 'junior' }) {
  const [form, setForm] = useState({ labor_fee: '', parts_fee: '', travel_fee: '', other_fee: '', parts_detail: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submittingPrice, setSubmittingPrice] = useState(null);

  const subtotal = (parseInt(form.labor_fee) || 0) + (parseInt(form.parts_fee) || 0) + (parseInt(form.travel_fee) || 0) + (parseInt(form.other_fee) || 0);
  // V2佣金体系：合伙人承担平台佣金（从实得中扣）
  const platformFee = Math.round(subtotal * (1 - commissionRate)); // 平台服务费
  const depositWithhold = Math.round(subtotal * 0.05);             // 动态保证金 5%
  const engineerPayout = Math.round(subtotal * commissionRate);    // 合伙人实得

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
      alert('报价已提交，等待客户确认');
      onSubmitted?.();
    } catch (e) {
      alert('提交失败: ' + e.message);
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
      <div className="text-xs text-[var(--color-text-muted)]">填写各项费用，系统将自动计算含佣金（5%）的最终报价。</div>
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
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5"><span className="text-[var(--color-text-secondary)]">小计</span><span className="font-medium">{subtotal} 元</span></div>
        {/* V2佣金体系 */}
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">平台服务费（{Math.round((1-commissionRate)*100)}%）</span><span className="text-orange-500">-{platformFee} 元</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">动态保证金（5%）</span><span className="text-blue-500">-{depositWithhold} 元</span></div>
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5 font-semibold">
          <span className="text-[var(--color-text-primary)]">合伙人实得</span>
          <span className="text-[var(--color-primary)]">{engineerPayout} 元</span>
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
function CustomerPricingPanel({ workOrderId, customerId, onConfirmed }) {
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
      alert('报价已确认，等待合伙人上门服务');
      onConfirmed?.();
      load();
    } catch (e) {
      alert('确认失败: ' + e.message);
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { alert('请输入议价原因'); return; }
    setSubmitting(true);
    try {
      await rejectWorkOrderPricing(workOrderId, customerId, rejectReason);
      alert('已发起议价，合伙人会重新报价');
      onConfirmed?.();
      load();
    } catch (e) {
      alert('操作失败: ' + e.message);
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  if (loading) return <div className="text-center py-4 text-sm text-[var(--color-text-muted)]">加载中...</div>;

  if (!pricing) return <div className="text-center py-4 text-sm text-[var(--color-text-muted)]">合伙人尚未提交报价</div>;

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
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5"><span className="text-[var(--color-text-secondary)]">小计</span><span className="font-medium">{pricing.subtotal || 0} 元</span></div>
        {/* V2佣金体系：客户支付全包价，合伙人承担平台服务费 */}
        <div className="flex justify-between font-semibold text-base text-[var(--color-primary)]">
          <span>合计（合伙人全包价）</span><span>{pricing.total_amount || pricing.subtotal || 0} 元</span>
        </div>
        {pricing.platform_fee > 0 && (
          <div className="text-xs text-[var(--color-text-muted)] text-right]">
            含平台服务费 {pricing.platform_fee} 元（由合伙人承担）
          </div>
        )}
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
          <div className="text-sm text-[var(--color-text-primary)]">确认后合伙人将开始上门服务。</div>
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
          ✓ 报价已确认，合伙人将上门服务
        </div>
      )}
    </div>
  );
}

// ========== 主组件 ==========
export function WorkOrderDetailModal({ isOpen, onClose, workOrder, onRateSuccess, onConfirmed, userType, userId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('info');
  const [showRating, setShowRating] = useState(false);
  const [ratings, setRatings] = useState({ timeliness: 5, technical: 5, communication: 5, professional: 5 });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && workOrder?.id) {
      loadDetail();
      setTab('info');
    }
  }, [isOpen, workOrder]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await getWorkOrder(workOrder.id);
      setDetail(data);
    } catch (e) {
      console.error('加载工单详情失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!detail?.engineer_id || !detail?.customer_id) { alert('工单信息不完整'); return; }
    setSubmitting(true);
    try {
      await submitRating({
        work_order_id: detail.id,
        engineer_id: detail.engineer_id,
        customer_id: detail.customer_id,
        rating_timeliness: ratings.timeliness,
        rating_technical: ratings.technical,
        rating_communication: ratings.communication,
        rating_professional: ratings.professional,
        comment,
      });
      setShowRating(false);
      onRateSuccess?.();
      loadDetail();
    } catch (e) {
      alert('评价提交失败: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!workOrder) return null;

  const status = statusConfig[workOrder.status] || { text: workOrder.status, color: 'bg-gray-500' };
  const urgency = urgencyConfig[workOrder.urgency] || urgencyConfig.normal;
  const isEngineer = userType === 'engineer';
  const isCustomer = userType === 'customer';

  const tabs = [
    { key: 'info', label: '工单信息' },
    { key: 'messages', label: '消息对话' },
  ];

  // 核价Tab：合伙人看表单，客户看报价确认
  if (workOrder.status === 'in_progress' || workOrder.status === 'pricing' || workOrder.status === 'in_service') {
    tabs.push({ key: 'pricing', label: isEngineer ? '核价' : '报价确认' });
  }

  const renderInfoTab = () => (
    <div className="space-y-4">
      <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-[var(--color-text-primary)]">{detail?.order_no || workOrder.id}</span>
          <div className="flex gap-2">
            <span className={`px-2 py-0.5 text-xs text-white rounded ${status.color}`}>{status.text}</span>
            <span className={`px-2 py-0.5 text-xs rounded ${urgency.color}`}>{urgency.text}</span>
          </div>
        </div>
        <div className="text-sm text-[var(--color-text-secondary)]">问题类型：{typeLabels[workOrder.type] || workOrder.type}</div>
        <div className="text-sm text-[var(--color-text-secondary)]">提交时间：{workOrder.created_at ? new Date(workOrder.created_at).toLocaleString('zh-CN') : '-'}</div>
        {detail?.engineer_name && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            合伙人：<span className="text-[var(--color-primary)]">{detail.engineer_name}</span>
            {detail.engineer_phone && <span className="ml-1 opacity-70">{detail.engineer_phone}</span>}
          </div>
        )}
        {detail?.customer_name && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            客户：<span className="text-[var(--color-primary)]">{detail.customer_name}</span>
            {detail.customer_phone && <span className="ml-1 opacity-70">{detail.customer_phone}</span>}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">问题描述</h3>
        <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">
          {workOrder.description}
        </div>
      </div>

      {detail?.ai_summary && (() => {
        let aiData;
        try { aiData = typeof detail.ai_summary === 'string' ? JSON.parse(detail.ai_summary) : detail.ai_summary; } catch { return null; }
        return (
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">AI 智能分析</h3>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-[var(--color-text-primary)] space-y-2">
              {aiData.summary && <p>{aiData.summary}</p>}
              {aiData.required_specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-[var(--color-text-secondary)]">匹配设备：</span>
                  {aiData.required_specialties.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 合伙人：标记服务完成 */}
      {isEngineer && (workOrder.status === 'in_service' || workOrder.status === 'pricing') && (
        <button
          onClick={async () => {
            if (!confirm('确认服务已完成？')) return;
            try {
              await resolveWorkOrder(workOrder.id, userId);
              alert('已标记服务完成，等待客户确认。');
              loadDetail();
              onConfirmed?.();
            } catch (e) {
              alert('操作失败: ' + e.message);
            }
          }}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium"
        >
          标记服务完成
        </button>
      )}

      {detail?.logs?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">处理进度</h3>
          <div className="space-y-2">
            {detail.logs.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" />
                <div>
                  <p className="text-[var(--color-text-primary)]">{log.content}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{new Date(log.created_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 评价区（resolved状态） */}
      {workOrder.status === 'resolved' && detail?.rating && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">您的评价</h3>
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl space-y-2">
            {[
              { key: 'timeliness', label: '时效性' },
              { key: 'technical', label: '技术熟练' },
              { key: 'communication', label: '沟通流畅' },
              { key: 'professional', label: '专业性' },
            ].map((dim) => (
              <div key={dim.key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
                <Stars value={detail.rating[`rating_${dim.key}`]} readonly />
              </div>
            ))}
            {detail.rating.comment && (
              <div className="pt-2 border-t border-[var(--color-border)] text-sm text-[var(--color-text-primary)]">{detail.rating.comment}</div>
            )}
          </div>
        </div>
      )}

      {workOrder.status === 'resolved' && !showRating && !detail?.rating && (
        <button onClick={() => setShowRating(true)} className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium">
          立即评价
        </button>
      )}

      {showRating && (
        <div className="space-y-3 p-4 bg-[var(--color-surface-elevated)] rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">服务评价</h3>
          {[
            { key: 'timeliness', label: '时效性' },
            { key: 'technical', label: '技术熟练' },
            { key: 'communication', label: '沟通流畅' },
            { key: 'professional', label: '专业性' },
          ].map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
              <Stars value={ratings[dim.key]} onChange={(v) => setRatings({ ...ratings, [dim.key]: v })} />
            </div>
          ))}
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="分享服务体验（选填）..." rows={2}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowRating(false)} className="flex-1 py-2 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl text-sm">取消</button>
            <button onClick={handleSubmitRating} disabled={submitting} className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-xl text-sm">
              {submitting ? '提交中...' : '提交评价'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="工单详情" size="md">
      <div>
        {/* Tab 切换 */}
        <div className="flex gap-1 mb-4 border-b border-[var(--color-border)] pb-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8 text-[var(--color-text-muted)]">加载中...</div>
        ) : (
          <>
            {tab === 'info' && renderInfoTab()}
            {tab === 'messages' && (
              <MessagePanel workOrderId={workOrder.id} userType={userType} userId={userId} />
            )}
            {tab === 'pricing' && isEngineer && (
              <EngineerPricingPanel
                workOrderId={workOrder.id}
                engineerId={userId}
                commissionRate={detail?.engineer_commission_rate || 0.80}
                engineerLevel={detail?.engineer_level || 'junior'}
                onSubmitted={() => { loadDetail(); onConfirmed?.(); }}
              />
            )}
            {tab === 'pricing' && isCustomer && (
              <CustomerPricingPanel workOrderId={workOrder.id} customerId={userId} onConfirmed={() => { loadDetail(); onConfirmed?.(); }} />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
