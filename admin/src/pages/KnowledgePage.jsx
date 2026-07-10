import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, Plus, Search } from 'lucide-react';
import { createAdminKnowledge, getAdminKnowledge, updateAdminKnowledge } from '../services/api';
import { runtimeConfig } from '../config/runtime';

const CATEGORIES = [
  'fault',
  'cutting_parameters',
  'parts',
  'maintenance',
  'machine_selection',
  'health',
  'safety',
  'other',
];

const STATUSES = ['draft', 'published', 'archived'];

const EMPTY_FORM = {
  market: '',
  locale: '',
  category: 'fault',
  title: '',
  content: '',
  source: '',
  applicable_equipment: '',
  applicable_brand: '',
  applicable_model: '',
  risk_level: 'medium',
  status: 'draft',
};

const TEXT = {
  en: {
    title: 'Knowledge Base',
    subtitle: 'Review and publish external references, manuals, repair notes, and service experience before AI can use them.',
    search: 'Search title, content, equipment, brand, or model',
    all: 'All',
    newArticle: 'New article',
    saveDraft: 'Save draft',
    update: 'Update article',
    publish: 'Publish',
    loading: 'Loading...',
    empty: 'No knowledge articles yet',
    total: (count) => `${count} articles`,
    formTitle: 'Article editor',
    source: 'Source',
    scope: 'Scope',
    status: 'Status',
    category: 'Category',
    titleLabel: 'Title',
    content: 'Knowledge content',
    equipment: 'Equipment',
    brand: 'Brand',
    model: 'Model',
    risk: 'Risk level',
    saved: 'Knowledge article saved.',
    failed: 'Operation failed: ',
  },
  'zh-CN': {
    title: '知识库管理',
    subtitle: '外部资料、说明书、维修经验先进入可审核知识库，发布后才允许 AI 检索使用。',
    search: '搜索标题、内容、设备、品牌或型号',
    all: '全部',
    newArticle: '新建条目',
    saveDraft: '保存草稿',
    update: '更新条目',
    publish: '发布',
    loading: '加载中...',
    empty: '暂无知识条目',
    total: (count) => `共 ${count} 条`,
    formTitle: '知识条目编辑',
    source: '来源',
    scope: '适用范围',
    status: '状态',
    category: '分类',
    titleLabel: '标题',
    content: '知识内容',
    equipment: '设备',
    brand: '品牌',
    model: '型号',
    risk: '风险等级',
    saved: '知识条目已保存。',
    failed: '操作失败：',
  },
};

export function KnowledgePage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const defaultMarket = runtimeConfig.locale === 'zh-CN' ? 'cn' : 'com';
  const defaultLocale = runtimeConfig.locale === 'zh-CN' ? 'zh-CN' : 'en';
  const [data, setData] = useState({ total: 0, list: [] });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'all', category: 'all', search: '' });
  const [form, setForm] = useState({ ...EMPTY_FORM, market: defaultMarket, locale: defaultLocale });
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const pageSize = 50;

  const queryFilters = useMemo(() => ({
    market: defaultMarket,
    status: filters.status,
    category: filters.category,
    search: filters.search,
  }), [defaultMarket, filters]);

  const load = () => {
    setLoading(true);
    getAdminKnowledge(1, pageSize, queryFilters)
      .then(setData)
      .catch((error) => setMessage(t.failed + error.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [queryFilters]);

  const resetForm = () => {
    setSelectedId('');
    setForm({ ...EMPTY_FORM, market: defaultMarket, locale: defaultLocale });
    setMessage('');
  };

  const editArticle = (article) => {
    setSelectedId(article.id);
    setForm({
      market: article.market || defaultMarket,
      locale: article.locale || defaultLocale,
      category: article.category || 'fault',
      title: article.title || '',
      content: article.content || '',
      source: article.source || '',
      applicable_equipment: article.applicable_equipment || '',
      applicable_brand: article.applicable_brand || '',
      applicable_model: article.applicable_model || '',
      risk_level: article.risk_level || 'medium',
      status: article.status || 'draft',
    });
    setMessage('');
  };

  const save = async (nextStatus = form.status) => {
    setSaving(true);
    setMessage('');
    const payload = { ...form, status: nextStatus };
    try {
      const result = selectedId
        ? await updateAdminKnowledge(selectedId, payload)
        : await createAdminKnowledge(payload);
      setSelectedId(result.article.id);
      setForm((prev) => ({ ...prev, status: result.article.status }));
      setMessage(t.saved);
      load();
    } catch (error) {
      setMessage(t.failed + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} />
          {t.newArticle}
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-[var(--color-text-muted)]" size={16} />
              <input
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder={t.search}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <select
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              <option value="all">{t.all}</option>
              {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              <option value="all">{t.all}</option>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>

          <div className="mb-2 text-xs text-[var(--color-text-muted)]">{t.total(data.total)}</div>
          {loading ? (
            <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.loading}</div>
          ) : data.list.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] py-12 text-center text-sm text-[var(--color-text-muted)]">{t.empty}</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <tbody>
                  {data.list.map((article) => (
                    <tr
                      key={article.id}
                      onClick={() => editArticle(article)}
                      className={`cursor-pointer border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-elevated)] ${
                        selectedId === article.id ? 'bg-[var(--color-primary)]/10' : ''
                      }`}
                    >
                      <td className="w-10 px-3 py-4 align-top text-[var(--color-text-muted)]">
                        <FileText size={17} />
                      </td>
                      <td className="px-2 py-4">
                        <div className="font-medium text-[var(--color-text-primary)]">{article.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-text-muted)]">{article.content}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--color-text-secondary)]">
                          <span>{article.category}</span>
                          <span>{article.locale}</span>
                          <span>v{article.version}</span>
                          {article.applicable_brand && <span>{article.applicable_brand}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-4 align-top text-right">
                        <span className={`rounded px-2 py-1 text-xs ${
                          article.status === 'published'
                            ? 'bg-green-500/10 text-green-400'
                            : article.status === 'archived'
                              ? 'bg-gray-500/10 text-gray-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {article.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 size={17} className="text-[var(--color-primary)]" />
            <h3 className="font-medium">{t.formTitle}</h3>
          </div>
          <div className="grid gap-3">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t.category}
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t.status}
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t.titleLabel}
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t.content}
              <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={8} className="mt-1 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm leading-6" />
            </label>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t.source}
              <input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <input placeholder={t.equipment} value={form.applicable_equipment} onChange={(event) => setForm({ ...form, applicable_equipment: event.target.value })} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
              <input placeholder={t.brand} value={form.applicable_brand} onChange={(event) => setForm({ ...form, applicable_brand: event.target.value })} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
              <input placeholder={t.model} value={form.applicable_model} onChange={(event) => setForm({ ...form, applicable_model: event.target.value })} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
            </div>
            <input placeholder={t.risk} value={form.risk_level} onChange={(event) => setForm({ ...form, risk_level: event.target.value })} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => save(form.status)} disabled={saving} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium disabled:opacity-50">
              {selectedId ? t.update : t.saveDraft}
            </button>
            <button type="button" onClick={() => save('published')} disabled={saving} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {t.publish}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
