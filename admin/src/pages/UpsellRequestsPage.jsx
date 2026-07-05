import { useEffect, useMemo, useState } from 'react';
import { Lightbulb, RefreshCw, Save } from 'lucide-react';
import { getAdminUpsellRequests, updateAdminUpsellRequest } from '../services/api';
import { runtimeConfig } from '../config/runtime';

const CATEGORIES = {
  parts_consumables: { en: 'Parts / consumables', cn: '配件 / 易损件' },
  laser_peripheral: { en: 'Laser peripheral equipment', cn: '激光周边设备' },
  post_processing: { en: 'Post-processing equipment', cn: '后道处理设备' },
  automation_retrofit: { en: 'Automation retrofit', cn: '自动化改造' },
  bending_tooling: { en: 'Bending tooling', cn: '折弯相关' },
  other_retrofit: { en: 'Other retrofit need', cn: '其他现场改造需求' },
};

const STATUSES = {
  pending_assignment: { en: 'Pending assignment', cn: '待分配' },
  sales_following: { en: 'Sales following', cn: '业务跟进中' },
  quoted: { en: 'Quoted', cn: '已报价' },
  won: { en: 'Won', cn: '已成交' },
  lost: { en: 'Lost', cn: '未成交' },
  delivery_support: { en: 'Delivery support', cn: '交付协同中' },
  completed: { en: 'Completed', cn: '已完成' },
};

const QUOTE_STATUSES = {
  not_started: { en: 'Not started', cn: '未开始' },
  in_progress: { en: 'In progress', cn: '报价中' },
  quoted: { en: 'Quoted', cn: '已报价' },
};

const DEAL_RESULTS = {
  undecided: { en: 'Undecided', cn: '未定' },
  won: { en: 'Won', cn: '已成交' },
  lost: { en: 'Lost', cn: '未成交' },
};

const TEXT = {
  en: {
    title: 'Upsell and Retrofit Requests',
    subtitle: 'Engineer-captured needs for parts, consumables, laser peripherals, post-processing equipment, automation retrofit, bending tooling, and other retrofit work.',
    badge: 'Demand pool',
    refresh: 'Refresh',
    allStatuses: 'All statuses',
    allCategories: 'All categories',
    empty: 'No upsell and retrofit requests yet.',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Request updated.',
    failed: 'Operation failed: ',
    loading: 'Loading...',
    total: (count) => `${count} request(s)`,
    owner: 'Sales owner',
    adminNote: 'Admin note',
    handoverNote: 'Handover note',
    status: 'Status',
    quote: 'Quote',
    deal: 'Deal',
    sourceWorkspace: 'Workspace',
    sourceWorkOrder: 'Work order',
    engineer: 'Engineer',
    timeline: 'Timeline',
    budget: 'Budget',
    createdAt: 'Created',
  },
  'zh-CN': {
    title: '增购需求池',
    subtitle: '工程师现场提交的配件、易损件、激光周边设备、后道处理设备、自动化改造、折弯相关及其他现场改造需求。',
    badge: '增购与改造需求',
    refresh: '刷新',
    allStatuses: '全部状态',
    allCategories: '全部分类',
    empty: '暂无增购与改造需求。',
    save: '保存',
    saving: '保存中...',
    saved: '需求已更新。',
    failed: '操作失败：',
    loading: '加载中...',
    total: (count) => `共 ${count} 条需求`,
    owner: '业务负责人',
    adminNote: '内部备注',
    handoverNote: '交付协同说明',
    status: '状态',
    quote: '报价',
    deal: '成交',
    sourceWorkspace: '工程师工作台',
    sourceWorkOrder: '关联工单',
    engineer: '工程师',
    timeline: '时间要求',
    budget: '预算信号',
    createdAt: '提交时间',
  },
};

function localize(map, key, locale) {
  const item = map[key];
  if (!item) return key || '-';
  return locale === 'zh-CN' ? item.cn : item.en;
}

function formatDate(value) {
  return value ? value.slice(0, 16).replace('T', ' ') : '-';
}

export function UpsellRequestsPage() {
  const locale = runtimeConfig.locale;
  const t = TEXT[locale] || TEXT.en;
  const [data, setData] = useState({ total: 0, requests: [] });
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const pageSize = 20;

  const filters = useMemo(() => ({ status, category }), [status, category]);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await getAdminUpsellRequests(1, pageSize, filters);
      setData({ total: result.total || 0, requests: result.requests || [] });
    } catch (error) {
      setMessage(t.failed + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters]);

  const updateLocal = (id, key, value) => {
    setData((prev) => ({
      ...prev,
      requests: prev.requests.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    }));
  };

  const save = async (item) => {
    setSavingId(item.id);
    setMessage('');
    try {
      const result = await updateAdminUpsellRequest(item.id, {
        status: item.status,
        assigned_sales_owner: item.assigned_sales_owner || '',
        admin_note: item.admin_note || '',
        quote_status: item.quote_status || 'not_started',
        deal_result: item.deal_result || 'undecided',
        handover_note: item.handover_note || '',
      });
      setData((prev) => ({
        ...prev,
        requests: prev.requests.map((row) => (row.id === item.id ? result.request : row)),
      }));
      setMessage(t.saved);
    } catch (error) {
      setMessage(t.failed + error.message);
    } finally {
      setSavingId('');
    }
  };

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
              <Lightbulb size={14} />
              {t.badge}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{t.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
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

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:flex-row md:items-center">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none"
        >
          <option value="all">{t.allStatuses}</option>
          {Object.keys(STATUSES).map((key) => (
            <option key={key} value={key}>{localize(STATUSES, key, locale)}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none"
        >
          <option value="all">{t.allCategories}</option>
          {Object.keys(CATEGORIES).map((key) => (
            <option key={key} value={key}>{localize(CATEGORIES, key, locale)}</option>
          ))}
        </select>
        <span className="text-xs text-[var(--color-text-muted)] md:ml-auto">{t.total(data.total)}</span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.loading}</div>
      ) : data.requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-4">
          {data.requests.map((item) => (
            <article key={item.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--color-text-primary)]">{item.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <span>{localize(CATEGORIES, item.category, locale)}</span>
                    <span>{item.source_type === 'work_order' ? `${t.sourceWorkOrder}: ${item.work_order_id || '-'}` : t.sourceWorkspace}</span>
                    <span>{t.engineer}: {item.engineer_id || '-'}</span>
                    <span>{t.createdAt}: {formatDate(item.created_at)}</span>
                  </div>
                </div>
                <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">
                  {localize(STATUSES, item.status, locale)}
                </span>
              </div>

              <p className="mb-3 text-sm leading-6 text-[var(--color-text-secondary)]">{item.description}</p>
              {item.site_context && (
                <p className="mb-3 rounded-xl bg-[var(--color-surface-elevated)] px-3 py-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {item.site_context}
                </p>
              )}
              <div className="mb-4 grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-2">
                <div>{t.timeline}: {item.expected_timeline || '-'}</div>
                <div>{t.budget}: {item.budget_signal || '-'}</div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">{t.status}</span>
                  <select
                    value={item.status || 'pending_assignment'}
                    onChange={(event) => updateLocal(item.id, 'status', event.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 outline-none"
                  >
                    {Object.keys(STATUSES).map((key) => (
                      <option key={key} value={key}>{localize(STATUSES, key, locale)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">{t.quote}</span>
                  <select
                    value={item.quote_status || 'not_started'}
                    onChange={(event) => updateLocal(item.id, 'quote_status', event.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 outline-none"
                  >
                    {Object.keys(QUOTE_STATUSES).map((key) => (
                      <option key={key} value={key}>{localize(QUOTE_STATUSES, key, locale)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">{t.deal}</span>
                  <select
                    value={item.deal_result || 'undecided'}
                    onChange={(event) => updateLocal(item.id, 'deal_result', event.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 outline-none"
                  >
                    {Object.keys(DEAL_RESULTS).map((key) => (
                      <option key={key} value={key}>{localize(DEAL_RESULTS, key, locale)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">{t.owner}</span>
                  <input
                    value={item.assigned_sales_owner || ''}
                    onChange={(event) => updateLocal(item.id, 'assigned_sales_owner', event.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 outline-none"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">{t.adminNote}</span>
                  <input
                    value={item.admin_note || ''}
                    onChange={(event) => updateLocal(item.id, 'admin_note', event.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 outline-none"
                  />
                </label>
              </div>

              <label className="mt-3 block text-sm">
                <span className="mb-1 block text-[var(--color-text-secondary)]">{t.handoverNote}</span>
                <textarea
                  value={item.handover_note || ''}
                  onChange={(event) => updateLocal(item.id, 'handover_note', event.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 outline-none"
                />
              </label>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => save(item)}
                  disabled={savingId === item.id}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  <Save size={16} />
                  {savingId === item.id ? t.saving : t.save}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
