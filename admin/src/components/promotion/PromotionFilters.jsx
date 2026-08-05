import { DIRECT_ATTRIBUTION_FILTER } from '../../pages/promotionAnalyticsView.js';

function reportDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function datesForDays(days) {
  const end = new Date();
  const endDate = reportDate(end);
  const start = new Date(`${endDate}T00:00:00+08:00`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { from: reportDate(start), to: endDate };
}

export function createPromotionFilters(market) {
  return { ...datesForDays(7), market, source: '', medium: '', campaign: '' };
}

export function PromotionFilters({ filters, allowedMarkets, onChange, onApply, isCn, reportingTimezone, coverageStart }) {
  const t = isCn ? {
    period: '报告周期', today: '今天', seven: '近 7 天', thirty: '近 30 天', custom: '自定义',
    from: '开始日期', to: '结束日期', market: '市场', all: '全部市场', source: '来源', medium: '媒介', campaign: '活动',
    apply: '应用筛选', timezone: '报告时区', coverage: '新口径覆盖起点', com: '国际站（COM）', cn: '中国站（CN）',
  } : {
    period: 'Report window', today: 'Today', seven: 'Last 7 days', thirty: 'Last 30 days', custom: 'Custom',
    from: 'From', to: 'To', market: 'Market', all: 'All markets', source: 'Source', medium: 'Medium', campaign: 'Campaign',
    apply: 'Apply filters', timezone: 'Reporting timezone', coverage: 'v2 coverage starts', com: 'COM', cn: 'CN',
  };
  const scopedMarkets = [...new Set((allowedMarkets || []).filter((market) => market === 'com' || market === 'cn'))];
  const usePreset = (days) => onChange({ ...filters, ...datesForDays(days) });

  return (
    <section className="border-y border-[var(--color-border)] py-4" aria-label={t.period}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="mr-2 flex flex-wrap gap-1" role="group" aria-label={t.period}>
          {[[1, t.today], [7, t.seven], [30, t.thirty]].map(([days, label]) => (
            <button key={days} type="button" onClick={() => usePreset(days)} className="min-h-9 rounded-md border border-[var(--color-border)] px-2.5 text-xs text-[var(--color-text-secondary)] outline-none hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
              {label}
            </button>
          ))}
        </div>
        <FilterField label={t.from}><input type="date" value={filters.from} onChange={(event) => onChange({ ...filters, from: event.target.value })} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" /></FilterField>
        <FilterField label={t.to}><input type="date" value={filters.to} onChange={(event) => onChange({ ...filters, to: event.target.value })} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" /></FilterField>
        <FilterField label={t.market}>
          <select value={filters.market} onChange={(event) => onChange({ ...filters, market: event.target.value })} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]">
            {scopedMarkets.length === 2 && <option value="all">{t.all}</option>}
            {scopedMarkets.map((market) => <option key={market} value={market}>{t[market]}</option>)}
          </select>
        </FilterField>
        <FilterField label={t.source}><input value={visibleAttributionFilter(filters.source)} maxLength={100} onChange={(event) => onChange({ ...filters, source: event.target.value })} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" /></FilterField>
        <FilterField label={t.medium}><input value={visibleAttributionFilter(filters.medium)} maxLength={100} onChange={(event) => onChange({ ...filters, medium: event.target.value })} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" /></FilterField>
        <FilterField label={t.campaign}><input value={visibleAttributionFilter(filters.campaign)} maxLength={200} onChange={(event) => onChange({ ...filters, campaign: event.target.value })} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" /></FilterField>
        <button type="button" onClick={onApply} className="min-h-9 rounded-md bg-[var(--color-primary)] px-3 text-sm font-semibold text-black outline-none hover:bg-[var(--color-primary-dark)] focus-visible:ring-2 focus-visible:ring-white">
          {t.apply}
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        {t.timezone}: <span className="font-mono tabular-nums text-[var(--color-text-secondary)]">{reportingTimezone || 'Asia/Shanghai'}</span>
        {coverageStart && <> <span aria-hidden="true">·</span> {t.coverage}: <span className="font-mono tabular-nums text-[var(--color-text-secondary)]">{coverageStart}</span></>}
      </p>
    </section>
  );
}

function visibleAttributionFilter(value) {
  return value === DIRECT_ATTRIBUTION_FILTER ? '' : value;
}

function FilterField({ label, children }) {
  return <label className="grid min-w-[7rem] gap-1 text-xs text-[var(--color-text-muted)]">{label}{children}</label>;
}
