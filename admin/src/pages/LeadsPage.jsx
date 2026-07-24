import { useState, useEffect } from 'react';
import { getAdminLeads, updateAdminLead } from '../services/api';
import { runtimeConfig } from '../config/runtime';

const STATUS_MAP = {
  new: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  contacted: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  converted: { color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  lost: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

const RISK_MAP = {
  low: { color: 'text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)]' },
  medium: { color: 'text-yellow-400 bg-yellow-500/10' },
  high: { color: 'text-orange-400 bg-orange-500/10' },
  critical: { color: 'text-red-400 bg-red-500/10' },
};

const TEXT = {
  en: {
    statuses: {
      new: 'New',
      contacted: 'Contacted',
      converted: 'Converted',
      lost: 'Lost',
    },
    sources: {
      chat: 'AI chat',
      ai_tool: 'AI tool',
      landing: 'Landing page',
      referral: 'Referral',
      fault_diagnosis_ai: 'Fault intake AI',
      cutting_parameter_ai: 'Cutting parameter AI',
      parts_identification_ai: 'Parts identification AI',
      repair_estimate_ai: 'Repair estimate AI',
      machine_selection_ai: 'Machine selection AI',
      machine_purchase_ai: 'Machine purchase AI',
      machine_purchase_engineer: 'Engineer-submitted machine lead',
      engineer_machine_opportunity: 'Engineer-submitted machine lead',
      health_report_ai: 'Equipment health report AI',
      manual_service_request: 'Manual service request',
      contact_form: 'Contact form',
    },
    risks: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      critical: 'Downtime',
    },
    title: 'Machine Lead Inbox',
    subtitle: 'Whole-machine opportunities only. Admin routes sales follow-up, with engineers supporting technical selection and site context.',
    all: 'All',
    total: (count) => `${count} total`,
    loading: 'Loading...',
    loadFailed: 'Failed to load machine leads.',
    retry: 'Retry',
    updateFailed: 'Update failed: ',
    salesFollowUp: 'Admin sales routing',
    engineerAssisted: 'Engineer-assisted',
    headers: {
      name: 'Name',
      contact: 'Contact',
      source: 'Source',
      risk: 'Risk',
      summary: 'AI summary',
      nextStep: 'Recommended next step',
      assignment: 'Assignment',
      status: 'Status',
      action: 'Sales follow-up',
      time: 'Time',
    },
    empty: 'No leads yet',
    assignment: {
      assigned: 'Assigned',
      converted: 'Converted',
      unassigned: 'Unassigned',
    },
    processing: 'Processing',
    previous: 'Previous',
    next: 'Next',
  },
  'zh-CN': {
    statuses: {
      new: '新线索',
      contacted: '已联系',
      converted: '已转化',
      lost: '已流失',
    },
    sources: {
      chat: 'AI 对话',
      ai_tool: 'AI 工具',
      landing: '落地页',
      referral: '转介绍',
      fault_diagnosis_ai: '故障诊断 AI',
      cutting_parameter_ai: '切割参数 AI',
      parts_identification_ai: '备件识别 AI',
      repair_estimate_ai: '维修预估 AI',
      machine_selection_ai: '新机选型 AI',
      machine_purchase_ai: '整机采购 AI',
      machine_purchase_engineer: '工程师提交整机线索',
      engineer_machine_opportunity: '工程师提交整机线索',
      health_report_ai: '设备健康报告 AI',
      manual_service_request: '手动服务申请',
      contact_form: '联系表单',
    },
    risks: {
      low: '低',
      medium: '中',
      high: '高',
      critical: '停机',
    },
    title: '整机线索池',
    subtitle: '仅承接整机/新机设备商机。Admin 负责销售流转，工程师提供选型与现场技术配合。',
    all: '全部',
    total: (count) => `共 ${count} 条`,
    loading: '加载中...',
    loadFailed: '整机线索加载失败。',
    retry: '重试',
    updateFailed: '更新失败：',
    salesFollowUp: 'Admin 销售流转',
    engineerAssisted: '工程师协同',
    headers: {
      name: '姓名',
      contact: '联系方式',
      source: '来源',
      risk: '风险',
      summary: 'AI 摘要',
      nextStep: '推荐下一步',
      assignment: '分配',
      status: '状态',
      action: '销售跟进',
      time: '时间',
    },
    empty: '暂无线索数据',
    assignment: {
      assigned: '已分配',
      converted: '已转化',
      unassigned: '未分配',
    },
    processing: '处理中',
    previous: '上一页',
    next: '下一页',
  },
};

export function LeadsPage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const pageSize = 20;

  const load = () => {
    setLoading(true);
    setLoadError('');
    getAdminLeads(page, pageSize, statusFilter)
      .then(setData)
      .catch((error) => setLoadError(error.message || t.loadFailed))
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
      setMessage(t.updateFailed + e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{t.title}</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {t.subtitle}
        </p>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </div>
      )}
      {loadError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-error)]/40 bg-[var(--color-error)]/5 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          <span>{loadError}</span>
          <button onClick={load} className="whitespace-nowrap rounded-lg border border-[var(--color-error)]/40 px-3 py-1.5 text-xs font-medium text-[var(--color-error)]">{t.retry}</button>
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
            {s === 'all' ? t.all : t.statuses[s]}
          </button>
        ))}
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">{t.total(data.total)}</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">{t.loading}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.name}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.contact}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.source}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.risk}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.summary}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.nextStep}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.assignment}</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.status}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.action}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.time}</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-[var(--color-text-muted)]">{t.empty}</td></tr>
                ) : (
                  data.list.map((lead) => (
                    <tr key={lead.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]/50">
                      <td className="py-3 px-2 font-medium text-[var(--color-text-primary)]">{lead.name}</td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)]">
                        {lead.email && <div>{lead.email}</div>}
                        {lead.phone && <div className="text-xs text-[var(--color-text-muted)]">{lead.phone}</div>}
                      </td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)]">
                        {lead.source_label || t.sources[lead.source_type] || t.sources[lead.source] || lead.source}
                      </td>
                      <td className="py-3 px-2">
                        {(() => {
                          const risk = RISK_MAP[lead.risk_level] || RISK_MAP.low;
                          return <span className={`px-2 py-1 rounded text-xs font-medium ${risk.color}`}>{t.risks[lead.risk_level] || t.risks.low}</span>;
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
                        {lead.assignment_status === 'assigned' ? t.assignment.assigned : lead.assignment_status === 'converted' ? t.assignment.converted : t.assignment.unassigned}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          disabled={updatingId === lead.id}
                          className={`px-2 py-1 rounded text-xs font-medium border cursor-pointer ${STATUS_MAP[lead.status]?.color || ''}`}
                        >
                          {Object.entries(STATUS_MAP).map(([key, val]) => (
                            <option key={key} value={key}>{t.statuses[key]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-xs text-[var(--color-text-secondary)]">
                          {lead.source === 'engineer_machine_opportunity' || lead.source_type === 'machine_purchase_engineer'
                            ? t.engineerAssisted
                            : t.salesFollowUp}
                          {lead.work_order_id && <div className="font-mono text-[var(--color-text-muted)]">{lead.work_order_id}</div>}
                        </div>
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors">{t.previous}</button>
              <span className="text-sm text-[var(--color-text-secondary)]">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors">{t.next}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
