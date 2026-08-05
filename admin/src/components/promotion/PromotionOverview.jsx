import { useMemo, useState } from 'react';
import { buildLinePoints, formatChange, formatMetric, statusTone } from '../../pages/promotionAnalyticsView.js';

const STATUS_CLASSES = {
  success: 'border-[var(--color-success)]/50 bg-[var(--color-success)]/10 text-[var(--color-success)]',
  warning: 'border-[var(--color-warning)]/50 bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
  error: 'border-[var(--color-error)]/50 bg-[var(--color-error)]/10 text-[var(--color-error)]',
};

const REASON_LABELS = {
  ai_success_rate: ['AI success rate is below the operating threshold', 'AI 成功率低于运行门槛'],
  recent_ai_failures: ['Five recent AI requests did not complete', '最近 5 次 AI 请求均未完成'],
  traffic_drop: ['Traffic is below the comparison window', '流量低于对比周期'],
  conversion_drop: ['Service-request conversion is below the comparison window', '服务请求转化低于对比周期'],
  unattributed_sessions: ['Too much traffic lacks channel attribution', '过多流量缺少渠道归因'],
};

function value(data, key) {
  return data && data[key] !== undefined ? data[key] : null;
}

function comparableValue(data, key) {
  const raw = value(data, key);
  if (raw === null || raw === undefined || raw === '') return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function changed(current, previous, key) {
  const currentValue = comparableValue(current, key);
  const previousValue = comparableValue(previous, key);
  if (currentValue === null || previousValue === null || previousValue === 0) return null;
  return (currentValue - previousValue) / Math.abs(previousValue);
}

function metricChange(current, previous, key, type) {
  if (type === 'percent') {
    const now = comparableValue(current, key);
    const before = comparableValue(previous, key);
    return now !== null && before !== null ? now - before : null;
  }
  return changed(current, previous, key);
}

function reasonText(reason, isCn) {
  const label = REASON_LABELS[reason?.metric] || (isCn ? ['运行状态需要人工检查', '运行状态需要人工检查'] : ['Operational condition needs review', 'Operational condition needs review']);
  const ratioMetric = ['ai_success_rate', 'traffic_drop', 'conversion_drop', 'unattributed_sessions'].includes(reason?.metric);
  const formatter = ratioMetric ? 'percent' : 'number';
  const locale = isCn ? 'zh-CN' : 'en';
  const details = isCn
    ? `当前 ${formatMetric(reason?.value, formatter, locale)}；门槛 ${formatMetric(reason?.threshold, formatter, locale)}；样本 ${formatMetric(reason?.sampleCount, 'number', locale)}`
    : `Current ${formatMetric(reason?.value, formatter, locale)}; threshold ${formatMetric(reason?.threshold, formatter, locale)}; sample ${formatMetric(reason?.sampleCount, 'number', locale)}`;
  return { title: label[isCn ? 1 : 0], details };
}

function SampleState({ sampleStatus, isCn }) {
  if (sampleStatus === 'no_data') return <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{isCn ? '暂无样本' : 'No data'}</p>;
  if (sampleStatus === 'insufficient') return <p className="mt-4 text-sm text-[var(--color-warning)]">{isCn ? '样本不足：数量可供参考，比例暂不作健康判断。' : 'Insufficient sample: counts are shown, but rates are not used for health decisions.'}</p>;
  return null;
}

function MetricStrip({ current, previous, isCn }) {
  const locale = isCn ? 'zh-CN' : 'en';
  const metrics = [
    { label: isCn ? '访问会话' : 'Sessions', key: 'sessions', type: 'number' },
    { label: isCn ? 'AI 请求' : 'AI requests', key: 'aiRequests', type: 'number' },
    { label: isCn ? 'AI 成功率' : 'AI success rate', key: 'aiSuccessRate', type: 'percent' },
    { label: isCn ? '完成注册' : 'Completed registrations', key: 'registrationEvents', type: 'number' },
    { label: isCn ? '服务请求' : 'Service requests', key: 'serviceRequestEvents', type: 'number' },
  ];
  return (
    <section className="border border-[var(--color-border)] bg-[var(--color-surface)]" aria-label={isCn ? '核心仪表' : 'Core instruments'}>
      <div className="grid divide-y divide-[var(--color-border)] sm:grid-cols-5 sm:divide-x sm:divide-y-0">
        {metrics.map((metric) => {
          const change = metricChange(current, previous, metric.key, metric.type);
          return <div key={metric.key} className="min-w-0 px-4 py-4"><p className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{metric.label}</p><p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[var(--color-text)]">{formatMetric(value(current, metric.key), metric.type, locale)}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{isCn ? '较上周期 ' : 'vs prior '}<span className="font-mono tabular-nums">{formatChange(change, 'percent', locale)}</span></p></div>;
        })}
      </div>
    </section>
  );
}

function Funnel({ current, isCn }) {
  const locale = isCn ? 'zh-CN' : 'en';
  const rows = [
    [isCn ? '访客' : 'Visitors', 'visitors'],
    [isCn ? 'AI 访客' : 'AI visitors', 'aiVisitors'],
    [isCn ? '注册访客' : 'Registration visitors', 'registrationVisitors'],
    [isCn ? '服务访客' : 'Service visitors', 'serviceVisitors'],
  ];
  const maximum = Math.max(1, ...rows.map(([, key]) => Number(value(current, key)) || 0));
  return <section className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="text-sm font-semibold text-[var(--color-text)]">{isCn ? '访客漏斗' : 'Visitor funnel'}</h2><div className="mt-4 space-y-3">{rows.map(([label, key]) => { const count = Number(value(current, key)) || 0; return <div key={key}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="text-[var(--color-text-secondary)]">{label}</span><span className="font-mono tabular-nums text-[var(--color-text)]">{formatMetric(value(current, key), 'number', locale)}</span></div><div className="h-2 bg-[var(--color-surface-elevated)]"><div className="h-full bg-[var(--color-primary)]" style={{ width: `${(count / maximum) * 100}%` }} /></div></div>; })}</div></section>;
}

function Trend({ daily, isCn }) {
  const [metric, setMetric] = useState('sessions');
  const locale = isCn ? 'zh-CN' : 'en';
  const values = (daily || []).map((row) => Number(row?.[metric]) || 0);
  const points = useMemo(() => buildLinePoints(values, 300, 104).join(' '), [values]);
  const total = values.reduce((sum, number) => sum + number, 0);
  const title = metric === 'sessions' ? (isCn ? '访问会话' : 'Sessions') : (isCn ? '服务请求' : 'Service requests');
  const summary = isCn ? `每日趋势：${title}，共 ${formatMetric(total, 'number', locale)}。` : `Daily trend: ${title}, ${formatMetric(total, 'number', locale)} total.`;
  return <section className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-[var(--color-text)]">{isCn ? '每日趋势' : 'Daily trend'}</h2><select value={metric} onChange={(event) => setMetric(event.target.value)} className="rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-xs outline-none focus:border-[var(--color-primary)]" aria-label={isCn ? '趋势指标' : 'Trend metric'}><option value="sessions">{isCn ? '访问会话' : 'Sessions'}</option><option value="serviceRequests">{isCn ? '服务请求' : 'Service requests'}</option></select></div><figure className="mt-4" aria-label={summary}><svg viewBox="0 0 320 130" className="h-36 w-full" role="img"><title>{summary}</title><line x1="10" y1="114" x2="310" y2="114" stroke="var(--color-border)" /><line x1="10" y1="10" x2="10" y2="114" stroke="var(--color-border)" />{points && <polyline fill="none" stroke="var(--color-primary)" strokeWidth="3" points={points.split(' ').map((point) => { const [x, y] = point.split(','); return `${Number(x) + 10},${Number(y) + 10}`; }).join(' ')} />}</svg><figcaption className="flex justify-between text-xs text-[var(--color-text-muted)]"><span>{daily?.[0]?.date || '—'}</span><span>{daily?.[daily.length - 1]?.date || '—'}</span></figcaption></figure></section>;
}

function DataQuality({ dataQuality, isCn }) {
  const locale = isCn ? 'zh-CN' : 'en';
  const notices = [
    [isCn ? '归因覆盖率' : 'Attribution coverage', formatMetric(dataQuality?.attributionCoverage, 'percent', locale)],
    [isCn ? '旧口径事件' : 'Legacy-measurement events', formatMetric(dataQuality?.legacyEvents, 'number', locale)],
    [isCn ? '缺少访客标识的事件' : 'Events missing visitor linkage', formatMetric(dataQuality?.missingAnonymousEvents, 'number', locale)],
  ];
  return <section className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="text-sm font-semibold text-[var(--color-text)]">{isCn ? '数据质量' : 'Data quality'}</h2><dl className="mt-3 grid gap-3 sm:grid-cols-3">{notices.map(([label, metric]) => <div key={label}><dt className="text-xs text-[var(--color-text-muted)]">{label}</dt><dd className="mt-1 font-mono text-sm tabular-nums text-[var(--color-text)]">{metric}</dd></div>)}</dl></section>;
}

export function PromotionOverview({ data, isCn }) {
  const current = data?.current || {};
  const previous = data?.previous || {};
  const health = data?.health || { level: 'normal', reasons: [] };
  const tone = statusTone(health.level);
  const statusLabel = isCn ? ({ normal: '运行正常', warning: '需要关注', critical: '严重异常' }[health.level] || '运行正常') : ({ normal: 'Operating normally', warning: 'Needs attention', critical: 'Critical condition' }[health.level] || 'Operating normally');
  const reasonCount = health.reasons?.length || 0;
  return <div className="space-y-4" aria-live="polite">
    <section className={`border ${STATUS_CLASSES[tone]} p-4`}><div className="-mx-4 -mt-4 mb-4 grid h-1 grid-cols-3 gap-px bg-[var(--color-border)]" aria-hidden="true"><span className="bg-current" /><span className="bg-current" /><span className="bg-current" /></div><div className="flex flex-wrap items-baseline justify-between gap-2"><div><p className="text-xs uppercase tracking-[0.16em] opacity-80">{isCn ? '运行信号' : 'Operational signal'}</p><h2 className="mt-1 text-lg font-semibold">{statusLabel}</h2></div><p className="font-mono text-sm tabular-nums">{reasonCount} {isCn ? '项触发原因' : 'triggered reasons'}</p></div>{reasonCount > 0 && <ul className="mt-3 space-y-2 border-t border-current/20 pt-3">{health.reasons.map((reason, index) => { const copy = reasonText(reason, isCn); return <li key={`${reason.metric}-${index}`}><p className="text-sm font-medium">{copy.title}</p><p className="mt-0.5 text-xs opacity-90">{copy.details}</p></li>; })}</ul>}</section>
    <SampleState sampleStatus={current.sampleStatus || current.sample_status} isCn={isCn} />
    <MetricStrip current={current} previous={previous} isCn={isCn} />
    <div className="grid gap-4 lg:grid-cols-2"><Funnel current={current} isCn={isCn} /><Trend daily={data?.daily || []} isCn={isCn} /></div>
    <section className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="text-sm font-semibold text-[var(--color-text)]">{isCn ? '运营提醒' : 'Operational reminders'}</h2>{reasonCount ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{isCn ? '请按上方触发原因排查当前运营状态。' : 'Use the triggered reasons above to investigate the current operating condition.'}</p> : <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{isCn ? '当前没有需要升级的运营提醒。' : 'No operational reminders need escalation right now.'}</p>}</section>
    <DataQuality dataQuality={data?.data_quality || data?.dataQuality} isCn={isCn} />
  </div>;
}
