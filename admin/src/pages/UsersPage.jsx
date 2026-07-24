import { useEffect, useState } from 'react';
import { Download, Filter, Plus, Search, Trash2, X } from 'lucide-react';
import { createAdminUser, deleteAdminUser, getAdminUsers } from '../services/api';
import { runtimeConfig } from '../config/runtime';
import { isTimeoutError, withTimeout } from '../utils/asyncTimeout';

const DELETE_TIMEOUT_MS = 12000;

const TEXT = {
  en: {
    title: 'Customer Management',
    addUser: 'Add customer',
    exportCurrent: 'Export current list',
    searchPlaceholder: 'Search name, company, or phone...',
    filter: 'Filter',
    region: 'Region',
    regionPlaceholder: 'Customer region',
    clearFilters: 'Clear filters',
    loading: 'Loading...',
    loadFailed: 'Failed to load customers.',
    retry: 'Retry',
    total: (count) => `${count} record(s)`,
    headers: {
      no: 'No.',
      name: 'Name',
      company: 'Company',
      phone: 'Phone',
      region: 'Region',
      createdAt: 'Registered',
      action: 'Action',
    },
    emptyFiltered: 'No customers match the filters',
    empty: 'No customers yet',
    deleteTitle: 'Delete customer',
    addTitle: 'Add customer',
    namePlaceholder: 'Name',
    phonePlaceholder: 'Phone number',
    passwordPlaceholder: 'Password',
    regionOptional: 'Region (optional)',
    creating: 'Creating...',
    createUser: 'Create customer',
    deleteFailed: 'Delete failed: ',
    deleteSlowNotice: 'Deletion is taking longer than expected. The list has been refreshed. Please check whether the customer is still present before retrying.',
    deleteSuccessNotice: 'Customer deleted. The list has been refreshed.',
    confirmDelete: 'Confirm customer deletion',
    deleteWarning: 'After deletion, this customer\'s conversations, service orders, and reviews will be removed. This action cannot be undone.',
    cancel: 'Cancel',
    deleting: 'Deleting...',
    confirmDeleteButton: 'Confirm delete',
    dismissNotice: 'Dismiss notice',
    previous: 'Previous',
    next: 'Next',
  },
  'zh-CN': {
    title: '客户管理',
    addUser: '添加客户',
    exportCurrent: '导出当前列表',
    searchPlaceholder: '搜索姓名、公司名或手机号...',
    filter: '筛选',
    region: '地区',
    regionPlaceholder: '客户地区',
    clearFilters: '清除筛选',
    loading: '加载中...',
    loadFailed: '客户列表加载失败。',
    retry: '重试',
    total: (count) => `共 ${count} 条记录`,
    headers: {
      no: '编号',
      name: '姓名',
      company: '公司名',
      phone: '手机号',
      region: '地区',
      createdAt: '注册时间',
      action: '操作',
    },
    emptyFiltered: '没有符合条件的客户',
    empty: '暂无客户',
    deleteTitle: '删除客户',
    addTitle: '添加客户',
    namePlaceholder: '姓名',
    phonePlaceholder: '手机号',
    passwordPlaceholder: '密码',
    regionOptional: '地区（选填）',
    creating: '创建中...',
    createUser: '创建客户',
    deleteFailed: '删除失败：',
    deleteSlowNotice: '删除请求耗时较长，列表已刷新。请先确认该客户是否还在列表中，再决定是否重试。',
    deleteSuccessNotice: '客户已删除，列表已刷新。',
    confirmDelete: '确认删除客户',
    deleteWarning: '删除后该客户的对话、工单和评价等数据将被清除，此操作不可恢复。',
    cancel: '取消',
    deleting: '删除中...',
    confirmDeleteButton: '确认删除',
    dismissNotice: '关闭提示',
    previous: '上一页',
    next: '下一页',
  },
};

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function UsersPage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', password: '', region: '' });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const pageSize = 20;

  const loadUsers = () => {
    setLoading(true);
    setLoadError('');
    const filters = {};
    if (search) filters.search = search;
    if (region) filters.region = region;
    return getAdminUsers('customer', page, pageSize, filters)
      .then(setData)
      .catch((error) => setLoadError(error.message || t.loadFailed))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, [page, search, region]);

  const resetForm = () => {
    setForm({ name: '', phone: '', password: '', region: '' });
    setAddError('');
  };

  const addCustomer = async () => {
    setAddError('');
    setAddLoading(true);
    try {
      await createAdminUser({ userType: 'customer', ...form });
      setShowAdd(false);
      resetForm();
      await loadUsers();
    } catch (error) {
      setAddError(error.message);
    } finally {
      setAddLoading(false);
    }
  };

  const removeCustomer = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteNotice('');
    try {
      await withTimeout(deleteAdminUser(deleteTarget.id, 'customer'), DELETE_TIMEOUT_MS, t.deleteSlowNotice);
      setDeleteTarget(null);
      setDeleteNotice(t.deleteSuccessNotice);
      await loadUsers();
    } catch (error) {
      if (isTimeoutError(error)) {
        setDeleteTarget(null);
        setDeleteNotice(t.deleteSlowNotice);
        await loadUsers();
      } else {
        alert(t.deleteFailed + error.message);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const exportCurrentList = () => {
    downloadCsv('sagemro-customers-current.csv', [
      ['id', 'user_no', 'name', 'company', 'phone', 'region', 'created_at'],
      ...data.list.map((customer) => [customer.id, customer.user_no, customer.name, customer.company, customer.phone, customer.region, customer.created_at]),
    ]);
  };

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const hasActiveFilters = search || region;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportCurrentList} disabled={!data.list.length} className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 text-sm text-[var(--color-text-secondary)] disabled:opacity-40"><Download size={15} />{t.exportCurrent}</button>
          <button onClick={() => { resetForm(); setShowAdd(true); }} className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 text-sm text-white"><Plus size={16} />{t.addUser}</button>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input type="text" placeholder={t.searchPlaceholder} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] pl-9 pr-3 text-sm outline-none focus:border-[var(--color-primary)]" />
        </label>
        <button onClick={() => setShowFilters((current) => !current)} className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm ${hasActiveFilters ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}><Filter size={16} />{t.filter}</button>
      </div>

      {showFilters && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
          <label className="text-xs text-[var(--color-text-muted)]">{t.region}<input value={region} onChange={(event) => { setRegion(event.target.value); setPage(1); }} placeholder={t.regionPlaceholder} className="mt-1 min-h-9 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs outline-none focus:border-[var(--color-primary)]" /></label>
          {hasActiveFilters && <button onClick={() => { setSearch(''); setRegion(''); setPage(1); }} className="min-h-9 whitespace-nowrap rounded-lg px-3 text-xs text-[var(--color-error)] hover:bg-[var(--color-error)]/10">{t.clearFilters}</button>}
        </div>
      )}

      {deleteNotice && <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"><span>{deleteNotice}</span><button onClick={() => setDeleteNotice('')} aria-label={t.dismissNotice}><X size={15} /></button></div>}
      {loadError && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-error)]/40 bg-[var(--color-error)]/5 px-3 py-2 text-sm text-[var(--color-text-secondary)]"><span>{loadError}</span><button onClick={loadUsers} className="whitespace-nowrap rounded-lg border border-[var(--color-error)]/40 px-3 py-1.5 text-xs font-medium text-[var(--color-error)]">{t.retry}</button></div>}

      {loading ? <div className="py-12 text-center text-[var(--color-text-muted)]">{t.loading}</div> : (
        <>
          <div className="mb-2 text-xs text-[var(--color-text-muted)]">{t.total(data.total)}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--color-border)]">{Object.values(t.headers).map((label) => <th key={label} className="whitespace-nowrap px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{label}</th>)}</tr></thead>
              <tbody>
                {!data.list.length ? <tr><td colSpan={7} className="py-8 text-center text-[var(--color-text-muted)]">{hasActiveFilters ? t.emptyFiltered : t.empty}</td></tr> : data.list.map((customer) => (
                  <tr key={customer.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]/50">
                    <td className="px-2 py-3 font-mono text-[var(--color-text-secondary)]">{customer.user_no}</td><td className="px-2 py-3">{customer.name}</td><td className="px-2 py-3 text-[var(--color-text-secondary)]">{customer.company || '-'}</td><td className="px-2 py-3 font-mono">{customer.phone}</td><td className="px-2 py-3 text-[var(--color-text-secondary)]">{customer.region || '-'}</td><td className="px-2 py-3 text-[var(--color-text-secondary)]">{customer.created_at?.slice(0, 10)}</td><td className="px-2 py-3 text-right"><button onClick={() => setDeleteTarget(customer)} title={t.deleteTitle} className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 && <div className="mt-6 flex items-center justify-center gap-2"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="min-h-9 whitespace-nowrap rounded-lg bg-[var(--color-surface-elevated)] px-3 text-sm disabled:opacity-30">{t.previous}</button><span className="text-sm text-[var(--color-text-secondary)]">{page} / {totalPages}</span><button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="min-h-9 whitespace-nowrap rounded-lg bg-[var(--color-surface-elevated)] px-3 text-sm disabled:opacity-30">{t.next}</button></div>}

      {showAdd && <div className="fixed inset-0 z-50 flex items-center justify-center px-4"><div className="fixed inset-0 bg-black/50" onClick={() => setShowAdd(false)} /><div className="relative w-full max-w-md rounded-lg bg-[var(--color-surface)] shadow-2xl"><div className="flex items-center justify-between border-b border-[var(--color-border)] p-4"><h2 className="text-base font-medium">{t.addTitle}</h2><button onClick={() => setShowAdd(false)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--color-surface-elevated)]"><X size={18} /></button></div><div className="space-y-3 p-4">{addError && <div className="rounded-lg bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">{addError}</div>}{[
        ['name', 'text', t.namePlaceholder], ['phone', 'tel', t.phonePlaceholder], ['password', 'password', t.passwordPlaceholder], ['region', 'text', t.regionOptional],
      ].map(([field, type, placeholder]) => <input key={field} type={type} placeholder={placeholder} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm outline-none focus:border-[var(--color-primary)]" />)}<div className="flex justify-end gap-2 pt-2"><button onClick={() => setShowAdd(false)} className="min-h-10 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-4 text-sm">{t.cancel}</button><button onClick={addCustomer} disabled={addLoading} className="min-h-10 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 text-sm text-white disabled:opacity-50">{addLoading ? t.creating : t.createUser}</button></div></div></div></div>}

      {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center px-4"><div className="fixed inset-0 bg-black/50" onClick={() => !deleteLoading && setDeleteTarget(null)} /><div className="relative w-full max-w-sm rounded-lg bg-[var(--color-surface)] p-5 shadow-2xl"><h2 className="text-base font-semibold">{t.confirmDelete}</h2><p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{t.deleteWarning}</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className="min-h-10 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-4 text-sm">{t.cancel}</button><button onClick={removeCustomer} disabled={deleteLoading} className="min-h-10 whitespace-nowrap rounded-lg bg-[var(--color-error)] px-4 text-sm text-white disabled:opacity-50">{deleteLoading ? t.deleting : t.confirmDeleteButton}</button></div></div></div>}
    </div>
  );
}
