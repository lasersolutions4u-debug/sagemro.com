import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EngineerWorkOrderList } from './EngineerWorkOrderList';

const INITIAL_GROUP_LIMIT = 5;
const MORE_GROUP_LIMIT = 10;

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
    loadMore: (count) => `Load 10 more (${count} remaining)`,
    loading: 'Loading work orders...',
    loadFailed: 'Failed to load work orders',
    retry: 'Retry',
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
    loadMore: (count) => `再加载 10 条（剩余 ${count} 条）`,
    loading: '正在加载工单...',
    loadFailed: '工单加载失败',
    retry: '重试',
  },
};

function initials(name) {
  return String(name || '—').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—';
}

export function EngineerTeamWorkOrderList({
  groups = [], loading, error, isCn, statusLabels,
  getMachineLine, filter, onFilterChange, onSelectTicket, onRetry, onLoadGroup,
}) {
  const copy = isCn ? COPY.cn : COPY.en;
  const [collapsed, setCollapsed] = useState({});
  const [groupPages, setGroupPages] = useState({});
  const [groupLoading, setGroupLoading] = useState({});
  const [groupErrors, setGroupErrors] = useState({});
  const pageGeneration = useRef(0);
  const isCollapsed = useCallback((group) => collapsed[group.key] ?? (group.type === 'member' || group.type === 'historical'), [collapsed]);
  const loadGroup = useCallback(async (group, { limit, cursor } = {}) => {
    const generation = pageGeneration.current;
    setGroupLoading((current) => ({ ...current, [group.key]: true }));
    setGroupErrors((current) => ({ ...current, [group.key]: '' }));
    try {
      const data = await onLoadGroup(group, { limit, cursor });
      if (generation !== pageGeneration.current) return;
      setGroupPages((current) => {
        const previous = current[group.key];
        return {
          ...current,
          [group.key]: {
            rows: cursor ? [...(previous?.rows || []), ...(data.work_orders || [])] : data.work_orders || [],
            nextCursor: data.next_cursor,
            hasMore: data.has_more,
          },
        };
      });
    } catch (loadError) {
      if (generation !== pageGeneration.current) return;
      setGroupErrors((current) => ({ ...current, [group.key]: loadError.message || copy.loadFailed }));
    } finally {
      if (generation === pageGeneration.current) setGroupLoading((current) => ({ ...current, [group.key]: false }));
    }
  }, [copy.loadFailed, onLoadGroup]);
  useEffect(() => {
    pageGeneration.current += 1;
    setGroupPages({});
    setGroupLoading({});
    setGroupErrors({});
  }, [filter]);
  useEffect(() => {
    groups.filter((group) => !isCollapsed(group) && group.total > 0)
      .forEach((group) => {
        if (!groupPages[group.key] && !groupLoading[group.key]) loadGroup(group, { limit: INITIAL_GROUP_LIMIT });
      });
  }, [collapsed, groupLoading, groupPages, groups, isCollapsed, loadGroup]);
  const toggleGroup = (group) => {
    const closed = isCollapsed(group);
    setCollapsed((current) => ({ ...current, [group.key]: !closed }));
    if (closed && !groupPages[group.key]) loadGroup(group, { limit: INITIAL_GROUP_LIMIT });
  };
  const retryGroup = (group) => {
    const page = groupPages[group.key];
    loadGroup(group, {
      limit: page?.rows?.length ? MORE_GROUP_LIMIT : INITIAL_GROUP_LIMIT,
      cursor: page?.rows?.length ? page.nextCursor : undefined,
    });
  };
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
      {!loading && error && groups.length === 0 && <div className="m-4 rounded-xl border border-red-200 p-5 text-center"><p className="text-sm text-red-600">{error}</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg border px-3 py-2 text-sm">{copy.retry}</button></div>}
      {groups.map((group) => {
        const closed = isCollapsed(group);
        const name = group.type === 'queue' ? copy.queue : group.type === 'historical' ? copy.historical : group.engineer.name;
        const detail = group.type === 'queue'
          ? copy.queueNote
          : group.type === 'historical'
          ? copy.historicalNote
          : `${group.type === 'lead' ? `${copy.me} · ` : ''}${copy.statuses[group.engineer.status] || group.engineer.status || copy.none}`;
        const page = groupPages[group.key];
        const rows = page?.rows || [];
        const isGroupLoading = Boolean(groupLoading[group.key]);
        const groupError = groupErrors[group.key];
        const remaining = Math.max(0, Number(group.total || 0) - rows.length);
        return (
          <section key={group.key} className="border-b border-[#e5e8ed] last:border-b-0">
            <button
              type="button"
              onClick={() => toggleGroup(group)}
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
                <span className="rounded-full bg-[#f2f4f7] px-2 py-1 text-xs font-bold text-[#697386]">{copy.orders(group.total || 0)}</span>
                <ChevronDown size={15} className={`text-[#929baa] transition ${closed ? '-rotate-90' : ''}`} />
              </span>
            </button>
            {!closed && group.total === 0 && <p className="px-4 py-3 text-sm text-[#697386] sm:px-5">{copy.none}</p>}
            {!closed && group.total > 0 && <>
              <EngineerWorkOrderList embedded tickets={rows} loading={isGroupLoading && rows.length === 0} error="" isCn={isCn} statusLabels={statusLabels} getMachineLine={getMachineLine} filter={filter} onFilterChange={onFilterChange} onSelectTicket={onSelectTicket} onRetry={() => retryGroup(group)} />
              {groupError && <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 sm:mx-5"><span>{groupError}</span><button type="button" onClick={() => retryGroup(group)} className="shrink-0 font-bold">{copy.retry}</button></div>}
              {isGroupLoading && rows.length > 0 && <p className="px-4 pb-3 text-xs text-[#697386] sm:px-5">{copy.loading}</p>}
              {page?.hasMore && !groupError && <div className="px-4 pb-4 sm:px-5"><button type="button" disabled={isGroupLoading} onClick={() => loadGroup(group, { limit: MORE_GROUP_LIMIT, cursor: page.nextCursor })} className="rounded-lg border border-[#e5e8ed] px-3 py-2 text-xs font-bold text-orange-600 disabled:opacity-60">{copy.loadMore(remaining)}</button></div>}
            </>}
          </section>
        );
      })}
    </section>
  );
}
