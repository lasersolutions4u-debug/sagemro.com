import { useMemo, useState } from 'react';
import { buildLinePoints, filterChannelRows, formatMetric, sortChannelRows } from '../../pages/promotionAnalyticsView.js';

function rate(numerator, denominator) {
  const numeratorValue = Number(numerator);
  const denominatorValue = Number(denominator);
  return Number.isFinite(numeratorValue) && Number.isFinite(denominatorValue) && denominatorValue > 0 ? numeratorValue / denominatorValue : null;
}

function sourceMediumLabel(row, isCn) {
  if (!row?.source) return isCn ? '直接访问 / 未归因' : 'Direct / Unattributed';
  return row.medium ? `${row.source} / ${row.medium}` : row.source;
}

function summaryLabel(summary, kind, isCn) {
  if (!summary) return '—';
  if (kind === 'channel') return sourceMediumLabel(summary, isCn);
  return summary.campaign || (isCn ? '暂无样本' : 'No data');
}

function selectionLabel(filters, isCn) {
  return sourceMediumLabel(filters, isCn) + (filters.campaign ? ` · ${filters.campaign}` : '');
}

function SortHeader({ label, field, sort, onSort }) {
  const direction = sort.key === field ? sort.direction : 'none';
  return <th scope="col" aria-sort={direction === 'none' ? 'none' : direction === 'asc' ? 'ascending' : 'descending'} className="whitespace-nowrap border-b border-[var(--color-border)] px-3 py-2 text-right first:text-left"><button type="button" onClick={() => onSort(field)} className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)] outline-none hover:text-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">{label}{direction === 'asc' ? ' ↑' : direction === 'desc' ? ' ↓' : ''}</button></th>;
}

function ChannelTrend({ daily, selected, isCn }) {
  const sessions = daily.map((row) => row.sessions);
  const requests = daily.map((row) => row.aiRequests);
  const serviceRequests = daily.map((row) => row.serviceRequests);
  const sessionPoints = buildLinePoints(sessions, 360, 80).join(' ');
  const requestPoints = buildLinePoints(requests, 360, 80).join(' ');
  const servicePoints = buildLinePoints(serviceRequests, 360, 80).join(' ');
  const title = selected
    ? (isCn ? '已选渠道趋势' : 'Selected channel trend')
    : (isCn ? '整体渠道趋势' : 'Overall channel trend');
  const description = isCn
    ? '访问会话、AI 请求和服务请求按报告日期排列。选择渠道行可按该渠道筛选趋势。'
    : 'Sessions, AI requests, and service requests across the report window. Select a channel row to filter this trend.';
  return <section className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-labelledby="channel-trend-title">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 id="channel-trend-title" className="font-semibold text-[var(--color-text)]">{title}</h2><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{description}</p></div><div className="flex gap-3 text-xs text-[var(--color-text-muted)]"><span>— {isCn ? '访问会话' : 'Sessions'}</span><span>– {isCn ? 'AI 请求' : 'AI requests'}</span><span>·· {isCn ? '服务请求' : 'Service requests'}</span></div></div>
    <svg className="mt-4 h-28 w-full" viewBox="0 0 360 80" role="img" aria-labelledby="channel-trend-svg-title channel-trend-svg-desc" preserveAspectRatio="none"><title id="channel-trend-svg-title">{title}</title><desc id="channel-trend-svg-desc">{description}</desc><line x1="0" y1="80" x2="360" y2="80" stroke="var(--color-border)" /><polyline fill="none" stroke="var(--color-text-muted)" strokeWidth="2" points={sessionPoints} /><polyline fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeDasharray="5 3" points={requestPoints} /><polyline fill="none" stroke="var(--color-text)" strokeWidth="2" strokeDasharray="2 3" points={servicePoints} /></svg>
  </section>;
}

export function ChannelAnalysis({ data, activeFilters, isCn, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'serviceRequests', direction: 'desc' });
  const locale = isCn ? 'zh-CN' : 'en';
  const copy = isCn ? {
    bestChannel: '表现最佳渠道', bestCampaign: '表现最佳活动', attributable: '可归因服务请求', quality: '归因数据质量',
    search: '搜索渠道', searchHint: '搜索来源、媒介或活动', source: '来源 / 媒介', campaign: '活动', sessions: '访问会话', aiRequests: 'AI 请求', aiRate: 'AI 成功率', registrations: '完成注册', serviceRequests: '服务请求', conversion: '会话到服务请求率',
    insufficient: '样本不足', active: '当前渠道', clear: '清除渠道筛选', capped: '最多 100 聚合行，按当前筛选条件比较。',
    operational: '运营提示', dataQuality: '数据质量', operationalHint: '按数量与趋势判断渠道表现；比例需要足够会话样本。', qualityHint: '归因质量反映带有明确来源的访问会话比例。',
  } : {
    bestChannel: 'Best channel', bestCampaign: 'Best campaign', attributable: 'Attributable service requests', quality: 'Attribution quality',
    search: 'Search channels', searchHint: 'Search source, medium, or campaign', source: 'Source / medium', campaign: 'Campaign', sessions: 'Sessions', aiRequests: 'AI requests', aiRate: 'AI success rate', registrations: 'Registrations', serviceRequests: 'Service requests', conversion: 'Session-to-request rate',
    insufficient: 'Insufficient sample', active: 'Active channel', clear: 'Clear channel filter', capped: 'Up to 100 aggregate rows are compared for the current filters.',
    operational: 'Operational note', dataQuality: 'Data quality', operationalHint: 'Use counts and trend together; rates need enough session volume.', qualityHint: 'Attribution quality is the share of sessions with a known source.',
  };
  const rows = useMemo(() => sortChannelRows(filterChannelRows(data?.rows, query), sort.key, sort.direction), [data?.rows, query, sort]);
  const selected = Boolean(activeFilters?.source || activeFilters?.medium || activeFilters?.campaign);
  const changeSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));
  const selectRow = (row) => onSelect(row);
  const keySelect = (event, row) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectRow(row);
  };

  return <div className="space-y-4">
    <section className="border border-[var(--color-border)] bg-[var(--color-surface)]" aria-label={isCn ? '渠道摘要' : 'Channel summary'}>
      <div className="grid divide-y divide-[var(--color-border)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {[
          [copy.bestChannel, summaryLabel(data?.summary?.bestChannel, 'channel', isCn)],
          [copy.bestCampaign, summaryLabel(data?.summary?.bestCampaign, 'campaign', isCn)],
          [copy.attributable, formatMetric(data?.summary?.attributableServiceRequests, 'number', locale)],
          [copy.quality, formatMetric(data?.summary?.attributionCoverage ?? data?.data_quality?.attributionCoverage, 'percent', locale)],
        ].map(([label, value]) => <div key={label} className="min-w-0 px-4 py-3"><p className="text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">{label}</p><p className="mt-1 truncate font-mono text-lg font-semibold tabular-nums text-[var(--color-text)]" title={value}>{value}</p></div>)}
      </div>
    </section>

    {selected && <div className="flex flex-wrap items-center gap-2 border-l-2 border-[var(--color-primary)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm"><span className="text-[var(--color-text-muted)]">{copy.active}:</span><span className="font-mono text-[var(--color-text)]">{selectionLabel(activeFilters, isCn)}</span><button type="button" onClick={onClear} className="ml-auto text-sm font-semibold text-[var(--color-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">{copy.clear}</button></div>}

    <section className="border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3"><label className="grid gap-1 text-xs text-[var(--color-text-muted)]">{copy.search}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchHint} className="min-h-9 w-64 max-w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" /></label><p className="text-xs text-[var(--color-text-muted)]">{copy.capped}</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[940px] border-collapse text-sm"><thead><tr className="bg-[var(--color-surface-elevated)]"><SortHeader label={copy.source} field="source" sort={sort} onSort={changeSort} /><SortHeader label={copy.campaign} field="campaign" sort={sort} onSort={changeSort} /><SortHeader label={copy.sessions} field="sessions" sort={sort} onSort={changeSort} /><SortHeader label={copy.aiRequests} field="aiRequests" sort={sort} onSort={changeSort} /><SortHeader label={copy.aiRate} field="aiSuccessRate" sort={sort} onSort={changeSort} /><SortHeader label={copy.registrations} field="registrations" sort={sort} onSort={changeSort} /><SortHeader label={copy.serviceRequests} field="serviceRequests" sort={sort} onSort={changeSort} /><SortHeader label={copy.conversion} field="sessionToRequestRate" sort={sort} onSort={changeSort} /></tr></thead><tbody>{rows.map((row, index) => {
        const insufficient = Number(row.sessions) < 20;
        const aiSuccessRate = rate(row.aiSuccesses, row.aiRequests);
        const conversion = rate(row.serviceRequests, row.sessions);
        const selectLabel = isCn ? `选择 ${sourceMediumLabel(row, true)} / ${row.campaign || '未归因'}` : `Select ${row.source || 'direct'} / ${row.medium || 'unattributed'} / ${row.campaign || 'unattributed'}`;
        return <tr key={`${row.source}-${row.medium}-${row.campaign}-${index}`} role="button" tabIndex={0} aria-label={selectLabel} onClick={() => selectRow(row)} onKeyDown={(event) => keySelect(event, row)} className="cursor-pointer border-b border-[var(--color-border)] text-[var(--color-text)] outline-none hover:bg-[var(--color-surface-elevated)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"><td className="px-3 py-3 font-medium">{sourceMediumLabel(row, isCn)}</td><td className="px-3 py-3 text-[var(--color-text-secondary)]">{row.campaign || '—'}</td><td className="px-3 py-3 text-right font-mono tabular-nums">{formatMetric(row.sessions, 'number', locale)}</td><td className="px-3 py-3 text-right font-mono tabular-nums">{formatMetric(row.aiRequests, 'number', locale)}</td><td className="px-3 py-3 text-right font-mono tabular-nums">{insufficient ? <span className="text-[var(--color-text-muted)]">{copy.insufficient}</span> : formatMetric(aiSuccessRate, 'percent', locale)}</td><td className="px-3 py-3 text-right font-mono tabular-nums">{formatMetric(row.registrations, 'number', locale)}</td><td className="px-3 py-3 text-right font-mono tabular-nums">{formatMetric(row.serviceRequests, 'number', locale)}</td><td className="px-3 py-3 text-right font-mono tabular-nums">{insufficient ? <span className="text-[var(--color-text-muted)]">{copy.insufficient}</span> : formatMetric(conversion, 'percent', locale)}</td></tr>;
      })}</tbody></table></div>
      {!rows.length && <p className="px-4 py-8 text-sm text-[var(--color-text-secondary)]">{isCn ? '没有匹配的渠道。' : 'No matching channels.'}</p>}
    </section>

    <ChannelTrend daily={data?.daily || []} selected={selected} isCn={isCn} />
    <section className="grid gap-3 border-t border-[var(--color-border)] pt-4 text-sm sm:grid-cols-2"><div><h2 className="font-semibold text-[var(--color-text)]">{copy.operational}</h2><p className="mt-1 text-[var(--color-text-secondary)]">{copy.operationalHint}</p></div><div><h2 className="font-semibold text-[var(--color-text)]">{copy.dataQuality}</h2><p className="mt-1 text-[var(--color-text-secondary)]">{copy.qualityHint}</p></div></section>
  </div>;
}
