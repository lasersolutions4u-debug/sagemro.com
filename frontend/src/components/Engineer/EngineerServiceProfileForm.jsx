import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { getEngineerServiceProfile, saveEngineerServiceProfile } from '../../services/api';
import { isCnLocale } from '../../utils/locale';

const MONEY = ['hourly_rate', 'day_rate', 'overtime_rate', 'travel_time_rate'];
const CAPABILITIES = ['unknown', 'none', 'diagnosis', 'replacement', 'internal_repair'];
const GROUPS = [
  { title: ['费用与有效期', 'Rates & validity'], fields: [
    ['currency', '币种（三位大写代码）', 'Currency (3 uppercase letters)', 'currency'],
    ['hourly_rate', '每小时费用', 'Hourly rate', 'money'],
    ['day_rate', '每日费用', 'Day rate', 'money'],
    ['hours_per_day', '每天包含工时', 'Hours included per day', 'hours'],
    ['minimum_hours', '最低计费工时', 'Minimum billable hours', 'hours'],
    ['overtime_rate', '加班每小时费用', 'Overtime hourly rate', 'money'],
    ['valid_until', '费用有效截止日期', 'Rates valid until', 'date'],
  ] },
  { title: ['驻地与差旅', 'Location & travel'], fields: [
    ['base_location', '常驻地', 'Base location'],
    ['coverage_regions', '可服务地区', 'Coverage regions'],
    ['travel_transport_standard', '交通方式及费用标准', 'Transport and reimbursement standard'],
    ['hotel_standard', '住宿标准', 'Hotel standard'],
    ['travel_time_rate', '旅途时间每小时费用', 'Travel time hourly rate', 'money'],
    ['cross_border_available', '是否可跨境服务', 'Cross-border availability', 'boolean'],
  ] },
  { title: ['设备经验与能力（自报）', 'Equipment experience & capabilities (self-reported)'], fields: [
    ['equipment_experience', '设备、品牌、型号、控制系统及实际经验', 'Equipment, brands, models, controllers and experience'],
    ['laser_source', '激光器能力（可多选）', 'Laser source capabilities (select all that apply)', 'capabilities'],
    ['cutting_head', '切割头能力（可多选）', 'Cutting head capabilities (select all that apply)', 'capabilities'],
  ] },
  { title: ['工具、场地与支持条件', 'Tools, workshop & service support'], fields: [
    ['tools', '工具名称、状况及取得方式（拥有／借用／租用）', 'Tools: name, condition and access (owned / borrowed / rented)'],
    ['workshop', '维修场地与条件', 'Workshop and facilities'],
    ['availability', '可用时间与提前预约要求', 'Availability and notice required'],
    ['languages', '服务语言及熟练程度', 'Languages and proficiency'],
    ['assistant_support', '助手支持及条件', 'Assistant support and conditions'],
    ['remote_support', '远程支持方式与条件', 'Remote support and conditions'],
    ['qualifications_evidence', '资质、培训及证明材料说明（待核实）', 'Qualifications, training and evidence references (unverified)'],
    ['limitations', '服务限制与不承接范围', 'Limitations and excluded work'],
  ] },
];
const FIELDS = GROUPS.flatMap(group => group.fields);
const emptyDraft = () => Object.fromEntries(FIELDS.map(([name, , , type]) => [name, type === 'capabilities' ? [] : '']));
const toDraft = profile => ({ ...emptyDraft(), ...Object.fromEntries(Object.entries(profile || {}).filter(([key]) => key !== 'version').map(([key, value]) => [key, value === null ? (['laser_source', 'cutting_head'].includes(key) ? [] : '') : value])) });
const capabilityLabels = {
  unknown: ['尚未说明', 'Not specified'], none: ['不具备', 'None'], diagnosis: ['故障诊断', 'Diagnosis'], replacement: ['整体更换', 'Replacement'], internal_repair: ['内部维修', 'Internal repair'],
};

export function EngineerServiceProfileForm({ engineerId }) {
  const cn = isCnLocale();
  const text = (zh, en) => cn ? zh : en;
  const id = useId();
  const [draft, setDraft] = useState(emptyDraft);
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState(null);
  const [retry, setRetry] = useState(0);
  const [identityChanged, setIdentityChanged] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const invalidated = useRef(false);
  const invalidateIdentity = useCallback(() => {
    if (invalidated.current) return;
    invalidated.current = true;
    generation.current++;
    setIdentityChanged(true);
    setDraft(emptyDraft());
    setLatest(null);
    setRevision(0);
    setUpdatedAt(null);
    setLoaded(false);
    setLoading(false);
    setSaving(false);
    setDirty(false);
    setConflict(false);
    setError('');
    setMessage('');
  }, []);
  const checkIdentity = useCallback(() => {
    if (invalidated.current) return false;
    if (typeof window === 'undefined') return true;
    try {
      const user = JSON.parse(window.localStorage.getItem('sagemro_user') || 'null');
      if (user?.id === engineerId && window.localStorage.getItem('sagemro_user_type') === 'engineer') return true;
    } catch { /* Storage unavailable: keep private profile closed. */ }
    invalidateIdentity();
    return false;
  }, [engineerId, invalidateIdentity]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = event => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      if (event.key === null || ['sagemro_user', 'sagemro_user_type'].includes(event.key)) checkIdentity();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [checkIdentity]);

  useEffect(() => {
    if (!checkIdentity()) return;
    const current = ++generation.current;
    setLoading(true);
    setLoaded(false);
    setError('');
    getEngineerServiceProfile(engineerId).then(data => {
      if (generation.current !== current || !checkIdentity()) return;
      setDraft(toDraft(data.profile));
      setRevision(data.revision);
      setUpdatedAt(data.updated_at);
      setLoaded(true);
      setDirty(false);
    }).catch(failure => {
      if (generation.current !== current || !checkIdentity()) return;
      if (failure.status === 401 || ['engineer_identity_changed', 'engineer_required'].includes(failure.code)) invalidateIdentity();
      else setError(cn ? '资料加载失败，请重试。' : 'Could not load profile. Please retry.');
    }).finally(() => { if (generation.current === current) setLoading(false); });
    return () => { generation.current = current + 1; };
  }, [engineerId, retry, cn, checkIdentity, invalidateIdentity]);

  const change = (name, value) => {
    setDraft(previous => ({ ...previous, [name]: value }));
    setDirty(true);
    setMessage('');
  };
  const applyServer = data => {
    setDraft(toDraft(data.profile));
    setRevision(data.revision);
    setUpdatedAt(data.updated_at);
    setDirty(false);
  };
  const save = async event => {
    event.preventDefault();
    if (!checkIdentity()) return;
    if (inFlight.current || !loaded || conflict || loading) return;
    const current = generation.current;
    inFlight.current = true;
    setSaving(true);
    setError('');
    setMessage('');
    const profile = { version: 1, ...Object.fromEntries(FIELDS.map(([name]) => [name, draft[name] === '' ? null : draft[name]])) };
    try {
      const saved = await saveEngineerServiceProfile({ revision, profile }, engineerId);
      if (generation.current !== current || !checkIdentity()) return;
      applyServer(saved);
      try {
        const confirmed = await getEngineerServiceProfile(engineerId);
        if (generation.current !== current || !checkIdentity()) return;
        applyServer(confirmed);
        setMessage(text('草稿已保存；资料仍为自报待核实。', 'Draft saved. Information remains self-reported and unverified.'));
      } catch (failure) {
        if (generation.current !== current || !checkIdentity()) return;
        if (failure.status === 401 || ['engineer_identity_changed', 'engineer_required'].includes(failure.code)) invalidateIdentity();
        else setMessage(text('保存已成功，但重新读取失败；下次打开可核对。', 'Saved successfully, but read-back failed. Reopen to check the saved profile.'));
      }
    } catch (failure) {
      if (generation.current !== current || !checkIdentity()) return;
      if (failure.status === 401 || ['engineer_identity_changed', 'engineer_required'].includes(failure.code)) invalidateIdentity();
      else if (failure.status === 409) {
        setConflict(true);
        setLatest(null);
        setError(text('其他窗口已修改资料。当前输入已保留，请读取最新版本并核对。', 'Another window changed this profile. Your draft is preserved. Load the latest version and compare.'));
      } else setError(text('未能确认保存。当前输入已保留，请检查金额、日期和网络后重试。', 'Could not confirm save. Your draft is preserved. Check amounts, dates and connection, then retry.'));
    } finally {
      inFlight.current = false;
      if (generation.current === current) setSaving(false);
    }
  };
  const loadLatest = async () => {
    if (!checkIdentity()) return;
    if (inFlight.current) return;
    const current = generation.current;
    inFlight.current = true;
    setLoading(true);
    try {
      const data = await getEngineerServiceProfile(engineerId);
      if (generation.current === current && checkIdentity()) setLatest(data);
    } catch (failure) {
      if (generation.current !== current || !checkIdentity()) return;
      if (failure.status === 401 || ['engineer_identity_changed', 'engineer_required'].includes(failure.code)) invalidateIdentity();
      else setError(text('最新版本读取失败，当前输入仍保留。', 'Could not load the latest version. Your draft is preserved.'));
    } finally {
      inFlight.current = false;
      if (generation.current === current) setLoading(false);
    }
  };
  const inputClass = 'mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]';
  const buttonClass = 'rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50';

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 text-[var(--color-text-primary)]" aria-label={text('工程师内部服务资料', 'Internal engineer service profile')}>
      <div className="border-l-4 border-[var(--color-primary)] pl-3">
        <h3 className="font-semibold">{text('内部费用、差旅与能力调查', 'Internal rates, travel & capability survey')}</h3>
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">{text('仅供内部成本参考，不是客户报价，也不代表派单。资料为工程师自报、待核实，能力选择不代表平台认证。可留空保存草稿；留空表示未知，不表示免费。', 'For internal cost reference only. This is not a customer quotation or a service assignment. Self-reported and unverified; capabilities are not platform certifications. Save a partial draft; blank means unknown, not free.')}</p>
      </div>
      {loading && <p role="status" className="text-sm">{text('正在读取资料…', 'Loading profile…')}</p>}
      {error && <p role="alert" className="text-sm text-[var(--color-text-primary)]">{error}</p>}
      {identityChanged && <div className="space-y-3"><p role="alert">{text('账号已切换，请重新加载页面', 'Account changed. Please reload the page')}</p><button type="button" onClick={() => window.location.reload()} className={buttonClass}>{text('重新加载页面', 'Reload page')}</button></div>}
      {!loaded && !loading && !identityChanged && <button type="button" onClick={() => setRetry(value => value + 1)} className={buttonClass}>{text('重试加载', 'Retry loading')}</button>}
      {loaded && <>
        <p className="text-xs text-[var(--color-text-secondary)]">{text('金额按所选币种的主币单位填写，最多两位小数；不自动换汇。', 'Enter amounts in the selected currency’s major units, with up to 2 decimals. No currency conversion.')}</p>
        <fieldset disabled={saving || loading} className="min-w-0 space-y-3">
          {GROUPS.map((group, index) => <details key={group.title[1]} open={index === 0} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <summary className="cursor-pointer text-sm font-medium">{group.title[cn ? 0 : 1]}</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {group.fields.map(([name, zh, en, type]) => {
                const label = `${cn ? zh : en}${MONEY.includes(name) ? ` (${draft.currency || text('请填写币种', 'set currency')})` : ''}`;
                if (type === 'capabilities') return <fieldset key={name} className="space-y-2 sm:col-span-2">
                  <legend className="text-xs text-[var(--color-text-secondary)]">{label}</legend>
                  <div className="flex flex-wrap gap-3">{CAPABILITIES.map(value => <label key={value} className="flex items-center gap-2 text-sm" htmlFor={`${id}-${name}-${value}`}>
                    <input id={`${id}-${name}-${value}`} name={`${name}-${value}`} type="checkbox" checked={(draft[name] || []).includes(value)} onChange={event => {
                      const values = draft[name] || [];
                      change(name, event.target.checked ? (['unknown', 'none'].includes(value) ? [value] : [...values.filter(item => !['unknown', 'none'].includes(item)), value]) : values.filter(item => item !== value));
                    }} />{capabilityLabels[value][cn ? 0 : 1]}
                  </label>)}</div>
                </fieldset>;
                return <div key={name} className={!type ? 'sm:col-span-2' : ''}>
                  <label htmlFor={`${id}-${name}`} className="text-xs text-[var(--color-text-secondary)]">{label}</label>
                  {type === 'boolean' ? <select id={`${id}-${name}`} name={name} value={draft[name] === '' ? '' : String(draft[name])} onChange={event => change(name, event.target.value === '' ? '' : event.target.value === 'true')} className={inputClass}>
                    <option value="">{text('尚未说明', 'Not specified')}</option><option value="true">{text('可以', 'Available')}</option><option value="false">{text('不可以', 'Not available')}</option>
                  </select> : !type ? <textarea id={`${id}-${name}`} name={name} value={draft[name]} onChange={event => change(name, event.target.value)} rows={2} maxLength={2000} className={inputClass} /> : <input id={`${id}-${name}`} name={name} value={draft[name]} onChange={event => change(name, event.target.value)} type={type === 'date' ? 'date' : 'text'} inputMode={['money', 'hours'].includes(type) ? 'decimal' : undefined} pattern={type === 'currency' ? '[A-Z]{3}' : ['money', 'hours'].includes(type) ? '(0|[1-9][0-9]{0,8})([.][0-9]{1,2})?' : undefined} maxLength={type === 'currency' ? 3 : 12} className={inputClass} />}
                </div>;
              })}
            </div>
          </details>)}
        </fieldset>
        {conflict && <div className="space-y-3 rounded-lg border border-[var(--color-primary)] p-3">
          <button type="button" onClick={loadLatest} disabled={loading} className={buttonClass}>{text('读取最新版本进行比较', 'Load latest for comparison')}</button>
          {latest && <>
            <p className="text-xs">{text('服务器最新资料（请与当前输入逐项核对）', 'Latest server profile (compare with your draft)')} · v{latest.revision}</p>
            <dl className="max-h-64 space-y-2 overflow-y-auto text-xs">{FIELDS.map(([name, zh, en]) => <div key={name}><dt className="font-medium">{cn ? zh : en}</dt><dd className="whitespace-pre-wrap break-words text-[var(--color-text-secondary)]">{Array.isArray(latest.profile?.[name]) ? latest.profile[name].map(value => capabilityLabels[value]?.[cn ? 0 : 1] || value).join(', ') : typeof latest.profile?.[name] === 'boolean' ? (latest.profile[name] ? text('可以', 'Available') : text('不可以', 'Not available')) : latest.profile?.[name] || text('尚未说明', 'Not specified')}</dd></div>)}</dl>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setRevision(latest.revision); setUpdatedAt(latest.updated_at); setConflict(false); setError(''); setLatest(null); setDirty(true); }} className={buttonClass}>{text('已核对，保留我的草稿并准备重新保存', 'Keep my draft after review; prepare to save again')}</button>
              <button type="button" onClick={() => { applyServer(latest); setConflict(false); setError(''); setLatest(null); }} className={buttonClass}>{text('用服务器最新资料替换当前输入', 'Replace my draft with the latest profile')}</button>
            </div>
          </>}
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-text-secondary)]">{dirty ? text('有未保存的修改；关闭将丢弃。', 'Unsaved changes; closing discards them.') : text('可随时补充资料，保存不代表资料已完整或核实。', 'You can add details later. Saving does not mean complete or verified.')} {updatedAt && `${text('更新于', 'Updated')} ${updatedAt}`}</p>
          <button type="submit" disabled={saving || loading || conflict} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? text('正在保存…', 'Saving…') : text('保存草稿', 'Save draft')}</button>
        </div>
        {message && <p role="status" className="text-sm">{message}</p>}
      </>}
    </form>
  );
}
