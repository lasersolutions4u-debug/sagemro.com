import { useState, useEffect } from 'react';
import { convertAdminLeadToWorkOrder, getAdminLeads, updateAdminLead } from '../services/api';

const STATUS_MAP = {
  new: { label: '新线索', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  contacted: { label: '已联系', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  converted: { label: '已转化', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  lost: { label: '已流失', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

const SOURCE_MAP = {
  chat: 'AI 对话',
  ai_tool: 'AI 工具',
  landing: '落地页',
  referral: '转介绍',
  fault_diagnosis_ai: '故障诊断 AI',
  cutting_parameter_ai: '切割参数 AI',
  parts_identification_ai: '备件识别 AI',
  repair_estimate_ai: '维修预估 AI',
  machine_selection_ai: '新机选型 AI',
  health_report_ai: '设备健康报告 AI',
  manual_service_request: '手动服务申请',
  contact_form: '联系表单',
};

const RISK_MAP = {
  low: { label: '低', color: 'text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)]' },
  medium: { label: '中', color: 'text-yellow-400 bg-yellow-500/10' },
  high: { label: '高', color: 'text-orange-400 bg-orange-500/10' },
  critical: { label: '停机', color: 'text-red-400 bg-red-500/10' },
};

export function LeadsPage() {
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState('');
  const pageSize = 20;

  const load = () => {
    setLoading(true);
    getAdminLeads(page, pageSize, statusFilter)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, statusFilter]);

  const handleStatusChange = async (leadId, newStatus) => {
    setUpdatingId(leadId);
    setMessage('');
    try {
      await updateAdminLead(leadId, newStatus);
      load();
    } catch (e) {
      setMessage('更新失败：' + e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConvertToWorkOrder = async (lead) => {
    setUpdatingId(lead.id);
    setMessage('');
    try {
      const result = await convertAdminLeadToWorkOrder(lead.id);
      const orderNo = result.work_order?.order_no || result.work_order_id || '服务申请';
      setMessage(`已转为服务申请：${orderNo}。请到“派工与服务质量”继续分配区域负责人。`);
      load();
    } catch (e) {
      setMessage('转服务申请失败：' + e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">线索池</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          按 AI 来源、风险等级和推荐下一步分流服务、备件与新机机会。
        </p>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {['all', ...Object.keys(STATUS_MAP)].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              statusFilter === s
                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-[var(--color-primary)]/30'
                : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] border-transparent'
            }`}
          >
            {s === 'all' ? '全部' : STATUS_MAP[s].label}
          </button>
        ))}
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">共 {data.total} 条</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">加载中...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">姓名</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">联系方式</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">来源</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">风险</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">AI 摘要</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">推荐下一步</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">分配</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">状态</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">运营动作</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-[var(--color-text-muted)]">暂无线索数据</td></tr>
                ) : (
                  data.list.map((lead) => (
                    <tr key={lead.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]/50">
                      <td className="py-3 px-2 font-medium text-[var(--color-text-primary)]">{lead.name}</td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)]">
                        {lead.email && <div>{lead.email}</div>}
                        {lead.phone && <div className="text-xs text-[var(--color-text-muted)]">{lead.phone}</div>}
                      </td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)]">
                        {lead.source_label || SOURCE_MAP[lead.source_type] || SOURCE_MAP[lead.source] || lead.source}
                      </td>
                      <td className="py-3 px-2">
                        {(() => {
                          const risk = RISK_MAP[lead.risk_level] || RISK_MAP.low;
                          return <span className={`px-2 py-1 rounded text-xs font-medium ${risk.color}`}>{risk.label}</span>;
                        })()}
                      </td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)] max-w-[260px]">
                        <div className="truncate">{lead.ai_summary || lead.message || lead.interest || '-'}</div>
                        {lead.region && <div className="text-xs text-[var(--color-text-muted)] mt-1">{lead.region}</div>}
                      </td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)] max-w-[220px] truncate">
                        {lead.recommended_next_step || '-'}
                      </td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)]">
                        {lead.assignment_status === 'assigned' ? '已分配' : lead.assignment_status === 'converted' ? '已转化' : '未分配'}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          disabled={updatingId === lead.id}
                          className={`px-2 py-1 rounded text-xs font-medium border cursor-pointer ${STATUS_MAP[lead.status]?.color || ''}`}
                        >
                          {Object.entries(STATUS_MAP).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2">
                        {lead.work_order_id || lead.assignment_status === 'converted' ? (
                          <div className="text-xs text-[var(--color-success)]">
                            已转服务申请
                            {lead.work_order_id && <div className="font-mono text-[var(--color-text-muted)]">{lead.work_order_id}</div>}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConvertToWorkOrder(lead)}
                            disabled={updatingId === lead.id}
                            className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {updatingId === lead.id ? '处理中' : '转服务申请'}
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)] text-xs">{lead.created_at?.slice(0, 16)?.replace('T', ' ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors">上一页</button>
              <span className="text-sm text-[var(--color-text-secondary)]">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors">下一页</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
