import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, MapPin, RefreshCw, ShieldCheck, UserRound, Wrench } from 'lucide-react';
import { getAdminEngineerApplications, updateAdminEngineerApplication } from '../services/api';
import { runtimeConfig } from '../config/runtime';

const STATUS_STYLE = {
  submitted: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  reviewing: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  qualified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  converted: 'bg-green-500/15 text-green-300 border-green-500/30',
  archived: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
};

const TEXT = {
  en: {
    title: 'Engineer Applications',
    badge: 'SAGEMRO Service Representative Network',
    subtitle: 'Review certified service representative applications. Approval here does not create an engineer account automatically.',
    all: 'All',
    marketAll: 'All markets',
    total: (count) => `${count} application(s)`,
    loading: 'Loading...',
    empty: 'No engineer applications yet',
    refresh: 'Refresh',
    statuses: {
      submitted: 'Submitted',
      reviewing: 'Reviewing',
      qualified: 'Qualified',
      rejected: 'Rejected',
      converted: 'Account created',
      archived: 'Archived',
    },
    headers: {
      applicant: 'Applicant',
      location: 'Location',
      regions: 'Service regions',
      skills: 'Skills',
      capacity: 'Capacity',
      experience: 'Experience',
      review: 'Review',
    },
    capacity: {
      can_travel: 'Travel',
      can_weekend: 'Weekend',
      can_night: 'Night support',
      has_tools: 'Tools',
    },
    notesPlaceholder: 'Review notes, next step, regional fit, account creation reminder...',
    convertedUserPlaceholder: 'Engineer user ID after account creation',
    save: 'Save review',
    saving: 'Saving...',
    saved: 'Application review updated.',
    failed: 'Update failed: ',
    accountHint: 'If approved, create the engineer account in Customers & Engineers, then mark this application as Account created.',
    previous: 'Previous',
    next: 'Next',
  },
  'zh-CN': {
    title: '工程师申请审核池',
    badge: 'SAGEMRO 认证服务代表网络',
    subtitle: '审核认证服务代表申请。这里的通过不自动创建工程师账号，账号仍由 Admin 在确认合作后人工分配。',
    all: '全部状态',
    marketAll: '全部市场',
    total: (count) => `共 ${count} 条申请`,
    loading: '加载中...',
    empty: '暂无工程师申请',
    refresh: '刷新',
    statuses: {
      submitted: '已提交',
      reviewing: '审核中',
      qualified: '可合作',
      rejected: '暂不合作',
      converted: '已创建账号',
      archived: '已归档',
    },
    headers: {
      applicant: '申请人',
      location: '所在地',
      regions: '可服务区域',
      skills: '技能标签',
      capacity: '服务条件',
      experience: '经验说明',
      review: '审核处理',
    },
    capacity: {
      can_travel: '可跨城',
      can_weekend: '可周末',
      can_night: '可夜间',
      has_tools: '有工具',
    },
    notesPlaceholder: '审核备注、下一步、区域匹配、是否需要创建账号...',
    convertedUserPlaceholder: '创建账号后的工程师 ID',
    save: '保存审核',
    saving: '保存中...',
    saved: '申请审核已更新。',
    failed: '更新失败：',
    accountHint: '如确认合作，请到“客户与工程师”创建工程师账号，再把该申请标记为“已创建账号”。',
    previous: '上一页',
    next: '下一页',
  },
};

function joinList(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value || '-';
}

function renderTags(value) {
  const list = Array.isArray(value)
    ? value.filter(Boolean)
    : String(value || '')
      .split(/[,;，、]/)
      .map((item) => item.trim())
      .filter(Boolean);
  if (!list.length) return <span className="mt-1 block text-[var(--color-text-muted)]">-</span>;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {list.map((item) => (
        <span key={item} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
          {item}
        </span>
      ))}
    </div>
  );
}

function contactLine(application) {
  return [application.phone, application.email, application.whatsapp].filter(Boolean).join(' / ') || '-';
}

function applicantInitial(name = '') {
  return String(name || 'S').trim().slice(0, 1).toUpperCase();
}

export function EngineerApplicationsPage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState({});
  const pageSize = 20;

  const load = () => {
    setLoading(true);
    getAdminEngineerApplications(page, pageSize, statusFilter, marketFilter)
      .then((nextData) => {
        setData(nextData);
        const nextDrafts = {};
        (nextData.list || []).forEach((item) => {
          nextDrafts[item.id] = {
            status: item.status || 'submitted',
            review_notes: item.review_notes || '',
            converted_user_id: item.converted_user_id || '',
          };
        });
        setDrafts(nextDrafts);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, statusFilter, marketFilter]);

  const updateDraft = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const saveReview = async (application) => {
    const draft = drafts[application.id] || {};
    setSavingId(application.id);
    setMessage('');
    try {
      await updateAdminEngineerApplication(application.id, draft);
      setMessage(t.saved);
      load();
    } catch (error) {
      setMessage(t.failed + error.message);
    } finally {
      setSavingId('');
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const statusKeys = Object.keys(t.statuses);

  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[linear-gradient(135deg,_rgba(245,158,11,0.14),_rgba(42,42,60,0.94)_38%,_rgba(30,30,46,1))] p-5 shadow-lg shadow-black/10">
        <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-bl-[4rem] bg-[var(--color-primary)]/15 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
            <ClipboardList size={14} />
            {t.badge}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{t.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
            {t.subtitle}
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--color-text-secondary)] transition hover:bg-white/10 hover:text-[var(--color-text)]"
        >
          <RefreshCw size={15} />
          {t.refresh}
        </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        {['all', ...statusKeys].map((status) => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === status
                ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                : 'border-transparent bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'
            }`}
          >
            {status === 'all' ? t.all : t.statuses[status]}
          </button>
        ))}
        <select
          value={marketFilter}
          onChange={(event) => { setMarketFilter(event.target.value); setPage(1); }}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
        >
          <option value="all">{t.marketAll}</option>
          <option value="com">sagemro.com</option>
          <option value="cn">sagemro.cn</option>
        </select>
        <span className="ml-auto text-xs text-[var(--color-text-muted)]">{t.total(data.total)}</span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--color-text-muted)]">{t.loading}</div>
      ) : data.list.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-12 text-center text-sm text-[var(--color-text-muted)]">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-4">
          {data.list.map((application) => {
            const draft = drafts[application.id] || {};
            return (
              <article key={application.id} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
                <div className="h-1 bg-gradient-to-r from-[var(--color-primary)] via-amber-300 to-transparent" />
                <div className="p-4">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 text-sm font-semibold text-[var(--color-primary)]">
                      {applicantInitial(application.name)}
                    </div>
                    <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[var(--color-text)]">{application.name}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[application.status] || STATUS_STYLE.submitted}`}>
                        {t.statuses[application.status] || application.status}
                      </span>
                      <span className="rounded-full bg-[var(--color-surface-elevated)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                        {application.market === 'cn' ? 'sagemro.cn' : 'sagemro.com'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{contactLine(application)}</p>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">{application.created_at || '-'}</div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                        <MapPin size={13} />
                        {t.headers.location}
                      </div>
                      <div className="mt-1 text-[var(--color-text-secondary)]">
                        {[application.country, application.province, application.city, application.base_region].filter(Boolean).join(' / ') || '-'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                        <ShieldCheck size={13} />
                        {t.headers.regions}
                      </div>
                      {renderTags(application.service_regions)}
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                        <Wrench size={13} />
                        {t.headers.skills}
                      </div>
                      {renderTags(application.skill_tags)}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
                      <div className="text-xs text-[var(--color-text-muted)]">{t.headers.capacity}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(t.capacity).map(([key, label]) => (
                          <span
                            key={key}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                              application[key]
                                ? 'border-green-500/30 bg-green-500/10 text-green-300'
                                : 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]'
                            }`}
                          >
                            {application[key] && <CheckCircle2 size={12} />}
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                        <UserRound size={13} />
                        {t.headers.experience}
                      </div>
                      <p className="mt-1 line-clamp-5 text-[var(--color-text-secondary)]">
                        {application.experience_summary || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-3">
                    <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[var(--color-primary)]">
                      <ClipboardList size={13} />
                      {t.headers.review}
                    </div>
                    <div className="space-y-2">
                      <select
                        value={draft.status || application.status || 'submitted'}
                        onChange={(event) => updateDraft(application.id, 'status', event.target.value)}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                      >
                        {statusKeys.map((status) => (
                          <option key={status} value={status}>{t.statuses[status]}</option>
                        ))}
                      </select>
                      <input
                        value={draft.converted_user_id || ''}
                        onChange={(event) => updateDraft(application.id, 'converted_user_id', event.target.value)}
                        placeholder={t.convertedUserPlaceholder}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                      />
                      <textarea
                        value={draft.review_notes || ''}
                        onChange={(event) => updateDraft(application.id, 'review_notes', event.target.value)}
                        placeholder={t.notesPlaceholder}
                        rows={3}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                      />
                      <button
                        onClick={() => saveReview(application)}
                        disabled={savingId === application.id}
                        className="w-full rounded-xl bg-[var(--color-primary)] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-dark)] disabled:opacity-60"
                      >
                        {savingId === application.id ? t.saving : t.save}
                      </button>
                      <p className="text-xs leading-5 text-[var(--color-text-muted)]">{t.accountHint}</p>
                    </div>
                  </div>
                </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="rounded-lg bg-[var(--color-surface-elevated)] px-4 py-2 text-sm disabled:opacity-50"
        >
          {t.previous}
        </button>
        <span className="text-sm text-[var(--color-text-muted)]">{page} / {totalPages}</span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="rounded-lg bg-[var(--color-surface-elevated)] px-4 py-2 text-sm disabled:opacity-50"
        >
          {t.next}
        </button>
      </div>
    </div>
  );
}
