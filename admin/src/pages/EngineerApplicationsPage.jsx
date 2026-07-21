import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  UserRound,
  Wrench,
} from 'lucide-react';
import { EngineerAccountSetupModal } from '../components/EngineerAccountSetupModal';
import {
  getAdminEngineerApplications,
  getAdminUsers,
  openAdminEngineerAccount,
  resendAdminEngineerActivation,
  updateAdminEngineerApplication,
} from '../services/api';
import { runtimeConfig } from '../config/runtime';

const REVIEW_STATUSES = ['submitted', 'reviewing', 'qualified', 'rejected', 'archived'];

const REVIEW_STYLE = {
  submitted: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  reviewing: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  qualified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  archived: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
};

const ACCOUNT_STYLE = {
  not_opened: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  awaiting_activation: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  activation_expired: 'bg-red-500/15 text-red-300 border-red-500/30',
  activated: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

const TEXT = {
  en: {
    title: 'Engineer Cooperation Applications',
    badge: 'SAGEMRO Engineer Service Collaboration Network',
    subtitle: 'Review applications and open approved engineer accounts from the same card.',
    section: 'Review and account setup',
    all: 'All review states',
    marketAll: 'All markets',
    total: (count) => `${count} application(s)`,
    loading: 'Loading...',
    empty: 'No engineer applications yet',
    refresh: 'Refresh',
    reviewStatuses: {
      submitted: 'Pending review',
      reviewing: 'Reviewing',
      qualified: 'Approved',
      rejected: 'Not approved',
      archived: 'Archived',
    },
    accountStatuses: {
      not_opened: 'Account not opened',
      awaiting_activation: 'Awaiting activation',
      activation_expired: 'Activation expired',
      activated: 'Activated',
    },
    headers: {
      location: 'Location',
      regions: 'Service regions',
      skills: 'Skills',
      capacity: 'Capacity',
      experience: 'Experience',
      review: 'Application review',
    },
    capacity: {
      can_travel: 'Travel',
      can_weekend: 'Weekend',
      can_night: 'Night support',
      has_tools: 'Tools',
    },
    notesPlaceholder: 'Review notes, next step, and regional fit...',
    save: 'Save review',
    saving: 'Saving...',
    saved: 'Application review updated.',
    failed: 'Operation failed: ',
    openAccount: 'Open engineer account',
    resend: 'Resend activation email',
    resending: 'Sending...',
    viewProfile: 'View engineer profile',
    accountOpened: 'Engineer account opened. Activation email sent.',
    accountOpenedEmailFailed: 'The account was opened, but the activation email failed. You can resend it from this card.',
    resent: 'Activation email sent.',
    resendFailed: 'The activation email could not be sent. The linked account remains available for another attempt.',
    approveFirst: 'Approve the application before opening an account.',
    sentAt: 'Sent',
    expiresAt: 'Expires',
    previous: 'Previous',
    next: 'Next',
  },
  'zh-CN': {
    title: '工程师合作申请',
    badge: 'SAGEMRO 工程师服务协作网络',
    subtitle: '在同一张申请卡片中完成审核、账号开通与激活跟进。',
    section: '审核与账号开通',
    all: '全部审核状态',
    marketAll: '全部市场',
    total: (count) => `共 ${count} 条申请`,
    loading: '加载中...',
    empty: '暂无工程师申请',
    refresh: '刷新',
    reviewStatuses: {
      submitted: '待审核',
      reviewing: '审核中',
      qualified: '审核通过',
      rejected: '未通过',
      archived: '已归档',
    },
    accountStatuses: {
      not_opened: '账号未开通',
      awaiting_activation: '等待激活',
      activation_expired: '激活已过期',
      activated: '已激活',
    },
    headers: {
      location: '所在地',
      regions: '可服务区域',
      skills: '技能标签',
      capacity: '服务条件',
      experience: '经验说明',
      review: '申请审核',
    },
    capacity: {
      can_travel: '可跨城',
      can_weekend: '可周末',
      can_night: '可夜间',
      has_tools: '有工具',
    },
    notesPlaceholder: '审核备注、下一步与区域匹配...',
    save: '保存审核',
    saving: '保存中...',
    saved: '申请审核已更新。',
    failed: '操作失败：',
    openAccount: '开通工程师账号',
    resend: '重新发送激活邮件',
    resending: '发送中...',
    viewProfile: '查看工程师档案',
    accountOpened: '工程师账号已开通，激活邮件已发送。',
    accountOpenedEmailFailed: '账号已开通，但激活邮件发送失败。可在当前卡片中重新发送。',
    resent: '激活邮件已重新发送。',
    resendFailed: '激活邮件发送失败，已关联的账号不会丢失，可稍后重试。',
    approveFirst: '请先将申请审核为“审核通过”，再开通账号。',
    sentAt: '发送时间',
    expiresAt: '有效期至',
    previous: '上一页',
    next: '下一页',
  },
};

function reviewStatus(status) {
  return status === 'converted' ? 'qualified' : status || 'submitted';
}

function listItems(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '').split(/[,;，、]/).map((item) => item.trim()).filter(Boolean);
}

function renderTags(value) {
  const items = listItems(value);
  if (!items.length) return <span className="mt-1 block text-[var(--color-text-muted)]">-</span>;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">{item}</span>
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

export function EngineerApplicationsPage({ onOpenEngineer }) {
  const locale = runtimeConfig.locale;
  const t = TEXT[locale] || TEXT.en;
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState({});
  const [setupApplication, setSetupApplication] = useState(null);
  const [setupError, setSetupError] = useState('');
  const [regionalLeads, setRegionalLeads] = useState([]);
  const pageSize = 20;

  const load = () => {
    setLoading(true);
    return getAdminEngineerApplications(page, pageSize, statusFilter, marketFilter)
      .then((nextData) => {
        setData(nextData);
        setDrafts(Object.fromEntries((nextData.list || []).map((item) => [item.id, {
          status: reviewStatus(item.status),
          review_notes: item.review_notes || '',
        }])));
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, statusFilter, marketFilter]);

  const updateDraft = (id, field, value) => {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] || {}), [field]: value } }));
  };

  const saveReview = async (application) => {
    setSavingId(application.id);
    setMessage('');
    try {
      await updateAdminEngineerApplication(application.id, drafts[application.id] || {});
      setMessage(t.saved);
      await load();
    } catch (error) {
      setMessage(t.failed + error.message);
    } finally {
      setSavingId('');
    }
  };

  const openSetup = async (application) => {
    setSetupApplication(application);
    setSetupError('');
    try {
      const result = await getAdminUsers('engineer', 1, 100, { role: 'regional_lead' });
      setRegionalLeads((result.list || []).filter((engineer) => engineer.engineer_role === 'regional_lead'));
    } catch (error) {
      setRegionalLeads([]);
      setSetupError(error.message);
    }
  };

  const submitSetup = async (values) => {
    if (!setupApplication) return;
    setActionId(setupApplication.id);
    setSetupError('');
    try {
      const result = await openAdminEngineerAccount(setupApplication.id, values);
      setMessage(result.account?.email_sent === false ? t.accountOpenedEmailFailed : t.accountOpened);
      setSetupApplication(null);
      await load();
    } catch (error) {
      setSetupError(error.message);
    } finally {
      setActionId('');
    }
  };

  const resend = async (application) => {
    setActionId(application.id);
    setMessage('');
    try {
      const result = await resendAdminEngineerActivation(application.id);
      setMessage(result.account?.email_sent === false ? t.resendFailed : t.resent);
      await load();
    } catch (error) {
      setMessage(t.failed + error.message);
    } finally {
      setActionId('');
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div>
      <header className="mb-6 border-b border-[var(--color-border)] pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-[var(--color-primary)]"><ClipboardList size={14} />{t.badge}</div>
            <h2 className="text-2xl font-semibold text-[var(--color-text)]">{t.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">{t.subtitle}</p>
          </div>
          <button onClick={load} className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"><RefreshCw size={15} />{t.refresh}</button>
        </div>
      </header>

      {message && <div className="mb-4 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">{message}</div>}

      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-4">
        {['all', ...REVIEW_STATUSES].map((status) => (
          <button key={status} onClick={() => { setStatusFilter(status); setPage(1); }} className={`min-h-9 whitespace-nowrap rounded-lg border px-3 text-xs font-medium ${statusFilter === status ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
            {status === 'all' ? t.all : t.reviewStatuses[status]}
          </button>
        ))}
        <select value={marketFilter} onChange={(event) => { setMarketFilter(event.target.value); setPage(1); }} className="min-h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs text-[var(--color-text-secondary)]">
          <option value="all">{t.marketAll}</option><option value="com">sagemro.com</option><option value="cn">sagemro.cn</option>
        </select>
        <span className="ml-auto text-xs text-[var(--color-text-muted)]">{t.total(data.total)}</span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--color-text-muted)]">{t.loading}</div>
      ) : data.list.length === 0 ? (
        <div className="border-y border-[var(--color-border)] py-12 text-center text-sm text-[var(--color-text-muted)]">{t.empty}</div>
      ) : (
        <div className="space-y-4">
          {data.list.map((application) => {
            const draft = drafts[application.id] || {};
            const currentReview = reviewStatus(application.status);
            const account = application.account || { activation_status: 'not_opened' };
            const activationStatus = account.activation_status || 'not_opened';
            const canOpen = currentReview === 'qualified' && activationStatus === 'not_opened';
            const canResend = ['awaiting_activation', 'activation_expired'].includes(activationStatus);
            return (
              <article key={application.id} className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
                <div className="border-b border-[var(--color-border)] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-sm font-semibold text-[var(--color-primary)]">{applicantInitial(application.name)}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[var(--color-text)]">{application.name}</h3>
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${REVIEW_STYLE[currentReview]}`}>{t.reviewStatuses[currentReview]}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${ACCOUNT_STYLE[activationStatus]}`}>{t.accountStatuses[activationStatus]}</span>
                          <span className="rounded-full bg-[var(--color-surface-elevated)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">{application.market === 'cn' ? 'sagemro.cn' : 'sagemro.com'}</span>
                        </div>
                        <p className="mt-1 break-words text-sm text-[var(--color-text-secondary)]">{contactLine(application)}</p>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">{application.created_at || '-'}</div>
                  </div>
                </div>

                <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr_1.25fr]">
                  <div className="space-y-3 text-sm">
                    <div><div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><MapPin size={13} />{t.headers.location}</div><div className="mt-1 text-[var(--color-text-secondary)]">{[application.country, application.province, application.city, application.base_region].filter(Boolean).join(' / ') || '-'}</div></div>
                    <div><div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><ShieldCheck size={13} />{t.headers.regions}</div>{renderTags(application.service_regions)}</div>
                    <div><div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><Wrench size={13} />{t.headers.skills}</div>{renderTags(application.skill_tags)}</div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div><div className="text-xs text-[var(--color-text-muted)]">{t.headers.capacity}</div><div className="mt-2 flex flex-wrap gap-2">{Object.entries(t.capacity).map(([key, label]) => <span key={key} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${application[key] ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'}`}>{application[key] && <CheckCircle2 size={12} />}{label}</span>)}</div></div>
                    <div><div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><UserRound size={13} />{t.headers.experience}</div><p className="mt-1 line-clamp-6 text-[var(--color-text-secondary)]">{application.experience_summary || '-'}</p></div>
                  </div>

                  <div className="rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-3">
                    <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[var(--color-primary)]"><ClipboardList size={13} />{t.section}</div>
                    <div className="space-y-2">
                      <select value={draft.status || currentReview} onChange={(event) => updateDraft(application.id, 'status', event.target.value)} className="min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]">
                        {REVIEW_STATUSES.map((status) => <option key={status} value={status}>{t.reviewStatuses[status]}</option>)}
                      </select>
                      <textarea value={draft.review_notes || ''} onChange={(event) => updateDraft(application.id, 'review_notes', event.target.value)} placeholder={t.notesPlaceholder} rows={3} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                      <button onClick={() => saveReview(application)} disabled={savingId === application.id} className="min-h-10 w-full whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 text-sm font-semibold text-white disabled:opacity-60">{savingId === application.id ? t.saving : t.save}</button>

                      <div className="border-t border-[var(--color-primary)]/20 pt-3">
                        {activationStatus === 'not_opened' && (
                          <>
                            <button onClick={() => openSetup(application)} disabled={!canOpen || actionId === application.id} className="inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-3 text-sm font-medium text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-45"><UserPlus size={15} />{t.openAccount}</button>
                            {!canOpen && <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{t.approveFirst}</p>}
                          </>
                        )}
                        {canResend && <button onClick={() => resend(application)} disabled={actionId === application.id} className="inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 text-sm font-medium text-amber-300 disabled:opacity-50"><Mail size={15} />{actionId === application.id ? t.resending : t.resend}</button>}
                        {account.engineer_id && <button onClick={() => onOpenEngineer?.(account.engineer_id)} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"><ExternalLink size={15} />{t.viewProfile}</button>}
                        {(account.sent_at || account.expires_at) && <div className="mt-2 space-y-1 text-xs text-[var(--color-text-muted)]">{account.sent_at && <div>{t.sentAt}: {account.sent_at}</div>}{account.expires_at && <div>{t.expiresAt}: {account.expires_at}</div>}</div>}
                        {account.send_status === 'failed' && <p className="mt-2 text-xs leading-5 text-amber-300">{t.resendFailed}</p>}
                      </div>

                      {setupApplication?.id === application.id && <EngineerAccountSetupModal application={application} locale={locale} regionalLeads={regionalLeads} submitting={actionId === application.id} error={setupError} onClose={() => { setSetupApplication(null); setSetupError(''); }} onSubmit={submitSetup} />}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="min-h-10 whitespace-nowrap rounded-lg bg-[var(--color-surface-elevated)] px-4 text-sm disabled:opacity-50">{t.previous}</button>
        <span className="text-sm text-[var(--color-text-muted)]">{page} / {totalPages}</span>
        <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="min-h-10 whitespace-nowrap rounded-lg bg-[var(--color-surface-elevated)] px-4 text-sm disabled:opacity-50">{t.next}</button>
      </div>
    </div>
  );
}
