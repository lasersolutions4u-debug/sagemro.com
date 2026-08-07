import { formatMetric } from '../../pages/promotionAnalyticsView.js';

function contentType(path, isCn) {
  const label = String(path || '');
  if (label.startsWith('/tools/')) return isCn ? '工具' : 'Tool';
  if (label.startsWith('/insights/')) return isCn ? '洞察' : 'Insight';
  if (label.startsWith('/products/')) return isCn ? '产品' : 'Product';
  return isCn ? '页面' : 'Page';
}

function sourceLabel(row, isCn) {
  const source = row?.source || (isCn ? '未知来源' : 'Unknown source');
  const medium = row?.medium || (isCn ? '未知媒介' : 'Unknown medium');
  return `${source} / ${medium}`;
}

function engagementRate(row, isCn) {
  const sessions = Number(row?.landingSessions);
  const engaged = Number(row?.engagedSessions);
  if (!Number.isFinite(sessions) || sessions < 20) return isCn ? '数据不足' : 'Insufficient data';
  return Number.isFinite(engaged) ? formatMetric(engaged / sessions, 'percent', isCn ? 'zh-CN' : 'en') : '—';
}

function MetricStrip({ summary, isCn }) {
  const locale = isCn ? 'zh-CN' : 'en';
  const metrics = [
    [isCn ? '着陆会话' : 'Landing sessions', 'landingSessions'],
    [isCn ? '参与会话' : 'Engaged sessions', 'engagedSessions'],
    [isCn ? '工具完成次数' : 'Tool completions', 'toolCompletions'],
    [isCn ? '转化 CTA 点击' : 'Conversion CTA clicks', 'ctaClicks'],
    [isCn ? '服务请求' : 'Service requests', 'serviceRequests'],
  ];
  return <section className="border border-[var(--color-border)] bg-[var(--color-surface)]" aria-label={isCn ? '自然搜索与 AI 引荐摘要' : 'Organic and AI referral summary'}><div className="grid divide-y divide-[var(--color-border)] sm:grid-cols-5 sm:divide-x sm:divide-y-0">{metrics.map(([label, key]) => <div key={key} className="min-w-0 px-4 py-4"><p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p><p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[var(--color-text)]">{formatMetric(summary?.[key], 'number', locale)}</p></div>)}</div></section>;
}

function EmptyTable({ label, isCn }) {
  return <p className="px-4 py-5 text-sm text-[var(--color-text-secondary)]">{isCn ? `暂无${label}数据` : `No ${label.toLowerCase()} data`}</p>;
}

function SourceTable({ rows, isCn }) {
  const copy = isCn
    ? { title: '来源表现', source: '来源 / 媒介', sessions: '会话', engagement: '参与率', tools: '工具完成', cta: 'CTA 点击', requests: '服务请求' }
    : { title: 'Source performance', source: 'Source / medium', sessions: 'Sessions', engagement: 'Engagement rate', tools: 'Tool completions', cta: 'CTA clicks', requests: 'Service requests' };
  const locale = isCn ? 'zh-CN' : 'en';
  return <section className="border border-[var(--color-border)] bg-[var(--color-surface)]"><h2 className="border-b border-[var(--color-border)] px-4 py-3 font-semibold text-[var(--color-text)]">{copy.title}</h2>{rows?.length ? <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-[var(--color-border)] text-left"><th scope="col" className="px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{copy.source}</th>{[copy.sessions, copy.engagement, copy.tools, copy.cta, copy.requests].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.source}-${row.medium}-${index}`} className="border-b border-[var(--color-border)] last:border-b-0"><th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-medium text-[var(--color-text)]">{sourceLabel(row, isCn)}</th><td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-text)]">{formatMetric(row.landingSessions, 'number', locale)}</td><td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-text-secondary)]">{engagementRate(row, isCn)}</td><td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-text)]">{formatMetric(row.toolCompletions, 'number', locale)}</td><td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-text)]">{formatMetric(row.ctaClicks, 'number', locale)}</td><td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-text)]">{formatMetric(row.serviceRequests, 'number', locale)}</td></tr>)}</tbody></table></div> : <EmptyTable label={copy.title} isCn={isCn} />}</section>;
}

function PageTable({ rows, isCn }) {
  const copy = isCn
    ? { title: '落地页表现', path: '路径', type: '内容类型', sessions: '会话', engaged: '参与会话', cta: 'CTA 点击', requests: '服务请求' }
    : { title: 'Landing page performance', path: 'Path', type: 'Content type', sessions: 'Sessions', engaged: 'Engaged sessions', cta: 'CTA clicks', requests: 'Service requests' };
  const locale = isCn ? 'zh-CN' : 'en';
  return <section className="border border-[var(--color-border)] bg-[var(--color-surface)]"><h2 className="border-b border-[var(--color-border)] px-4 py-3 font-semibold text-[var(--color-text)]">{copy.title}</h2>{rows?.length ? <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-[var(--color-border)] text-left"><th scope="col" className="px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{copy.path}</th>{[copy.type, copy.sessions, copy.engaged, copy.cta, copy.requests].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.pagePath}-${index}`} className="border-b border-[var(--color-border)] last:border-b-0"><th scope="row" className="max-w-72 break-all px-4 py-3 text-left font-mono font-medium text-[var(--color-text)]">{row.pagePath || '—'}</th><td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">{contentType(row.pagePath, isCn)}</td><td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-text)]">{formatMetric(row.landingSessions, 'number', locale)}</td><td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-text)]">{formatMetric(row.engagedSessions, 'number', locale)}</td><td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-text)]">{formatMetric(row.ctaClicks, 'number', locale)}</td><td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-text)]">{formatMetric(row.serviceRequests, 'number', locale)}</td></tr>)}</tbody></table></div> : <EmptyTable label={copy.title} isCn={isCn} />}</section>;
}

function DataQuality({ dataQuality, isCn }) {
  const locale = isCn ? 'zh-CN' : 'en';
  const rows = [
    [isCn ? '新口径覆盖起点' : 'v2 coverage starts', dataQuality?.coverageStart || '—'],
    [isCn ? '旧口径事件' : 'Legacy-measurement events', formatMetric(dataQuality?.legacyEvents, 'number', locale)],
    [isCn ? '已排除的直接访问会话' : 'Excluded direct sessions', formatMetric(dataQuality?.excludedDirectSessions, 'number', locale)],
  ];
  return <section className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="font-semibold text-[var(--color-text)]">{isCn ? '数据质量' : 'Data quality'}</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{isCn ? '仅汇总自然搜索与 AI 引荐流量；直接访问不计入本视图。' : 'This view aggregates organic and AI-referral traffic; direct traffic is excluded.'}</p><dl className="mt-3 grid gap-3 sm:grid-cols-3">{rows.map(([label, value]) => <div key={label}><dt className="text-xs text-[var(--color-text-muted)]">{label}</dt><dd className="mt-1 font-mono text-sm tabular-nums text-[var(--color-text)]">{value}</dd></div>)}</dl></section>;
}

export function OrganicAcquisition({ data, isCn }) {
  const sources = data?.sources || [];
  const pages = data?.pages || [];
  if (!sources.length && !pages.length) return <section className="border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-secondary)]"><h2 className="font-semibold text-[var(--color-text)]">{isCn ? '暂无自然搜索与 AI 引荐数据' : 'No acquisition data'}</h2></section>;
  return <div className="space-y-4" aria-live="polite"><MetricStrip summary={data?.summary} isCn={isCn} /><SourceTable rows={sources} isCn={isCn} /><PageTable rows={pages} isCn={isCn} /><DataQuality dataQuality={data?.dataQuality} isCn={isCn} /></div>;
}
