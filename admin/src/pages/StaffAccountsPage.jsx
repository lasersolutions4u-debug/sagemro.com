import { useEffect, useState } from 'react';
import { Copy, KeyRound, RefreshCw, UserMinus, UserPlus, X } from 'lucide-react';
import { runtimeConfig } from '../config/runtime';
import {
  createAdminStaffAccount,
  deactivateAdminStaffAccount,
  getAdminStaffAccounts,
  resetAdminStaffPassword,
} from '../services/api';

const TEXT = {
  en: {
    title: 'Internal staff', subtitle: 'Create and control named operations, warehouse, procurement, and Admin accounts.',
    name: 'Display name', login: 'Login name', phone: 'Phone (optional)', role: 'Role', market: 'Market',
    create: 'Create staff account', creating: 'Creating...', refresh: 'Refresh', loading: 'Loading...', empty: 'No internal staff accounts.',
    active: 'Active', inactive: 'Inactive', forceChange: 'Password change required', reset: 'Reset temporary password', deactivate: 'Deactivate',
    temporaryTitle: 'Temporary password', temporaryBody: 'Share this password through a secure channel. It is shown only in this notice and must be changed at first sign-in.',
    copy: 'Copy password', copied: 'Copied', close: 'Close', failed: 'Operation failed: ', confirmDeactivate: 'Deactivate this staff account?',
    roles: { admin: 'Admin', operations: 'Operations', warehouse: 'Warehouse', procurement: 'Procurement' },
    markets: { all: 'All markets', com: 'International', cn: 'China' },
  },
  'zh-CN': {
    title: '内部员工账号', subtitle: '创建并管理运营、仓库、采购和管理员实名账号。',
    name: '显示名称', login: '登录名', phone: '手机号（可选）', role: '角色', market: '市场范围',
    create: '创建员工账号', creating: '创建中...', refresh: '刷新', loading: '加载中...', empty: '暂无内部员工账号。',
    active: '启用', inactive: '已停用', forceChange: '需修改密码', reset: '重置临时密码', deactivate: '停用账号',
    temporaryTitle: '临时密码', temporaryBody: '请通过安全渠道发送。该密码仅在本提示中显示一次，员工首次登录后必须修改。',
    copy: '复制密码', copied: '已复制', close: '关闭', failed: '操作失败：', confirmDeactivate: '确定停用该员工账号？',
    roles: { admin: '管理员', operations: '运营', warehouse: '仓库', procurement: '采购' },
    markets: { all: '全部市场', com: '国际版', cn: '中国版' },
  },
};

const EMPTY_FORM = { display_name: '', login: '', phone: '', role: 'operations', market_scope: 'all' };

export function StaffAccountsPage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminStaffAccounts();
      setStaff(data.staff || []);
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
    } catch (err) {
      setError(`${t.failed}${err.message}`);
    } finally {
      setPending('');
    }
  };

  const deactivate = async (account) => {
    if (pending || !window.confirm(t.confirmDeactivate)) return;
    setPending(`deactivate:${account.id}`);
    setError('');
    try {
      const data = await deactivateAdminStaffAccount(account.id);
      setStaff((current) => current.map((item) => (item.id === account.id ? data.staff : item)));
    } catch (err) {
      setError(`${t.failed}${err.message}`);
    } finally {
      setPending('');
    }
  };

  const resetPassword = async (account) => {
    if (pending) return;
    setPending(`reset:${account.id}`);
    setError('');
    try {
      const data = await resetAdminStaffPassword(account.id);
      setTemporaryPassword(data.temporary_password);
      setStaff((current) => current.map((item) => (item.id === account.id ? { ...item, must_change_password: 1 } : item)));
    } catch (err) {
      setError(`${t.failed}${err.message}`);
    } finally {
      setPending('');
    }
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-lg font-semibold">{t.title}</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">{t.subtitle}</p></div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 self-start whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm hover:border-[var(--color-primary)]"><RefreshCw size={15} />{t.refresh}</button>
      </div>

      {error && <div className="mb-4 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      <form onSubmit={submit} className="mb-5 grid gap-3 border-y border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_160px_150px_auto]">
        <div><label htmlFor="staff-display-name" className="mb-1 block text-xs text-[var(--color-text-muted)]">{t.name}</label><input id="staff-display-name" required value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" /></div>
        <div><label htmlFor="staff-login" className="mb-1 block text-xs text-[var(--color-text-muted)]">{t.login}</label><input id="staff-login" required value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" /></div>
        <div><label htmlFor="staff-phone" className="mb-1 block text-xs text-[var(--color-text-muted)]">{t.phone}</label><input id="staff-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" /></div>
        <div><label htmlFor="staff-role" className="mb-1 block text-xs text-[var(--color-text-muted)]">{t.role}</label><select id="staff-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
          {Object.entries(t.roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></div>
        <div><label htmlFor="staff-market" className="mb-1 block text-xs text-[var(--color-text-muted)]">{t.market}</label><select id="staff-market" value={form.market_scope} onChange={(event) => setForm({ ...form, market_scope: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
          {Object.entries(t.markets).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></div>
        <button type="submit" disabled={pending === 'create'} className="inline-flex items-center justify-center gap-2 self-end whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><UserPlus size={16} />{pending === 'create' ? t.creating : t.create}</button>
      </form>

      <div className="overflow-x-auto border-y border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-secondary)]"><tr>{[t.name, t.login, t.phone, t.role, t.market, t.active, ''].map((label, index) => <th key={`${label}-${index}`} className="px-3 py-2 text-left font-medium">{label}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7" className="px-3 py-10 text-center text-[var(--color-text-muted)]">{t.loading}</td></tr> : staff.length === 0 ? <tr><td colSpan="7" className="px-3 py-10 text-center text-[var(--color-text-muted)]">{t.empty}</td></tr> : staff.map((account) => (
              <tr key={account.id} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2.5 font-medium">{account.display_name}</td><td className="px-3 py-2.5">{account.normalized_login}</td><td className="px-3 py-2.5">{account.normalized_phone || '-'}</td>
                <td className="px-3 py-2.5">{t.roles[account.role] || account.role}</td><td className="px-3 py-2.5">{t.markets[account.market_scope] || account.market_scope}</td>
                <td className="px-3 py-2.5"><span className={`whitespace-nowrap text-xs ${account.is_active ? 'text-emerald-300' : 'text-red-300'}`}>{account.is_active ? t.active : t.inactive}{account.must_change_password ? ` · ${t.forceChange}` : ''}</span></td>
                <td className="px-3 py-2.5"><div className="flex justify-end gap-2"><button type="button" disabled={Boolean(pending) || !account.is_active} onClick={() => resetPassword(account)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs disabled:opacity-40"><KeyRound size={14} />{t.reset}</button><button type="button" disabled={Boolean(pending) || !account.is_active} onClick={() => deactivate(account)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300 disabled:opacity-40"><UserMinus size={14} />{t.deactivate}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
