import { useEffect, useRef, useState } from 'react';
import { PromotionFilters, createPromotionFilters } from '../components/promotion/PromotionFilters.jsx';
import { PromotionOverview } from '../components/promotion/PromotionOverview.jsx';
import { runtimeConfig } from '../config/runtime';
import { getPromotionOverview } from '../services/api.js';

const EMPTY_STATE = { status: 'loading', data: null, error: '' };

export function PromotionAnalyticsPage() {
  const isCn = runtimeConfig.locale === 'zh-CN';
  const [activeTab, setActiveTab] = useState('overview');
  const [draftFilters, setDraftFilters] = useState(() => createPromotionFilters(runtimeConfig.market));
  const [activeFilters, setActiveFilters] = useState(() => createPromotionFilters(runtimeConfig.market));
  const [overviewState, setOverviewState] = useState(EMPTY_STATE);
  const [reloadKey, setReloadKey] = useState(0);
  const sequence = useRef(0);

  useEffect(() => {
    if (activeTab !== 'overview') return undefined;
    const controller = new AbortController();
    const requestNumber = ++sequence.current;
    setOverviewState({ status: 'loading', data: null, error: '' });
    getPromotionOverview(activeFilters, controller.signal)
      .then((data) => {
        if (sequence.current === requestNumber) setOverviewState({ status: 'ready', data, error: '' });
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && sequence.current === requestNumber) {
          setOverviewState({ status: 'error', data: null, error: error?.message || (isCn ? '推广分析暂时不可用' : 'Promotion analytics is temporarily unavailable') });
        }
      });
    return () => controller.abort();
  }, [activeFilters, reloadKey, activeTab, isCn]);

  const overview = overviewState.data;
  const allowedMarkets = overview?.allowed_markets || [runtimeConfig.market];
  const reportingTimezone = overview?.reporting_timezone || 'Asia/Shanghai';
  const coverageStart = overview?.data_quality?.coverageStart || overview?.dataQuality?.coverageStart;
  const tabCopy = isCn
    ? { overview: '推广概览', channels: '渠道分析', loading: '正在读取推广概览', retry: '重试', error: '无法读取推广概览', unavailable: '渠道分析将在下一步提供，当前不会请求渠道数据。' }
    : { overview: 'Overview', channels: 'Channel Analysis', loading: 'Loading promotion overview', retry: 'Retry', error: 'Unable to load promotion overview', unavailable: 'Channel analysis is the next step. This tab does not request channel data yet.' };

  const applyFilters = () => setActiveFilters({ ...draftFilters });

  return (
    <section aria-label={isCn ? '推广分析工作区' : 'Promotion analytics workspace'}>
      <header className="border-b border-[var(--color-border)] pb-4">
        <p className="font-mono text-xs tracking-[0.18em] text-[var(--color-primary)]">SAGEMRO / ANALYTICS</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{isCn ? '推广分析' : 'Promotion Analytics'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">{isCn ? '面向运营的流量、AI 可用性与转化测量台。' : 'An operations instrument panel for traffic, AI availability, and conversion.'}</p>
      </header>
      <div className="mt-4 border-b border-[var(--color-border)]" role="tablist" aria-label={isCn ? '推广分析视图' : 'Promotion analytics views'}>
        {[['overview', tabCopy.overview], ['channels', tabCopy.channels]].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={activeTab === key} onClick={() => setActiveTab(key)} className={`min-h-10 border-b-2 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${activeTab === key ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}>{label}</button>)}
      </div>
      <PromotionFilters filters={draftFilters} allowedMarkets={allowedMarkets} onChange={setDraftFilters} onApply={applyFilters} isCn={isCn} reportingTimezone={reportingTimezone} coverageStart={coverageStart} />
      <div className="mt-4" role="tabpanel" aria-busy={activeTab === 'overview' && overviewState.status === 'loading'}>
        {activeTab === 'channels' ? <section className="border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-secondary)]"><h2 className="font-semibold text-[var(--color-text)]">{tabCopy.channels}</h2><p className="mt-2">{tabCopy.unavailable}</p></section> : <OverviewState state={overviewState} isCn={isCn} retry={() => setReloadKey((current) => current + 1)} copy={tabCopy} />}
      </div>
    </section>
  );
}

function OverviewState({ state, isCn, retry, copy }) {
  if (state.status === 'loading') {
    return <div className="space-y-4" aria-label={copy.loading}><div className="h-20 border border-[var(--color-border)] bg-[var(--color-surface-elevated)]" /><div className="h-32 border border-[var(--color-border)] bg-[var(--color-surface)]" /><div className="grid gap-4 lg:grid-cols-2"><div className="h-52 border border-[var(--color-border)] bg-[var(--color-surface)]" /><div className="h-52 border border-[var(--color-border)] bg-[var(--color-surface)]" /></div></div>;
  }
  if (state.status === 'error') {
    return <section className="border border-[var(--color-error)]/50 bg-[var(--color-error)]/10 p-4 text-[var(--color-text)]" role="alert"><h2 className="font-semibold">{copy.error}</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{state.error}</p><button type="button" onClick={retry} className="mt-4 rounded-md border border-[var(--color-error)]/60 px-3 py-2 text-sm text-[var(--color-text)] outline-none hover:bg-[var(--color-error)]/10 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">{copy.retry}</button></section>;
  }
  return <PromotionOverview data={state.data} isCn={isCn} />;
}
