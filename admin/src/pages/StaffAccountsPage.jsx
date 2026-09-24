import { useEffect, useState } from 'react';
import { Copy, KeyRound, RefreshCw, RotateCcw, UserMinus, UserPlus, X } from 'lucide-react';
import { runtimeConfig } from '../config/runtime';
import { useAdminLocale } from '../config/locale';
import { filterStaffAccounts, sortStaffAccounts } from './staffAccountList';
import {
  createAdminStaffAccount,
  deactivateAdminStaffAccount,
  getAdminStaffAccounts,
  reactivateAdminStaffAccount,
  resetAdminStaffPassword,
} from '../services/api';

// 后台已裁剪为知识中枢：内部员工账号只用来分发「知识库维护」权限。
// 商务组织、辖区、上级、档位等业务概念已随商务模块下线，不要再往回加。
const STAFF_ROLES = ['admin', 'operations', 'warehouse', 'procurement'];

const TEXT = {
  en: {
    title: 'Internal staff', subtitle: 'Create and control named accounts. Only Admin keeps full console access; every other role can maintain the knowledge base.',
    name: 'Display name', login: 'Login name', phone: 'Phone (optional)', role: 'Role', market: 'Market',
    marketHelp: 'Automatically assigned to this portal. This does not create an account in the other market.',
    create: 'Create staff account', creating: 'Creating...', refresh: 'Refresh', loading: 'Loading...', empty: 'No internal staff accounts.',
    active: 'Active', inactive: 'Inactive', forceChange: 'Password change required', reset: 'Reset temporary password', deactivate: 'Deactivate',
    temporaryTitle: 'Temporary password', temporaryBody: 'Share this password through a secure channel. It is shown only in this notice and must be changed at first sign-in.',
    copy: 'Copy password', copied: 'Copied', close: 'Close', failed: 'Operation failed: ',
    createTitle: 'Create staff account', createHint: 'Non-admin roles can sign in to maintain the knowledge base only.',
    createSubmit: 'Create account and issue temporary password',
    confirmTitle: 'Confirm the action',
    confirmResetTitle: 'Issue a new temporary password?',
    confirmResetBody: 'The previous password stops working immediately, and the employee must change it at the next sign-in.',
    confirmDeactivateTitle: 'Deactivate this staff account?',
    confirmDeactivateBody: 'Until it is restored it cannot sign in, and reset or deactivate are unavailable for it.',
    confirmReactivateTitle: 'Restore this staff account?',
    confirmReactivateBody: 'The account can sign in again with the access its role grants.',
    reactivate: 'Restore', confirmSubmit: 'Confirm', cancel: 'Cancel', pendingOperation: 'Processing…',
    searchPlaceholder: 'Search display name / login / phone', allRoles: 'All roles', allStatus: 'All statuses',
    noResults: 'No staff account matches the current search or filters.', clearFilters: 'Clear filters',
    inactiveHint: 'Inactive accounts can be restored; reset and deactivate stay unavailable while inactive.',
    roles: { admin: 'Admin', operations: 'Operations', warehouse: 'Warehouse', procurement: 'Procurement', business_director: 'Business director (legacy)', business_manager: 'Business manager (legacy)', business_specialist: 'Business specialist (legacy)' },
    markets: { all: 'All markets', com: 'International', cn: 'China' },
  },
  'zh-CN': {
    title: '内部员工账号', subtitle: '创建并管理实名账号。只有管理员保留完整后台权限，其他角色只能维护知识库。',
    name: '显示名称', login: '登录名', phone: '手机号（可选）', role: '角色', market: '市场范围',
    marketHelp: '自动归属当前后台，不会在另一市场同步创建账号。',
    create: '创建员工账号', creating: '创建中...', refresh: '刷新', loading: '加载中...', empty: '暂无内部员工账号。',
    active: '启用', inactive: '已停用', forceChange: '需修改密码', reset: '重置临时密码', deactivate: '停用账号',
    temporaryTitle: '临时密码', temporaryBody: '请通过安全渠道发送。该密码仅在本提示中显示一次，员工首次登录后必须修改。',
    copy: '复制密码', copied: '已复制', close: '关闭', failed: '操作失败：',
    createTitle: '创建员工账号', createHint: '非管理员角色登录后只能维护知识库。',
    createSubmit: '创建并生成临时密码',
    confirmTitle: '确认操作',
    confirmResetTitle: '确定生成新的临时密码？',
    confirmResetBody: '原密码将立即失效，员工下次登录后必须修改。',
    confirmDeactivateTitle: '确定停用该员工账号？',
    confirmDeactivateBody: '停用期间该账号无法登录，也不能重置密码或再次停用。',
    confirmReactivateTitle: '确定恢复该员工账号？',
    confirmReactivateBody: '恢复后该账号可以重新登录，权限按其角色生效。',
    reactivate: '恢复账号', confirmSubmit: '确认', cancel: '取消', pendingOperation: '处理中…',
    searchPlaceholder: '搜索显示名称 / 登录名 / 手机号', allRoles: '全部角色', allStatus: '全部状态',
    noResults: '没有匹配当前搜索或筛选条件的员工账号。', clearFilters: '清除筛选',
    inactiveHint: '已停用账号可恢复；停用期间不能重置密码或再次停用。',
    roles: { admin: '管理员', operations: '运营', warehouse: '仓库', procurement: '采购', business_director: '商务总监（历史）', business_manager: '商务经理（历史）', business_specialist: '商务专员（历史）' },
    markets: { all: '全部市场', com: '国际版', cn: '中国版' },
  },
};

const EMPTY_FORM = { display_name: '', login: '', phone: '', role: 'operations', market_scope: runtimeConfig.market };

export function StaffAccountsPage() {
  const locale = useAdminLocale();
  const t = TEXT[locale] || TEXT.en;
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  // { kind: 'deactivate' | 'reactivate' | 'reset', account } — a custom dialog so the action is explicit.
  const [confirmAction, setConfirmAction] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminStaffAccounts();
      setStaff(sortStaffAccounts(data.staff));
    } catch (err) {
      setError(`${t.failed}${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (pending) return;
    setPending('create');
    setError('');
    try {
      const data = await createAdminStaffAccount(form);
      setStaff((current) => [data.staff, ...current]);
      setTemporaryPassword(data.temporary_password);
      setForm(EMPTY_FORM);
      setDrawerOpen(false);
      await load();
    } catch (err) {
      setError(`${t.failed}${err.message}`);
    } finally {
      setPending('');
    }
  };

  // Both actions report success so the confirmation dialog only closes when the change landed.
  const deactivate = async (account) => {
    if (pending) return false;
    setPending(`deactivate:${account.id}`);
    setError('');
    try {
      const data = await deactivateAdminStaffAccount(account.id);
      setStaff((current) => current.map((item) => (item.id === account.id ? data.staff : item)));
      return true;
    } catch (err) {
      setError(`${t.failed}${err.message}`);
      return false;
    } finally {
      setPending('');
    }
  };

  const resetPassword = async (account) => {
    if (pending) return false;
    setPending(`reset:${account.id}`);
    setError('');
    try {
      const data = await resetAdminStaffPassword(account.id);
      setTemporaryPassword(data.temporary_password);
      setStaff((current) => current.map((item) => (item.id === account.id ? { ...item, must_change_password: 1 } : item)));
      return true;
    } catch (err) {
      setError(`${t.failed}${err.message}`);
      return false;
    } finally {
      setPending('');
    }
  };

  const reactivate = async (account) => {
    if (pending) return false;
    setPending(`reactivate:${account.id}`);
    setError('');
    try {
      const data = await reactivateAdminStaffAccount(account.id);
      setStaff((current) => current.map((item) => (item.id === account.id ? data.staff : item)));
      return true;
    } catch (err) {
      setError(`${t.failed}${err.message}`);
      return false;
    } finally {
      setPending('');
    }
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
  };

  // The dialog stays open while the request runs and after a failure so the error is readable.
  const runConfirm = async () => {
    const action = confirmAction;
    if (!action || pending) return;
    const request = action.kind === 'deactivate' ? deactivate : action.kind === 'reactivate' ? reactivate : resetPassword;
    if (await request(action.account)) setConfirmAction(null);
  };

  const filtered = filterStaffAccounts(staff, { query, role: roleFilter, status: statusFilter });
  const filteredOut = filtered.length !== staff.length;
  const clearFilters = () => { setQuery(''); setRoleFilter('all'); setStatusFilter('all'); };

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-lg font-semibold">{t.title}</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">{t.subtitle}</p></div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button type="button" onClick={load} className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm hover:border-[var(--color-primary)]"><RefreshCw size={15} />{t.refresh}</button>
          <button type="button" onClick={() => { setError(''); setDrawerOpen(true); }} className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"><UserPlus size={16} />{t.create}</button>
        </div>
      </div>

      {error && !drawerOpen && <div role="alert" data-testid="staff-error" className="mb-4 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      <div className="overflow-x-auto border-y border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
          <label htmlFor="staff-search" className="sr-only">{t.searchPlaceholder}</label>
          <input id="staff-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} className="w-full min-w-[220px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm sm:w-auto" />
          <label htmlFor="staff-filter-role" className="sr-only">{t.role}</label>
          <select id="staff-filter-role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-2 text-sm">
            <option value="all">{t.allRoles}</option>
            {Object.entries(t.roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <label htmlFor="staff-filter-status" className="sr-only">{t.allStatus}</label>
          <select id="staff-filter-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-2 text-sm">
            <option value="all">{t.allStatus}</option>
            <option value="active">{t.active}</option>
            <option value="inactive">{t.inactive}</option>
          </select>
          {filteredOut && <button type="button" onClick={clearFilters} className="rounded-lg border border-[var(--color-border)] px-2.5 py-2 text-xs hover:border-[var(--color-primary)]">{t.clearFilters}</button>}
          <span className="ml-auto text-xs text-[var(--color-text-muted)]">{filtered.length} / {staff.length}</span>
        </div>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-secondary)]"><tr>{[t.name, t.login, t.phone, t.role, t.active, ''].map((label, index) => <th key={`${label}-${index}`} className={`px-3 py-2 font-medium ${index === 5 ? 'text-right' : 'text-left'}`}>{label}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="6" className="px-3 py-10 text-center text-[var(--color-text-muted)]">{t.loading}</td></tr> : staff.length === 0 ? <tr><td colSpan="6" className="px-3 py-10 text-center text-[var(--color-text-muted)]">{t.empty}</td></tr> : filtered.length === 0 ? <tr><td colSpan="6" className="px-3 py-10 text-center text-[var(--color-text-muted)]">{t.noResults}</td></tr> : filtered.map((account) => {
              const busy = pending.endsWith(`:${account.id}`);
              return (
                <tr key={account.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2.5 font-medium">{account.display_name}</td><td className="px-3 py-2.5">{account.normalized_login}</td><td className="px-3 py-2.5">{account.normalized_phone || '-'}</td>
                  <td className="px-3 py-2.5">{t.roles[account.role] || account.role}</td>
                  <td className="px-3 py-2.5"><span className={`whitespace-nowrap text-xs ${account.is_active ? 'text-emerald-300' : 'text-red-300'}`}>{account.is_active ? t.active : t.inactive}</span>{account.must_change_password ? <span className="ml-2 whitespace-nowrap rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-200">{t.forceChange}</span> : null}</td>
                  <td className="px-3 py-2.5"><div className="flex items-center justify-end gap-2">{busy && <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">{t.pendingOperation}</span>}<span title={account.is_active ? undefined : t.inactiveHint}><button type="button" disabled={Boolean(pending) || !account.is_active} onClick={() => { setError(''); setConfirmAction({ kind: 'reset', account }); }} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs disabled:opacity-40"><KeyRound size={14} />{t.reset}</button></span>{account.is_active ? <span><button type="button" disabled={Boolean(pending)} onClick={() => { setError(''); setConfirmAction({ kind: 'deactivate', account }); }} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300 disabled:opacity-40"><UserMinus size={14} />{t.deactivate}</button></span> : <button type="button" disabled={Boolean(pending)} onClick={() => { setError(''); setConfirmAction({ kind: 'reactivate', account }); }} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-500/30 px-2.5 py-1.5 text-xs text-emerald-300 disabled:opacity-40"><RotateCcw size={14} />{t.reactivate}</button>}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/65" role="dialog" aria-modal="true" aria-label={t.createTitle}>
          <form onSubmit={submit} className="h-full w-full max-w-2xl overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
              <div><h3 className="font-semibold">{t.createTitle}</h3><p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.createHint}</p></div>
              <button type="button" aria-label={t.close} onClick={() => setDrawerOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)]"><X size={16} /></button>
            </div>
            <div className="grid gap-3 px-5 py-5 md:grid-cols-2">
              <div><label htmlFor="staff-display-name" className="mb-1 block text-xs text-[var(--color-text-muted)]">{t.name}</label><input id="staff-display-name" required value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" /></div>
              <div><label htmlFor="staff-login" className="mb-1 block text-xs text-[var(--color-text-muted)]">{t.login}</label><input id="staff-login" required value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" /></div>
              <div><label htmlFor="staff-phone" className="mb-1 block text-xs text-[var(--color-text-muted)]">{t.phone}</label><input id="staff-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" /></div>
              <div><label htmlFor="staff-role" className="mb-1 block text-xs text-[var(--color-text-muted)]">{t.role}</label><select id="staff-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
                {STAFF_ROLES.map((key) => <option key={key} value={key}>{t.roles[key]}</option>)}
              </select></div>
              <div className="md:col-span-2"><label htmlFor="staff-market" className="mb-1 block text-xs text-[var(--color-text-muted)]">{t.market}</label><input id="staff-market" readOnly value={t.markets[runtimeConfig.market]} aria-describedby="staff-market-help" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-muted)]" /><p id="staff-market-help" className="mt-1 text-xs text-[var(--color-text-muted)]">{t.marketHelp}</p></div>
            </div>
            <div className="sticky bottom-0 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
              <button type="submit" disabled={pending === 'create'} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><UserPlus size={16} />{pending === 'create' ? t.creating : t.createSubmit}</button>
            </div>
            {/* The page-level banner is covered by this overlay, so a failed create reports inside the drawer. */}
            {error && <p role="alert" data-testid="staff-error" className="mx-5 mb-4 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          </form>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div role="dialog" aria-modal="true" aria-label={t.confirmTitle} className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <h3 className="font-semibold">{confirmAction.kind === 'deactivate' ? t.confirmDeactivateTitle : confirmAction.kind === 'reactivate' ? t.confirmReactivateTitle : t.confirmResetTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{confirmAction.kind === 'deactivate' ? t.confirmDeactivateBody : confirmAction.kind === 'reactivate' ? t.confirmReactivateBody : t.confirmResetBody}</p>
            {error && <p role="alert" data-testid="staff-confirm-error" className="mt-2 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmAction(null)} className="whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">{t.cancel}</button>
              <button type="button" onClick={runConfirm} disabled={Boolean(pending)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmAction.kind === 'deactivate' ? 'bg-red-600' : confirmAction.kind === 'reactivate' ? 'bg-emerald-600' : 'bg-[var(--color-primary)]'}`}>{pending ? t.pendingOperation : t.confirmSubmit}</button>
            </div>
          </div>
        </div>
      )}

      {temporaryPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{t.temporaryTitle}</h3><p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{t.temporaryBody}</p></div><button type="button" onClick={() => setTemporaryPassword('')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)]"><X size={16} /></button></div>
            <div className="mt-4 select-all rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center font-mono text-lg font-semibold text-amber-200">{temporaryPassword}</div>
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={copyPassword} className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"><Copy size={15} />{copied ? t.copied : t.copy}</button><button type="button" onClick={() => setTemporaryPassword('')} className="whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white">{t.close}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
