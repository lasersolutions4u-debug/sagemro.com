import { useState, useEffect } from 'react';
import { getAdminWorkOrders } from '../services/api';

const STATUS_MAP = {
  pending: { label: '待处理', color: 'var(--color-info)' },
  assigned: { label: '已分配', color: 'var(--color-warning)' },
  in_progress: { label: '处理中', color: 'var(--color-warning)' },
  resolved: { label: '已解决', color: 'var(--color-success)' },
  completed: { label: '已完成', color: 'var(--color-success)' },
  rejected: { label: '已拒绝', color: 'var(--color-error)' },
  cancelled: { label: '已取消', color: 'var(--color-text-muted)' },
};

const URGENCY_MAP = {
  normal: '普通',
  urgent: '紧急',
  critical: '非常紧急',
};

const TYPE_MAP = {
  fault: '设备故障',
  maintenance: '设备保养',
  parameter: '参数调试',
  other: '其他',
};

export function WorkOrdersPage() {
  const [status, setStatus] = useState('all');
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [status]);

  useEffect(() => {
    setLoading(true);
    getAdminWorkOrders(status, page, pageSize)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, page]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  const statusTabs = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待处理' },
    { key: 'in_progress', label: '处理中' },
    { key: 'completed', label: '已完成' },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">工单管理</h2>

      <div className="flex gap-2 mb-6 flex-wrap">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === tab.key
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">加载中...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">工单号</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">客户</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">工程师</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">类型</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">紧急</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">状态</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[var(--color-text-muted)]">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  data.list.map((wo) => {
                    const statusInfo = STATUS_MAP[wo.status] || { label: wo.status, color: 'var(--color-text-muted)' };
                    return (
                      <tr key={wo.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]/50">
                        <td className="py-3 px-2 font-mono text-[var(--color-primary)]">{wo.order_no}</td>
                        <td className="py-3 px-2">
                          <div>{wo.customer_name || '-'}</div>
                          {wo.customer_company && <div className="text-xs text-[var(--color-text-muted)]">{wo.customer_company}</div>}
                        </td>
                        <td className="py-3 px-2">
                          <div>{wo.engineer_name || '-'}</div>
                          {wo.engineer_company && <div className="text-xs text-[var(--color-text-muted)]">{wo.engineer_company}</div>}
                        </td>
                        <td className="py-3 px-2 text-[var(--color-text-secondary)]">{TYPE_MAP[wo.type] || wo.type}</td>
                        <td className="py-3 px-2">
                          <span className={wo.urgency === 'critical' ? 'text-[var(--color-error)] font-medium' : wo.urgency === 'urgent' ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'}>
                            {URGENCY_MAP[wo.urgency] || wo.urgency}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-[var(--color-text-secondary)]">
                          {wo.created_at?.slice(0, 16)?.replace('T', ' ')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors"
              >
                上一页
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
