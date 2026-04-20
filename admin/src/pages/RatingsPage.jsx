import { useState, useEffect } from 'react';
import { getAdminRatings, replyToRating, getAdminPlatformRatings, getAdminCustomerRatings } from '../services/api';

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
function WorkOrderRatings() {
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lowScore, setLowScore] = useState(false);
  const [sort, setSort] = useState('created_at_desc');
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const pageSize = 20;

  const load = () => {
    setLoading(true);
    const filters = { sort };
    if (lowScore) filters.lowScore = 'true';
    getAdminRatings(page, pageSize, filters)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, lowScore, sort]);

  const handleReply = async (ratingId) => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await replyToRating(ratingId, replyText.trim());
      setReplyText('');
      load();
    } catch (e) {
      alert('回复失败：' + e.message);
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
          {lowScore ? '★ 低分预警中' : '低分预警'}
        </button>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-lg text-xs bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
        >
          <option value="created_at_desc">按时间倒序</option>
          <option value="score_asc">按评分升序</option>
          <option value="score_desc">按评分降序</option>
        </select>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">共 {data.total} 条</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">加载中...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">工单号</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">客户</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">工程师</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">时效</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">技术</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">沟通</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">专业</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">综合</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-[var(--color-text-muted)]">暂无评价数据</td></tr>
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
                          <td className="py-3 px-2">{r.customer_name || '-'}</td>
                          <td className="py-3 px-2">{r.engineer_name || '-'}</td>
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
                                    <div className="text-xs text-[var(--color-text-muted)] mb-1">评价内容</div>
                                    <div className="text-sm text-[var(--color-text-primary)]">{r.comment}</div>
                                  </div>
                                )}
                                {r.admin_reply ? (
                                  <div>
                                    <div className="text-xs text-[var(--color-text-muted)] mb-1">管理员回复</div>
                                    <div className="text-sm text-[var(--color-primary)] bg-[var(--color-primary)]/5 rounded-lg p-2">{r.admin_reply.content}</div>
                                    <div className="text-xs text-[var(--color-text-muted)] mt-1">{r.admin_reply.created_at?.slice(0, 16)?.replace('T', ' ')}</div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="text-xs text-[var(--color-text-muted)] mb-1">回复评价</div>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="输入回复内容..."
                                        className="flex-1 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleReply(r.id); }}
                                        disabled={replying || !replyText.trim()}
                                        className="px-3 py-1.5 text-sm bg-[var(--color-primary)] text-white rounded-lg disabled:opacity-50"
                                      >
                                        {replying ? '回复中' : '回复'}
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors">上一页</button>
              <span className="text-sm text-[var(--color-text-secondary)]">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors">下一页</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== 平台评价 Tab =====
function PlatformRatings() {
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    getAdminPlatformRatings(page, pageSize).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div>
      <div className="text-xs text-[var(--color-text-muted)] mb-4">共 {data.total} 条评价</div>
      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">加载中...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">客户</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">评分</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">评价内容</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-[var(--color-text-muted)]">暂无平台评价</td></tr>
                ) : (
                  data.list.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--color-border)]/50">
                      <td className="py-3 px-2">{r.customer_name || '-'}</td>
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30">上一页</button>
              <span className="text-sm text-[var(--color-text-secondary)]">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30">下一页</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== 客户评分 Tab =====
function CustomerRatings() {
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    getAdminCustomerRatings(page, pageSize).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div>
      <div className="text-xs text-[var(--color-text-muted)] mb-4">共 {data.total} 条评价（仅管理员可见）</div>
      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">加载中...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">工单号</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">工程师</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">客户</th>
                  <th className="text-center py-3 px-2 text-[var(--color-text-secondary)] font-medium">评分</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">评价内容</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-[var(--color-text-muted)]">暂无评价数据</td></tr>
                ) : (
                  data.list.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--color-border)]/50">
                      <td className="py-3 px-2 font-mono text-[var(--color-primary)]">{r.order_no || '-'}</td>
                      <td className="py-3 px-2">{r.engineer_name || '-'}</td>
                      <td className="py-3 px-2">{r.customer_name || '-'}</td>
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30">上一页</button>
              <span className="text-sm text-[var(--color-text-secondary)]">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30">下一页</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== 主页面 =====
export function RatingsPage() {
  const [tab, setTab] = useState('workorder');

  const tabs = [
    { key: 'workorder', label: '工单评价' },
    { key: 'platform', label: '平台评价' },
    { key: 'customer', label: '客户评分' },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">评价管理</h2>

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

      {tab === 'workorder' && <WorkOrderRatings />}
      {tab === 'platform' && <PlatformRatings />}
      {tab === 'customer' && <CustomerRatings />}
    </div>
  );
}
