import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { groupRegionalTeamWorkOrders } from './engineerWorkOrderMetrics';
import { EngineerWorkOrderList } from './EngineerWorkOrderList';

const COPY = {
  en: {
    title: 'Regional team work orders',
    note: 'Grouped by the engineer responsible for execution.',
    queue: 'Unassigned regional queue',
    queueNote: 'Waiting for a team engineer',
    historical: 'Historical supervision',
    historicalNote: 'Read-only records retained from earlier supervision',
    me: 'Me',
    statuses: { available: 'Available', paused: 'Paused', offline: 'Offline' },
    orders: (count) => `${count} work order${count === 1 ? '' : 's'}`,
    none: 'No work orders assigned',
  },
  cn: {
    title: '区域团队工单',
    note: '按负责执行的工程师姓名分组显示。',
    queue: '区域待派工队列',
    queueNote: '等待分配团队工程师',
    historical: '历史负责工单',
    historicalNote: '保留的历史监督记录，仅供查看',
    me: '我',
    statuses: { available: '可接单', paused: '暂停接单', offline: '离线' },
    orders: (count) => `${count} 个工单`,
    none: '暂无已分配工单',
  },
};

function initials(name) {
  return String(name || '—').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—';
}

const FILTERS = {
  needsAction: new Set(['assigned', 'pending_dispatch', 'pricing', 'pending_payment']),
  active: new Set(['in_progress', 'in_service', 'payment_review', 'resolved', 'pending_review']),
  completed: new Set(['completed']),
};

function filteredCount(tickets, filter) {
  return filter === 'all' ? tickets.length : tickets.filter((ticket) => FILTERS[filter]?.has(ticket.status)).length;
}

export function EngineerTeamWorkOrderList({
  tickets, team, lead, loading, error, isCn, statusLabels, getNextAction,
  getMachineLine, filter, onFilterChange, onSelectTicket, onRetry,
}) {
  const copy = isCn ? COPY.cn : COPY.en;
  const groups = useMemo(() => groupRegionalTeamWorkOrders(tickets, team, lead), [lead, team, tickets]);
  const [collapsed, setCollapsed] = useState({});
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e8ed] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e5e8ed] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div><h2 className="text-xl font-semibold text-[#18202b]">{copy.title}</h2><p className="mt-1 text-[13px] text-[#697386]">{copy.note}</p></div>
        <div className="flex flex-wrap gap-2">
          {['all', 'needsAction', 'active', 'completed'].map((value) => (
            <button key={value} type="button" onClick={() => onFilterChange(value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === value ? 'bg-[#18202b] text-white' : 'bg-[#f7f8fa] text-[#697386]'}`}>
              {isCn ? ({ all: '全部', needsAction: '待处理', active: '进行中', completed: '已完成' })[value] : ({ all: 'All', needsAction: 'Needs action', active: 'Active', completed: 'Completed' })[value]}
            </button>
          ))}
        </div>
      </div>
      {groups.map((group) => {
        const closed = Boolean(collapsed[group.key]);
        const name = group.type === 'queue' ? copy.queue : group.type === 'historical' ? copy.historical : group.engineer.name;
        const detail = group.type === 'queue'
          ? copy.queueNote
          : group.type === 'historical'
          ? copy.historicalNote
          : `${group.type === 'lead' ? `${copy.me} · ` : ''}${copy.statuses[group.engineer.status] || group.engineer.status || copy.none}`;
        const visibleCount = filteredCount(group.tickets, filter);
        return (
          <section key={group.key} className="border-b border-[#e5e8ed] last:border-b-0">
            <button
              type="button"
              onClick={() => setCollapsed((current) => ({ ...current, [group.key]: !current[group.key] }))}
              className="flex w-full items-center justify-between gap-3 bg-[#fbfcfd] px-4 py-3 text-left sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] text-xs font-extrabold ${group.type === 'queue' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-700'}`}>{group.type === 'queue' || group.type === 'historical' ? '—' : initials(group.engineer.name)}</span>
                <span className="min-w-0">
                  <strong className="block truncate text-[15px] text-[#18202b]">{name}</strong>
                  <span className="mt-0.5 block text-xs text-[#697386]">{detail}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="rounded-full bg-[#f2f4f7] px-2 py-1 text-xs font-bold text-[#697386]">{copy.orders(visibleCount)}</span>
                <ChevronDown size={15} className={`text-[#929baa] transition ${closed ? '-rotate-90' : ''}`} />
              </span>
            </button>
            {!closed && (
              <EngineerWorkOrderList
                embedded
                tickets={group.tickets}
                loading={loading}
                error={error}
                isCn={isCn}
                statusLabels={statusLabels}
                getNextAction={getNextAction}
                getMachineLine={getMachineLine}
                filter={filter}
                onFilterChange={onFilterChange}
                onSelectTicket={onSelectTicket}
                onRetry={onRetry}
              />
            )}
          </section>
        );
      })}
    </section>
  );
}
