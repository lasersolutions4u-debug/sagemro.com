import { ChevronRight, RefreshCw } from 'lucide-react';
import { Fragment, useMemo } from 'react';
import {
  getEngineerWorkOrderTitle,
  sortEngineerWorkOrders,
} from './engineerWorkOrderDisplay';

const COPY = {
  en: {
    title: 'My work orders', note: 'Only work orders where you are the executing engineer.',
    all: 'All', needsAction: 'Needs action', active: 'Active', completed: 'Completed',
    view: 'View details', loading: 'Loading service tasks...',
    loadFailed: 'Failed to load service tasks', retry: 'Retry', empty: 'No assigned service tasks yet',
    support: 'Need Admin support?', regionFallback: 'Region pending', taskFallback: 'Service task',
    machineFallback: 'Machine details pending', updated: 'Updated',
  },
  cn: {
    title: '我的工单', note: '仅显示由你负责执行的工单。',
    all: '全部', needsAction: '待处理', active: '进行中', completed: '已完成',
    view: '查看详情', loading: '正在加载服务任务...',
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
  tickets, loading, error, isCn, statusLabels, getMachineLine,
  filter, onFilterChange, onSelectTicket, onRetry,
  embedded = false,
}) {
  const copy = isCn ? COPY.cn : COPY.en;
  const visibleTickets = useMemo(() => {
    const sorted = sortEngineerWorkOrders(tickets);
    return filter === 'all' ? sorted : sorted.filter((ticket) => FILTERS[filter].has(ticket.status));
  }, [filter, tickets]);

  const content = loading ? (
    <div className="space-y-3 p-4" aria-label={copy.loading}>
      {[1, 2, 3].map((item) => <div key={item} className="animate-pulse rounded-xl border border-[#e5e8ed] p-4"><div className="h-4 w-36 rounded bg-[#e5e8ed]" /><div className="mt-3 h-3 w-2/3 rounded bg-[#eef0f3]" /><div className="mt-4 h-8 rounded-lg bg-[#eef0f3]" /></div>)}
    </div>
  ) : error ? (
    <div className="m-4 rounded-xl border border-red-200 p-5 text-center">
      <p className="text-sm text-red-600">{error || copy.loadFailed}</p>
      <button onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw size={14} />{copy.retry}</button>
    </div>
  ) : visibleTickets.length === 0 ? (
    <div className="py-9 text-center text-sm text-[#697386]">{copy.empty}</div>
  ) : (
    <div>
      <div className="hidden gap-3 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-[#929baa] min-[1280px]:grid min-[1280px]:grid-cols-[132px_minmax(210px,1.35fr)_minmax(120px,.85fr)_minmax(220px,1.4fr)_minmax(120px,.8fr)_132px_36px]">
        <span>{isCn ? '工单号' : 'Work order'}</span>
        <span>{isCn ? '工单名称' : 'Task name'}</span>
        <span>{isCn ? '客户' : 'Customer'}</span>
        <span>{isCn ? '设备 / 故障' : 'Equipment / issue'}</span>
        <span>{isCn ? '地区' : 'Region'}</span>
        <span>{isCn ? '状态' : 'Status'}</span>
        <span>{copy.updated}</span>
        <span />
      </div>
      {visibleTickets.map((ticket) => (
        <Fragment key={ticket.id}>
          <button
            key={ticket.id}
            type="button"
            onClick={() => onSelectTicket(ticket)}
            className="relative w-full overflow-hidden border-t border-[#eef0f3] bg-white px-4 py-4 text-left transition hover:bg-[#fffaf2] min-[1280px]:hidden"
          >
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: `var(--status-${ticket.status})` }} />
            <span className="flex items-start justify-between gap-3">
              <strong className="min-w-0 line-clamp-2 text-[15px] leading-5 text-[#18202b]">{getEngineerWorkOrderTitle(ticket, isCn, copy.taskFallback)}</strong>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold" style={{ backgroundColor: `var(--status-${ticket.status}-bg)`, color: `var(--status-${ticket.status}-text)` }}><span className="size-1.5 rounded-full" style={{ backgroundColor: `var(--status-${ticket.status})` }} />{statusLabels[ticket.status] || ticket.status}</span>
            </span>
            <strong className="mt-2 block text-sm text-[#18202b]">{ticket.order_no || ticket.id}</strong>
            <span className="mt-2 block truncate text-xs text-[#697386]">{ticket.customer_name || '—'}</span>
            <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-[#697386]">
              <span className="min-w-0 flex-1 truncate">{getMachineLine(ticket) || copy.machineFallback}</span>
              <span aria-hidden="true">·</span>
              <span className="max-w-[40%] truncate">{ticket.customer_region || copy.regionFallback}</span>
            </span>
            <span className="mt-3 flex items-center justify-between gap-3 text-xs text-[#697386]">
              <span>{copy.updated} {formatUpdated(ticket.updated_at || ticket.created_at, isCn)}</span>
              <span className="inline-flex items-center gap-1 font-semibold text-orange-600">
                {copy.view}<ChevronRight aria-hidden="true" size={15} />
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTicket(ticket)}
            className="relative hidden min-h-[76px] w-full items-center gap-3 overflow-hidden border-t border-[#eef0f3] bg-white px-4 py-3 text-left transition hover:bg-[#fffaf2] min-[1280px]:grid min-[1280px]:grid-cols-[132px_minmax(210px,1.35fr)_minmax(120px,.85fr)_minmax(220px,1.4fr)_minmax(120px,.8fr)_132px_36px]"
          >
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: `var(--status-${ticket.status})` }} />
            <strong className="whitespace-nowrap text-sm text-[#18202b]">{ticket.order_no || ticket.id}</strong>
            <strong className="min-w-0 truncate text-[15px] text-[#18202b]">{getEngineerWorkOrderTitle(ticket, isCn, copy.taskFallback)}</strong>
            <span className="min-w-0 truncate text-xs text-[#697386]">{ticket.customer_name || '—'}</span>
            <span className="min-w-0 line-clamp-2 text-[13px] leading-5 text-[#697386]">{getMachineLine(ticket) || copy.machineFallback}</span>
            <span className="min-w-0 truncate text-xs text-[#697386]">{ticket.customer_region || copy.regionFallback}</span>
            <span><span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold" style={{ backgroundColor: `var(--status-${ticket.status}-bg)`, color: `var(--status-${ticket.status}-text)` }}><span className="size-1.5 rounded-full" style={{ backgroundColor: `var(--status-${ticket.status})` }} />{statusLabels[ticket.status] || ticket.status}</span></span>
            <span className="text-xs text-[#697386]">{formatUpdated(ticket.updated_at || ticket.created_at, isCn)}</span>
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg border border-[#e5e8ed] text-orange-600"><ChevronRight size={15} /></span>
          </button>
        </Fragment>
      ))}
    </div>
  );

  if (embedded) return content;
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e8ed] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e5e8ed] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div><h2 className="text-xl font-semibold text-[#18202b]">{copy.title}</h2><p className="mt-1 text-[13px] text-[#697386]">{copy.note}</p></div>
        <div className="flex flex-wrap gap-2">
          {['all', 'needsAction', 'active', 'completed'].map((value) => (
            <button key={value} type="button" onClick={() => onFilterChange(value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === value ? 'bg-[#18202b] text-white' : 'bg-[#f7f8fa] text-[#697386]'}`}>{copy[value]}</button>
          ))}
        </div>
      </div>
      {content}
      <footer className="border-t border-[#e5e8ed] bg-[#fbfcfd] px-5 py-3 text-xs text-[#697386]">
        {copy.support} <a className="font-semibold text-orange-600" href="mailto:support@sagemro.com">support@sagemro.com</a>
      </footer>
    </section>
  );
}
