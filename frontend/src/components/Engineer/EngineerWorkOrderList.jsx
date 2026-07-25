import { ChevronRight, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import {
  getEngineerScheduleLabel,
  getEngineerWorkOrderTitle,
  sortEngineerWorkOrders,
} from './engineerWorkOrderDisplay';

const COPY = {
  en: {
    title: 'My work orders', note: 'Only work orders where you are the executing engineer.',
    all: 'All', needsAction: 'Needs action', active: 'Active', completed: 'Completed',
    nextStep: 'Next step', view: 'View details', loading: 'Loading service tasks...',
    loadFailed: 'Failed to load service tasks', retry: 'Retry', empty: 'No assigned service tasks yet',
    support: 'Need Admin support?', regionFallback: 'Region pending', taskFallback: 'Service task',
    machineFallback: 'Machine details pending', updated: 'Updated',
  },
  cn: {
    title: '我的工单', note: '仅显示由你负责执行的工单。',
    all: '全部', needsAction: '待处理', active: '进行中', completed: '已完成',
    nextStep: '下一步', view: '查看详情', loading: '正在加载服务任务...',
    loadFailed: '服务任务加载失败', retry: '重试', empty: '暂无已分配服务任务',
    support: '需要 Admin 协助？', regionFallback: '地区待补充', taskFallback: '服务任务',
    machineFallback: '设备信息待补充', updated: '更新于',
  },
};

const FILTERS = {
  needsAction: new Set(['assigned', 'pending_dispatch', 'pricing', 'pending_payment']),
  active: new Set(['in_progress', 'in_service', 'payment_review', 'resolved', 'pending_review']),
  completed: new Set(['completed']),
};

function formatUpdated(value, isCn) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(isCn ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function EngineerWorkOrderList({
  tickets, loading, error, isCn, statusLabels, getNextAction, getMachineLine,
  filter, onFilterChange, onSelectTicket, onRetry,
  embedded = false,
}) {
  const copy = isCn ? COPY.cn : COPY.en;
  const visibleTickets = useMemo(() => {
    const sorted = sortEngineerWorkOrders(tickets);
    return filter === 'all' ? sorted : sorted.filter((ticket) => FILTERS[filter].has(ticket.status));
  }, [filter, tickets]);

  const content = loading ? (
    <div className="py-10 text-center text-sm text-[#697386]">{copy.loading}</div>
  ) : error ? (
    <div className="m-4 rounded-xl border border-red-200 p-5 text-center">
      <p className="text-sm text-red-600">{error || copy.loadFailed}</p>
      <button onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw size={14} />{copy.retry}</button>
    </div>
  ) : visibleTickets.length === 0 ? (
    <div className="py-9 text-center text-sm text-[#697386]">{copy.empty}</div>
  ) : (
    <div>
      <div className="hidden grid-cols-[1.05fr_2.1fr_.9fr_1.5fr_.8fr_36px] gap-3 px-5 py-2 text-[9px] font-extrabold uppercase tracking-wider text-[#929baa] lg:grid">
        <span>{isCn ? '工单' : 'Work order'}</span><span>{isCn ? '客户与设备' : 'Customer & machine'}</span><span>{isCn ? '状态' : 'Status'}</span><span>{copy.nextStep}</span><span>{copy.updated}</span><span />
      </div>
      {visibleTickets.map((ticket) => {
        const schedule = getEngineerScheduleLabel(ticket, isCn ? 'zh-CN' : 'en-US');
        return (
          <button
            key={ticket.id}
            type="button"
            onClick={() => onSelectTicket(ticket)}
            className="grid w-full gap-2 border-t border-[#eef0f3] bg-white px-4 py-4 text-left transition hover:bg-[#fffaf2] lg:grid-cols-[1.05fr_2.1fr_.9fr_1.5fr_.8fr_36px] lg:items-center lg:gap-3 lg:px-5 lg:py-3"
          >
            <span>
              <strong className="block text-xs text-[#18202b]">{ticket.order_no || ticket.id}</strong>
              <span className="mt-1 block text-[10px] text-[#929baa]">{formatUpdated(ticket.created_at, isCn)}</span>
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-xs text-[#18202b]">{getEngineerWorkOrderTitle(ticket, isCn, copy.taskFallback)}</strong>
              {ticket.customer_name && <span className="mt-1 block truncate text-[10px] text-[#929baa]">{ticket.customer_name}</span>}
              <span className="mt-1 block truncate text-[10px] text-[#697386]">{getMachineLine(ticket) || copy.machineFallback}{schedule ? ` · ${schedule}` : ''}</span>
            </span>
            <span><span className="inline-flex rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">{statusLabels[ticket.status] || ticket.status}</span></span>
            <span className="min-w-0">
              <strong className="block text-[11px] text-[#18202b]">{getNextAction(ticket)}</strong>
              <span className="mt-1 block truncate text-[10px] text-[#929baa]">{ticket.customer_region || copy.regionFallback}</span>
            </span>
            <span className="text-[10px] text-[#697386]">{formatUpdated(ticket.updated_at || ticket.created_at, isCn)}</span>
            <span className="grid size-8 place-items-center rounded-lg border border-[#e5e8ed] text-orange-600"><ChevronRight size={15} /></span>
          </button>
        );
      })}
    </div>
  );

  if (embedded) return content;
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e8ed] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e5e8ed] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div><h2 className="text-base font-semibold text-[#18202b]">{copy.title}</h2><p className="mt-1 text-xs text-[#697386]">{copy.note}</p></div>
        <div className="flex flex-wrap gap-2">
          {['all', 'needsAction', 'active', 'completed'].map((value) => (
            <button key={value} type="button" onClick={() => onFilterChange(value)} className={`rounded-lg px-3 py-2 text-[11px] font-bold ${filter === value ? 'bg-[#18202b] text-white' : 'bg-[#f7f8fa] text-[#697386]'}`}>{copy[value]}</button>
          ))}
        </div>
      </div>
      {content}
      <footer className="border-t border-[#e5e8ed] bg-[#fbfcfd] px-5 py-3 text-[11px] text-[#697386]">
        {copy.support} <a className="font-semibold text-orange-600" href="mailto:support@sagemro.com">support@sagemro.com</a>
      </footer>
    </section>
  );
}
