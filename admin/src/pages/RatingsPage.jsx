import { useState, useEffect } from 'react';
import { getAdminRatings, replyToRating, getAdminPlatformRatings, getAdminCustomerRatings } from '../services/api';
import { runtimeConfig } from '../config/runtime';

const TEXT = {
  en: {
    loading: 'Loading...',
    loadFailed: 'Failed to load reviews.',
    retry: 'Retry',
    total: (count) => `${count} total`,
    totalReviews: (count) => `${count} review(s)`,
    totalInternalReviews: (count) => `${count} review(s), admin only`,
    lowScoreActive: '★ Low-score alerts on',
    lowScore: 'Low-score alerts',
    sortNewest: 'Newest first',
    sortScoreAsc: 'Score ascending',
    sortScoreDesc: 'Score descending',
    headers: {
      orderNo: 'Service No.',
      customer: 'Customer',
      engineer: 'Engineer',
      timeliness: 'Timeliness',
      technical: 'Technical',
      communication: 'Communication',
      professional: 'Professional',
      overall: 'Overall',
      time: 'Time',
      rating: 'Rating',
      comment: 'Comment',
    },
    emptyRatings: 'No review data',
    emptyPlatformRatings: 'No platform reviews',
    comment: 'Comment',
    adminReply: 'Admin reply',
    replyToReview: 'Reply to review',
    replyPlaceholder: 'Enter reply...',
    replying: 'Replying',
    reply: 'Reply',
    replyFailed: 'Reply failed: ',
    previous: 'Previous',
    next: 'Next',
    tabs: {
      workorder: 'Service reviews',
      platform: 'Platform reviews',
      customer: 'Customer scores',
    },
    title: 'Review Management',
  },
  'zh-CN': {
    loading: '加载中...',
    loadFailed: '评价数据加载失败。',
    retry: '重试',
    total: (count) => `共 ${count} 条`,
    totalReviews: (count) => `共 ${count} 条评价`,
    totalInternalReviews: (count) => `共 ${count} 条评价（仅管理员可见）`,
    lowScoreActive: '★ 低分预警中',
    lowScore: '低分预警',
    sortNewest: '按时间倒序',
    sortScoreAsc: '按评分升序',
    sortScoreDesc: '按评分降序',
    headers: {
      orderNo: '工单号',
      customer: '客户',
      engineer: '工程师',
      timeliness: '时效',
      technical: '技术',
      communication: '沟通',
      professional: '专业',
      overall: '综合',
      time: '时间',
      rating: '评分',
      comment: '评价内容',
    },
    emptyRatings: '暂无评价数据',
    emptyPlatformRatings: '暂无平台评价',
    comment: '评价内容',
    adminReply: '管理员回复',
    replyToReview: '回复评价',
    replyPlaceholder: '输入回复内容...',
    replying: '回复中',
    reply: '回复',
    replyFailed: '回复失败：',
    previous: '上一页',
    next: '下一页',
    tabs: {
      workorder: '工单评价',
      platform: '平台评价',
      customer: '客户评分',
    },
    title: '评价管理',
  },
};

function Stars({ value, size = 'sm' }) {
  const sizeClass = size === 'sm' ? 'text-sm' : 'text-base';
  return (
    <span className={`${sizeClass} leading-none`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= value ? 'text-yellow-400' : 'text-[var(--color-text-muted)]/30'}>★</span>
      ))}
    </span>
  );
}

function AvgScore({ score }) {
  const num = parseFloat(score);
  const color = num < 2 ? 'text-red-500 font-bold' : num < 3 ? 'text-orange-400 font-medium' : num < 4 ? 'text-yellow-400' : 'text-green-400';
  return <span className={color}>{score}</span>;
}

// ===== 工单评价 Tab =====
function WorkOrderRatings({ t }) {
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lowScore, setLowScore] = useState(false);
  const [sort, setSort] = useState('created_at_desc');
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const pageSize = 20;

  const load = () => {
    setLoading(true);
    setLoadError('');
    const filters = { sort };
    if (lowScore) filters.lowScore = 'true';
    getAdminRatings(page, pageSize, filters)
      .then(setData)
      .catch((error) => setLoadError(error.message || t.loadFailed))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, lowScore, sort, loadAttempt]);

  const handleReply = async (ratingId) => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await replyToRating(ratingId, replyText.trim());
      setReplyText('');
      load();
    } catch (e) {
      alert(t.replyFailed + e.message);
    } finally {
      setReplying(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={() => { setLowScore(!lowScore); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            lowScore ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'
          }`}
        >
          {lowScore ? t.lowScoreActive : t.lowScore}
        </button>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-lg text-xs bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
        >
          <option value="created_at_desc">{t.sortNewest}</option>
          <option value="score_asc">{t.sortScoreAsc}</option>
          <option value="score_desc">{t.sortScoreDesc}</option>
        </select>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">{t.total(data.total)}</span>
      </div>
      {loadError && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-error)]/40 bg-[var(--color-error)]/5 px-4 py-3 text-sm text-[var(--color-text-secondary)]"><span>{loadError}</span><button onClick={() => setLoadAttempt((current) => current + 1)} className="whitespace-nowrap rounded-lg border border-[var(--color-error)]/40 px-3 py-1.5 text-xs font-medium text-[var(--color-error)]">{t.retry}</button></div>}

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">{t.loading}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.orderNo}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.customer}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.engineer}</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.timeliness}</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.technical}</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.communication}</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.professional}</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.overall}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.time}</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-[var(--color-text-muted)]">{t.emptyRatings}</td></tr>
                ) : (
                  data.list.map((r) => {
                    const isLow = parseFloat(r.avg_score) < 3;
                    const isExpanded = expandedId === r.id;
                    return (
                      <>
                        <tr
                          key={r.id}
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className={`border-b border-[var(--color-border)]/50 cursor-pointer transition-colors ${
                            isLow ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-[var(--color-surface-elevated)]/50'
                          }`}
                        >
                          <td className="py-3 px-2 font-mono text-[var(--color-primary)]">{r.order_no || '-'}</td>
<td className="py-3 px-2">
                            <div>{r.customer_name || '-'}</div>
                            {r.customer_company && <div className="text-xs text-[var(--color-text-muted)]">{r.customer_company}</div>}
                          </td>
                          <td className="py-3 px-2">
                            <div>{r.engineer_name || '-'}</div>
                            {r.engineer_company && <div className="text-xs text-[var(--color-text-muted)]">{r.engineer_company}</div>}
                          </td>
                          <td className="py-3 px-2 text-center"><Stars value={r.rating_timeliness} /></td>
                          <td className="py-3 px-2 text-center"><Stars value={r.rating_technical} /></td>
                          <td className="py-3 px-2 text-center"><Stars value={r.rating_communication} /></td>
                          <td className="py-3 px-2 text-center"><Stars value={r.rating_professional} /></td>
                          <td className="py-3 px-2 text-center"><AvgScore score={r.avg_score} /></td>
                          <td className="py-3 px-2 text-[var(--color-text-secondary)] text-xs">{r.created_at?.slice(0, 16)?.replace('T', ' ')}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${r.id}-detail`} className="border-b border-[var(--color-border)]/50">
                            <td colSpan={9} className="px-2 py-3 bg-[var(--color-surface-elevated)]/30">
                              <div className="max-w-2xl space-y-3">
                                {r.comment && (
                                  <div>
                                    <div className="text-xs text-[var(--color-text-muted)] mb-1">{t.comment}</div>
                                    <div className="text-sm text-[var(--color-text-primary)]">{r.comment}</div>
                                  </div>
                                )}
                                {r.admin_reply ? (
                                  <div>
                                    <div className="text-xs text-[var(--color-text-muted)] mb-1">{t.adminReply}</div>
                                    <div className="text-sm text-[var(--color-primary)] bg-[var(--color-primary)]/5 rounded-lg p-2">{r.admin_reply.content}</div>
                                    <div className="text-xs text-[var(--color-text-muted)] mt-1">{r.admin_reply.created_at?.slice(0, 16)?.replace('T', ' ')}</div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="text-xs text-[var(--color-text-muted)] mb-1">{t.replyToReview}</div>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder={t.replyPlaceholder}
                                        className="flex-1 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleReply(r.id); }}
                                        disabled={replying || !replyText.trim()}
                                        className="px-3 py-1.5 text-sm bg-[var(--color-primary)] text-white rounded-lg disabled:opacity-50"
                                      >
                                        {replying ? t.replying : t.reply}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors">{t.previous}</button>
              <span className="text-sm text-[var(--color-text-secondary)]">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors">{t.next}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== 平台评价 Tab =====
function PlatformRatings({ t }) {
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    getAdminPlatformRatings(page, pageSize).then(setData).catch((error) => setLoadError(error.message || t.loadFailed)).finally(() => setLoading(false));
  }, [page, loadAttempt]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div>
      <div className="text-xs text-[var(--color-text-muted)] mb-4">{t.totalReviews(data.total)}</div>
      {loadError && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-error)]/40 bg-[var(--color-error)]/5 px-4 py-3 text-sm text-[var(--color-text-secondary)]"><span>{loadError}</span><button onClick={() => setLoadAttempt((current) => current + 1)} className="whitespace-nowrap rounded-lg border border-[var(--color-error)]/40 px-3 py-1.5 text-xs font-medium text-[var(--color-error)]">{t.retry}</button></div>}
      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">{t.loading}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.customer}</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.rating}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.comment}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.time}</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-[var(--color-text-muted)]">{t.emptyPlatformRatings}</td></tr>
                ) : (
                  data.list.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--color-border)]/50">
                      <td className="py-3 px-2">
                        <div>{r.customer_name || '-'}</div>
                        {r.customer_company && <div className="text-xs text-[var(--color-text-muted)]">{r.customer_company}</div>}
                      </td>
                      <td className="py-3 px-2 text-center"><Stars value={r.rating} /></td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)]">{r.comment || '-'}</td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)] text-xs">{r.created_at?.slice(0, 16)?.replace('T', ' ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30">{t.previous}</button>
              <span className="text-sm text-[var(--color-text-secondary)]">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30">{t.next}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== 客户评分 Tab =====
function CustomerRatings({ t }) {
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    getAdminCustomerRatings(page, pageSize).then(setData).catch((error) => setLoadError(error.message || t.loadFailed)).finally(() => setLoading(false));
  }, [page, loadAttempt]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div>
      <div className="text-xs text-[var(--color-text-muted)] mb-4">{t.totalInternalReviews(data.total)}</div>
      {loadError && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-error)]/40 bg-[var(--color-error)]/5 px-4 py-3 text-sm text-[var(--color-text-secondary)]"><span>{loadError}</span><button onClick={() => setLoadAttempt((current) => current + 1)} className="whitespace-nowrap rounded-lg border border-[var(--color-error)]/40 px-3 py-1.5 text-xs font-medium text-[var(--color-error)]">{t.retry}</button></div>}
      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">{t.loading}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.orderNo}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.engineer}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.customer}</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.rating}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.comment}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.time}</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-[var(--color-text-muted)]">{t.emptyRatings}</td></tr>
                ) : (
                  data.list.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--color-border)]/50">
                      <td className="py-3 px-2 font-mono text-[var(--color-primary)]">{r.order_no || '-'}</td>
                      <td className="py-3 px-2">
                        <div>{r.engineer_name || '-'}</div>
                        {r.engineer_company && <div className="text-xs text-[var(--color-text-muted)]">{r.engineer_company}</div>}
                      </td>
                      <td className="py-3 px-2">
                        <div>{r.customer_name || '-'}</div>
                        {r.customer_company && <div className="text-xs text-[var(--color-text-muted)]">{r.customer_company}</div>}
                      </td>
                      <td className="py-3 px-2 text-center"><Stars value={r.rating} /></td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)]">{r.comment || '-'}</td>
                      <td className="py-3 px-2 text-[var(--color-text-secondary)] text-xs">{r.created_at?.slice(0, 16)?.replace('T', ' ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30">{t.previous}</button>
              <span className="text-sm text-[var(--color-text-secondary)]">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30">{t.next}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== 主页面 =====
export function RatingsPage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const [tab, setTab] = useState('workorder');

  const tabs = [
    { key: 'workorder', label: t.tabs.workorder },
    { key: 'platform', label: t.tabs.platform },
    { key: 'customer', label: t.tabs.customer },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">{t.title}</h2>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'workorder' && <WorkOrderRatings t={t} />}
      {tab === 'platform' && <PlatformRatings t={t} />}
      {tab === 'customer' && <CustomerRatings t={t} />}
    </div>
  );
}
