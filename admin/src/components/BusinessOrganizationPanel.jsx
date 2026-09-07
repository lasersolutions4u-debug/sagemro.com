import { useState } from 'react';
import { runtimeConfig } from '../config/runtime';
import { createBusinessTerritory, updateBusinessStaff } from '../services/api';

const inputClass = 'mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm';
export const BUSINESS_ROLES = ['business_director', 'business_manager', 'business_specialist'];
const roleNames = { en: ['Business director', 'Business manager', 'Business specialist'], 'zh-CN': ['商务总监', '商务经理', '商务专员'] };

export function BusinessStaffFields({ value, onChange, organization, disabled = false }) {
  const cn = runtimeConfig.locale === 'zh-CN';
  if (!BUSINESS_ROLES.includes(value.role)) return null;
  const director = value.role === 'business_director';
  const parentRole = value.role === 'business_manager' ? 'business_director' : 'business_manager';
  const territories = (organization?.territories || []).filter(item => value.market_scope === 'all' || item.market === value.market_scope);
  const parent = organization?.staff.find(item => item.id === value.supervisor_staff_id);
  const inherited = territories.filter(item => parent?.effective_territory_ids?.includes(item.id));
  return <fieldset disabled={disabled} className="col-span-full grid gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-2">
    <legend className="pt-2 text-xs text-[var(--color-text-muted)]">{cn ? '商务岗位与授权（档位不扩大权限）' : 'Business role and scope (grades do not expand access)'}</legend>
    <label className="text-sm">{cn ? '档位' : 'Grade'}<select aria-label={cn ? '档位' : 'Grade'} className={inputClass} value={value.grade || 1} onChange={event => onChange({ ...value, grade: Number(event.target.value) })}>{[1, 2, 3].map(grade => <option key={grade} value={grade}>{grade}</option>)}</select></label>
    {!director && <label className="text-sm">{cn ? '直属上级' : 'Direct supervisor'}<select required aria-label={cn ? '直属上级' : 'Direct supervisor'} className={inputClass} value={value.supervisor_staff_id || ''} onChange={event => onChange({ ...value, supervisor_staff_id: event.target.value })}><option value="">{cn ? '请选择…' : 'Choose…'}</option>{(organization?.staff || []).filter(item => item.id !== value.id && item.is_active && item.role === parentRole && (item.market_scope === 'all' || item.market_scope === value.market_scope)).map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>}
    {director && <fieldset className="min-w-0 space-y-2 text-sm"><legend>{cn ? '授权辖区' : 'Authorized territories'}</legend>{!territories.length && <p className="text-xs text-[var(--color-text-muted)]">{cn ? '请先在下方创建辖区。未授权时不可查看业务资料。' : 'Create a territory below. No business records are visible without a grant.'}</p>}{territories.map(item => <label key={item.id} className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={(value.territory_ids || []).includes(item.id)} onChange={event => onChange({ ...value, territory_ids: event.target.checked ? [...(value.territory_ids || []), item.id] : (value.territory_ids || []).filter(id => id !== item.id) })} /><span className="break-words">{item.name} · {item.market.toUpperCase()}</span></label>)}</fieldset>}
    {!director && <p className="col-span-full text-sm text-[var(--color-text-secondary)]">{cn ? '继承上级辖区（当前市场）' : 'Inherited territories (current market)'}：{inherited.map(item => item.name).join(' / ') || (cn ? '尚无授权辖区' : 'No territories assigned')}</p>}
  </fieldset>;
}

export function BusinessOrganizationPanel({ organization, onSaved }) {
  const cn = runtimeConfig.locale === 'zh-CN';
  const [territoryName, setTerritoryName] = useState('');
  const [edit, setEdit] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!organization?.can_configure) return null;
  const currentIdentity = () => {
    try { const saved = JSON.parse(localStorage.getItem('admin_user')); return saved?.staffRole === 'admin' && saved.staffId == null; } catch { return false; }
  };
  const submit = async (event, action) => {
    event.preventDefault();
    if (pending) return;
    if (!currentIdentity()) { setEdit(null); setError(cn ? '账号已变化，请重新加载页面。' : 'Identity changed. Reload the page.'); return; }
    setPending(true); setError('');
    try { await action(); setEdit(null); setTerritoryName(''); await onSaved(); }
    catch (err) { setError(err.status === 409 ? (cn ? '配置已发生变化，请刷新后重新核对。' : 'Configuration changed. Refresh and review again.') : err.message); }
    finally { setPending(false); }
  };
  const chooseStaff = id => {
    const staff = organization.staff.find(item => item.id === id);
    setError('');
    setEdit(staff ? { ...staff, grade: staff.grade || 1, territory_ids: staff.territory_ids || [] } : null);
  };
  return <section className="mb-5 space-y-4 border-y border-[var(--color-border)] bg-[var(--color-surface)] p-4">
    <div><h3 className="font-medium">{cn ? '商务组织与辖区' : 'Business organization and territories'}</h3><p className="mt-1 text-xs text-[var(--color-text-muted)]">{cn ? '总监 → 经理 → 专员，各 3 档。调整上级或辖区会立即改变资料访问范围。' : 'Director → manager → specialist, each with 3 grades. Supervisor and territory changes immediately change record access.'}</p></div>
    {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
    <form onSubmit={event => submit(event, () => createBusinessTerritory({ expected_staff_id: 'admin', name: territoryName, market: organization.market, scope_version: organization.scope_version }))} className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm">{cn ? '新增辖区名称' : 'New territory name'}<input required maxLength={100} value={territoryName} onChange={event => setTerritoryName(event.target.value)} className={inputClass} /></label>
      <span className="py-2 text-xs text-[var(--color-text-muted)]">{organization.market === 'cn' ? (cn ? '中国版' : 'China') : (cn ? '国际版' : 'International')}</span>
      <button disabled={pending || !territoryName.trim()} type="submit" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-40">{cn ? '创建辖区' : 'Create territory'}</button>
    </form>
    <form onSubmit={event => submit(event, () => updateBusinessStaff(edit.id, { expected_staff_id: 'admin', revision: edit.revision, role: edit.role, grade: edit.grade, supervisor_staff_id: edit.role === 'business_director' ? null : edit.supervisor_staff_id, territory_ids: edit.role === 'business_director' ? edit.territory_ids : [], scope_version: organization.scope_version }))} className="grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
      <label className="text-sm">{cn ? '调整现有商务员工' : 'Edit existing business staff'}<select disabled={pending} className={inputClass} value={edit?.id || ''} onChange={event => chooseStaff(event.target.value)}><option value="">{cn ? '请选择…' : 'Choose…'}</option>{organization.staff.filter(item => item.is_active && BUSINESS_ROLES.includes(item.role)).map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>
      {edit && <>
        <label className="text-sm">{cn ? '商务岗位' : 'Business role'}<select disabled={pending} className={inputClass} value={edit.role} onChange={event => setEdit({ ...edit, role: event.target.value, supervisor_staff_id: null, territory_ids: [] })}>{BUSINESS_ROLES.map((role, i) => <option key={role} value={role}>{(roleNames[runtimeConfig.locale] || roleNames.en)[i]}</option>)}</select></label>
        <BusinessStaffFields value={edit} onChange={setEdit} organization={organization} disabled={pending} />
        <button type="submit" disabled={pending} className="justify-self-start rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-white disabled:opacity-40">{cn ? '保存商务授权' : 'Save business authorization'}</button>
      </>}
    </form>
  </section>;
}
