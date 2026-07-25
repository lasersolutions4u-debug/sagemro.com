import { ChevronRight, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import {
  getEngineerScheduleLabel,
  getEngineerWorkOrderTitle,
  sortEngineerWorkOrders,
} from './engineerWorkOrderDisplay';

const COPY = {
  en: {
    title: 'Service Work Orders', note: 'Ordered by the next action you need to take.',
    all: 'All', needsAction: 'Needs action', active: 'Active', completed: 'Completed',
    nextStep: 'Next step', view: 'View Details', loading: 'Loading service tasks...',
    loadFailed: 'Failed to load service tasks', retry: 'Retry', empty: 'No assigned service tasks yet',
    support: 'Need Admin support?', regionFallback: 'Region pending', taskFallback: 'Service task',
  },
  cn: {
    title: '服务工单', note: '按照你需要处理的下一步排序。',
    all: '全部', needsAction: '待处理', active: '进行中', completed: '已完成',
    nextStep: '下一步', view: '查看详情', loading: '正在加载服务任务...',
    loadFailed: '服务任务加载失败', retry: '重试', empty: '暂无已分配服务任务',
    support: '需要 Admin 协助？', regionFallback: '地区待补充', taskFallback: '服务任务',
  },
};

const FILTERS = {
  needsAction: new Set(['assigned', 'pending_dispatch', 'pricing', 'pending_payment']),
  active: new Set(['in_progress', 'in_service', 'payment_review', 'resolved', 'pending_review']),
  completed: new Set(['completed']),
};

export function EngineerWorkOrderList({
  tickets, loading, error, isCn, statusLabels, getNextAction, getMachineLine,
  formatDescription, filter, onFilterChange, onSelectTicket, onRetry,
  onConfirmAssignment,
}) {
  const copy = isCn ? COPY.cn : COPY.en;
  const visibleTickets = useMemo(() => {
    const sorted = sortEngineerWorkOrders(tickets);
    return filter === 'all' ? sorted : sorted.filter((ticket) => FILTERS[filter].has(ticket.status));
  }, [filter, tickets]);

  const content = loading ? (
    <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">{copy.loading}</div>
  ) : error ? (
    <div className="rounded-xl border border-[var(--color-error)]/30 p-5 text-center">
      <p className="text-sm text-[var(--color-error)]">{error || copy.loadFailed}</p>
      <button onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
        <RefreshCw size={14} />{copy.retry}
      </button>
    </div>
  ) : visibleTickets.length === 0 ? (
    <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">{copy.empty}</div>
  ) : (
    <div className="space-y-2">
      {visibleTickets.map((ticket) => {
        const schedule = getEngineerScheduleLabel(ticket, isCn ? 'zh-CN' : 'en-US');
        return (
          <article key={ticket.id} className="rounded-xl border border-l-2 border-[var(--color-border)] border-l-[var(--color-primary)] bg-[var(--color-surface)] p-4">
            <div className="gap-4 sm:flex sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{getEngineerWorkOrderTitle(ticket, isCn, copy.taskFallback)}</h3>
                  <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)]">{statusLabels[ticket.status] || ticket.status}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{ticket.order_no || ticket.id} · {getMachineLine(ticket)} · {ticket.customer_region || copy.regionFallback}</p>
                {schedule && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{schedule}</p>}
                <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{formatDescription(ticket.description || '')}</p>
                <p className="mt-3 text-sm"><span className="font-semibold text-[var(--color-primary)]">{copy.nextStep}:</span> {getNextAction(ticket)}</p>
              </div>
              <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0 sm:justify-end">
                {ticket.status === 'assigned' && onConfirmAssignment && (
                  <button
                    onClick={(event) => { event.stopPropagation(); onConfirmAssignment(ticket); }}
                    className="inline-flex min-h-10 items-center rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
                  >
                    {isCn ? '确认派工' : 'Confirm Assignment'}
                  </button>
                )}
                <button onClick={() => onSelectTicket(ticket)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium">
                  {copy.view}<ChevronRight size={15} />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div className="mb-4 gap-3 sm:flex sm:items-end sm:justify-between">
        <div><h2 className="text-lg font-semibold">{copy.title}</h2><p className="text-sm text-[var(--color-text-muted)]">{copy.note}</p></div>
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
          {['all', 'needsAction', 'active', 'completed'].map((value) => (
            <button key={value} onClick={() => onFilterChange(value)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === value ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'}`}>{copy[value]}</button>
          ))}
        </div>
      </div>
      {content}
      <footer className="mt-5 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-text-muted)]">
        {copy.support} <a className="font-medium text-[var(--color-primary)]" href="mailto:support@sagemro.com">support@sagemro.com</a>
      </footer>
    </section>
  );
}
