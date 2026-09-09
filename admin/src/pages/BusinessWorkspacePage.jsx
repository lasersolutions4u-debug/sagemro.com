import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { runtimeConfig } from '../config/runtime';
import { useAdminLocale } from '../config/locale';
import { assignBusinessRecord, getBusinessOrganization, getBusinessRecord, getBusinessRecords } from '../services/api';
import { businessRecordsCsv, collectBusinessRecords } from './businessWorkspaceExport';
import { BusinessQuotePanel } from '../components/BusinessQuotePanel';
import { BusinessPaymentPanel } from '../components/BusinessPaymentPanel';
import { BusinessExecutionPanel } from '../components/BusinessExecutionPanel';
import { BusinessServicePanel } from '../components/BusinessServicePanel';

const TEXT = {
  en: {
    title: 'Business workspace', subtitle: 'Customers, leads and service orders within your assigned scope.',
    customer: 'Customers', lead: 'All leads', work_order: 'Service orders', refresh: 'Refresh', export: 'Export all in scope', exporting: 'Preparing export',
    scope: 'Authorized territories', none: 'No territories assigned', grade: 'Grade', gradeHelp: 'Grades 1–3 do not expand data access.',
    admin: 'Administrator', business_director: 'Business director', business_manager: 'Business manager', business_specialist: 'Business specialist',
    loading: 'Loading…', empty: 'No records in this scope.', total: 'Total', more: 'Load more', detail: 'View details', close: 'Close',
    assign: 'Assign ownership', owner: 'Business owner', territory: 'Territory', choose: 'Choose…', save: 'Save ownership', saving: 'Saving…',
    unassigned: 'Unassigned', id: 'Record ID', name: 'Name / title', company: 'Company', email: 'Email', phone: 'Phone', region: 'Region', city: 'City',
    status: 'Status', source: 'Source', source_type: 'Source type', interest: 'Interest', message: 'Request', description: 'Description', urgency: 'Urgency',
    created_at: 'Created', order_no: 'Order number', user_no: 'Customer number', type: 'Service type', short_title: 'Title',
    changed: 'Your identity or access scope changed. Reload the page before continuing.', conflict: 'Ownership changed. Refresh and review before saving again.',
    exportChanged: 'Export stopped because data or permissions changed. Refresh and try again; no partial file was downloaded.',
    note: 'Business ownership is not an engineer dispatch. Unassigned records are available to administrators only.',
    invalidKind: 'This record type is unavailable.',
  },
  'zh-CN': {
    title: '商务工作台', subtitle: '统一处理授权范围内的客户、线索和服务工单。',
    customer: '客户', lead: '全部线索', work_order: '服务工单', refresh: '刷新', export: '导出范围内全部资料', exporting: '正在准备导出',
    scope: '授权辖区', none: '尚未分配辖区', grade: '档位', gradeHelp: '1—3 档不扩大数据查看权限。',
    admin: '管理员', business_director: '商务总监', business_manager: '商务经理', business_specialist: '商务专员',
    loading: '加载中…', empty: '当前范围内暂无资料。', total: '共', more: '加载更多', detail: '查看详情', close: '关闭',
    assign: '分配商务负责人', owner: '商务负责人', territory: '辖区', choose: '请选择…', save: '保存归属', saving: '保存中…',
    unassigned: '未分配', id: '记录编号', name: '客户／标题', company: '公司', email: '邮箱', phone: '电话', region: '地区', city: '城市',
    status: '状态', source: '来源', source_type: '来源类型', interest: '关注内容', message: '需求内容', description: '问题描述', urgency: '紧急程度',
    created_at: '创建时间', order_no: '工单号', user_no: '客户编号', type: '服务类型', short_title: '标题',
    changed: '账号或权限范围已变化，请重新加载页面后继续。', conflict: '归属已被更新，请刷新并核对后再保存。',
    exportChanged: '资料或权限发生变化，已中止导出。请刷新后重试；未下载不完整文件。',
    note: '商务负责人分配不是工程师派单。未分配资料仅管理员可见。',
    invalidKind: '此记录类型不可用。',
  },
};
const FIELDS = {
  customer: ['id', 'user_no', 'name', 'company', 'email', 'phone', 'region', 'city', 'created_at'],
  lead: ['id', 'name', 'email', 'phone', 'source', 'source_type', 'interest', 'message', 'status', 'region', 'created_at'],
  work_order: ['id', 'order_no', 'short_title', 'type', 'description', 'status', 'urgency', 'created_at'],
};
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-40';
const selectClass = 'mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm';

export function BusinessWorkspacePage({ user, recordKind }) {
  const locale = useAdminLocale();
  const t = TEXT[locale] || TEXT.en;
  const expectedStaffId = user.staffId || 'admin';
  const [selectedKind, setKind] = useState('customer');
  const fixedKind = recordKind !== undefined;
  const kind = fixedKind ? (typeof recordKind === 'string' && Object.hasOwn(FIELDS, recordKind) ? recordKind : null) : selectedKind;
  const [organization, setOrganization] = useState(null);
  const [data, setData] = useState({ records: [], total: 0 });
  const [detail, setDetail] = useState(null);
  const [assignment, setAssignment] = useState({ territory_id: '', owner_staff_id: '' });
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const generation = useRef(0);
  const controllers = useRef(new Set());
  const dialogRef = useRef(null);
  const detailTrigger = useRef(null);
  useEffect(() => {
    if (!detail || typeof document === 'undefined') return;
    const trapKeys = event => {
      if (event.key === 'Escape') { event.preventDefault(); setDetail(null); return; }
      if (event.key !== 'Tab') return;
      const fields = [...(dialogRef.current?.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') || [])].filter(node => node.getClientRects().length);
      const first = fields[0]; const last = fields.at(-1);
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapKeys);
    return () => {
      document.removeEventListener('keydown', trapKeys);
      if (detailTrigger.current?.isConnected) detailTrigger.current.focus();
    };
  }, [detail]);
  const isCurrent = useCallback(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('admin_user'));
      return (saved?.staffId || (saved?.staffRole === 'admin' ? 'admin' : null)) === expectedStaffId && saved?.staffRole === user.staffRole;
    } catch { return false; }
  }, [expectedStaffId, user.staffRole]);
  const cancel = useCallback(() => {
    generation.current += 1;
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
  }, []);
  const clearPrivateData = useCallback(() => {
    cancel(); setData({ records: [], total: 0 }); setOrganization(null); setDetail(null);
    setAssignment({ territory_id: '', owner_staff_id: '' }); setPending(''); setProgress(''); setLoading(false);
  }, [cancel]);
  useEffect(() => {
    const check = () => { if (!isCurrent()) { clearPrivateData(); setBlocked(true); setError(t.changed); } };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', check);
      window.addEventListener('focus', check);
    }
    return () => {
      cancel();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', check);
        window.removeEventListener('focus', check);
      }
    };
  }, [cancel, clearPrivateData, isCurrent]);
  const fail = (error, operation) => {
    if (error.name === 'AbortError') return;
    if ([401, 403].includes(error.status) || error.code === 'business_identity_changed') {
      clearPrivateData(); setBlocked(true); setError(t.changed);
    } else if (error.status === 409 || (error.status === 404 && operation === 'detail') || error.code === 'business_export_changed') {
      setDetail(null); setOrganization(null); setData({ records: [], total: 0 }); setError(operation === 'export' ? t.exportChanged : t.conflict);
    } else setError(error.message);
  };
  const load = useCallback(async () => {
    if (!kind) { clearPrivateData(); return; }
    cancel();
    const current = generation.current;
    const controller = new AbortController(); controllers.current.add(controller);
    setData({ records: [], total: 0 }); setDetail(null); setError(''); setLoading(true);
    try {
      if (!isCurrent()) throw Object.assign(new Error(t.changed), { status: 403 });
      const org = await getBusinessOrganization(expectedStaffId, controller.signal);
      const result = await getBusinessRecords(kind, { expected_staff_id: expectedStaffId, scope_version: org.scope_version, limit: 50 }, controller.signal);
      if (current !== generation.current) return;
      if (!isCurrent()) throw Object.assign(new Error(t.changed), { status: 403 });
      setOrganization(org); setData(result);
    } catch (err) {
      if (current === generation.current) fail(err);
    } finally {
      controllers.current.delete(controller);
      if (current === generation.current) setLoading(false);
    }
  }, [cancel, clearPrivateData, expectedStaffId, kind, isCurrent]);
  useEffect(() => { load(); }, [load]);
  const perform = async (key, action) => {
    if (pending || blocked) return;
    const current = generation.current;
    const controller = new AbortController(); controllers.current.add(controller);
    setPending(key); setError('');
    try {
      if (!isCurrent()) throw Object.assign(new Error(t.changed), { status: 403 });
      const result = await action(controller.signal);
      if (current !== generation.current) return;
      if (!isCurrent()) throw Object.assign(new Error(t.changed), { status: 403 });
      return result;
    } catch (err) { if (current === generation.current) fail(err, key); }
    finally { controllers.current.delete(controller); if (current === generation.current) setPending(''); }
  };
  const openDetail = async record => {
    if (typeof document !== 'undefined') detailTrigger.current = document.activeElement;
    const result = await perform('detail', async signal => {
      const response = await getBusinessRecord(kind, record.id, expectedStaffId, data.scope_version, signal);
      if (response.scope_version !== data.scope_version) throw Object.assign(new Error(t.changed), { status: 409 });
      return response;
    });
    if (result) { setDetail(result.record); setAssignment({ territory_id: result.record.territory_id || '', owner_staff_id: result.record.owner_staff_id || '' }); }
  };
  const loadMore = async () => {
    const result = await perform('more', signal => getBusinessRecords(kind, { expected_staff_id: expectedStaffId, scope_version: data.scope_version, cursor: data.next_cursor, limit: 50 }, signal));
    if (result) setData(current => ({ ...result, records: [...current.records, ...result.records] }));
  };
  const exportAll = async () => {
    const rows = await perform('export', signal => collectBusinessRecords({
      expectedStaffId, initialScopeVersion: data.scope_version, signal, isCurrent,
      fetchPage: (filters, pageSignal) => getBusinessRecords(kind, filters, pageSignal),
      onProgress: (count, total) => setProgress(`${count} / ${total}`),
    }));
    if (!rows || !isCurrent()) return;
    const columns = [...FIELDS[kind], 'territory_id', 'owner_staff_id'].map(key => ({ key, label: t[key] || (key === 'territory_id' ? t.territory : t.owner) }));
    const url = URL.createObjectURL(new Blob([businessRecordsCsv(rows, columns)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `sagemro-${kind}-${runtimeConfig.market}.csv`; link.click(); URL.revokeObjectURL(url);
    setProgress('');
  };
  const saveAssignment = async event => {
    event.preventDefault();
    const result = await perform('assign', signal => assignBusinessRecord(kind, detail.id, { expected_staff_id: expectedStaffId, scope_version: data.scope_version, revision: detail.assignment_revision || 0, ...assignment }, signal));
    if (result) await load();
  };
  const ownerLabel = id => organization?.staff.find(staff => staff.id === id)?.display_name || id || t.unassigned;
  if (!kind) return <div role="alert">{t.invalidKind}</div>;
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-semibold">{fixedKind ? t[kind] : t.title}</h1><p className="mt-1 text-sm text-[var(--color-text-muted)]">{t.subtitle}</p></div>
        <button className={buttonClass} disabled={loading || !!pending || blocked} onClick={load}><RefreshCw size={15} />{t.refresh}</button>
      </header>
      {error && <div role="alert" className="border-l-2 border-amber-400 bg-amber-500/10 p-3 text-sm">{error}</div>}
      {!blocked && <>
        <div className="border-y border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm">
          <p className="font-medium">{t[organization?.role || user.staffRole]}{organization?.grade ? ` · ${t.grade} ${organization.grade}` : ''}</p>
          <p className="mt-1 text-[var(--color-text-secondary)]">{t.scope}：{organization?.territories.map(territory => territory.name).join(' / ') || t.none}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.gradeHelp}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!fixedKind && <div className="flex flex-wrap gap-1" role="group" aria-label={t.title}>{Object.keys(FIELDS).map(value => <button key={value} disabled={!!pending} aria-pressed={kind === value} onClick={() => setKind(value)} className={`${buttonClass} ${kind === value ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : ''}`}>{t[value]}</button>)}</div>}
          <button className={buttonClass} disabled={loading || !!pending || !organization} onClick={exportAll}><Download size={15} />{pending === 'export' ? `${t.exporting} ${progress}` : t.export}</button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">{t.note}</p>
        <div className="overflow-x-auto border-y border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-[var(--color-surface-elevated)] text-xs"><tr>{[t.name, kind === 'work_order' ? t.status : t.email, t.owner, ''].map((label, i) => <th key={i} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan="4" className="p-8 text-center">{t.loading}</td></tr> : !data.records.length ? <tr><td colSpan="4" className="p-8 text-center text-[var(--color-text-muted)]">{t.empty}</td></tr> : data.records.map(record => <tr key={record.id} className="border-t border-[var(--color-border)]"><td className="max-w-xs break-words px-4 py-3">{record.name || record.short_title || record.order_no || record.id}</td><td className="max-w-xs break-words px-4 py-3">{record.email || record.status || '—'}</td><td className="px-4 py-3">{ownerLabel(record.owner_staff_id)}</td><td className="px-4 py-3"><button disabled={!!pending} className={buttonClass} onClick={() => openDetail(record)}>{t.detail}</button></td></tr>)}</tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm"><span>{t.total} {data.total}</span>{data.next_cursor && <button disabled={!!pending} className={buttonClass} onClick={loadMore}>{t.more}</button>}</div>
      </>}
      {detail && !blocked && <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="business-record-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between"><h2 id="business-record-title" className="font-semibold">{t.detail}</h2><button autoFocus aria-label={t.close} onClick={() => setDetail(null)} className={buttonClass}><X size={16} /></button></div>
          <dl className="my-5 grid gap-3 sm:grid-cols-2">{FIELDS[kind].map(key => <div key={key} className="min-w-0"><dt className="text-xs text-[var(--color-text-muted)]">{t[key] || key}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{detail[key] || '—'}</dd></div>)}</dl>
          {kind === 'work_order' && <BusinessQuotePanel key={`${detail.id}:${data.scope_version}`} workOrderId={detail.id} expectedStaffId={expectedStaffId} scopeVersion={data.scope_version} isCurrent={isCurrent} onAccessError={fail} />}
          {kind === 'work_order' && <BusinessPaymentPanel key={`payments:${detail.id}:${data.scope_version}`} workOrderId={detail.id} expectedStaffId={expectedStaffId} scopeVersion={data.scope_version} isCurrent={isCurrent} onAccessError={fail} />}
          {kind === 'work_order' && <BusinessExecutionPanel key={`execution:${detail.id}:${data.scope_version}`} workOrderId={detail.id} readOnly expectedStaffId={expectedStaffId} scopeVersion={data.scope_version} isCurrent={isCurrent} onAccessError={fail} />}
          {kind === 'work_order' && <BusinessServicePanel collapsed key={`service:${detail.id}:${data.scope_version}`} workOrderId={detail.id} expectedStaffId={expectedStaffId} scopeVersion={data.scope_version} isCurrent={isCurrent} onAccessError={fail} />}
          {organization?.can_assign && <form onSubmit={saveAssignment} className="space-y-3 border-t border-[var(--color-border)] pt-4"><h3 className="text-sm font-medium">{t.assign}</h3>
            <label className="block text-sm">{t.territory}<select required aria-label={t.territory} className={selectClass} value={assignment.territory_id} onChange={event => setAssignment({ territory_id: event.target.value, owner_staff_id: '' })}><option value="">{t.choose}</option>{organization.territories.filter(territory => territory.market === organization.market).map(territory => <option key={territory.id} value={territory.id}>{territory.name}</option>)}</select></label>
            <label className="block text-sm">{t.owner}<select required aria-label={t.owner} className={selectClass} value={assignment.owner_staff_id} onChange={event => setAssignment({ ...assignment, owner_staff_id: event.target.value })}><option value="">{t.choose}</option>{organization.staff.filter(staff => staff.is_active && staff.effective_territory_ids?.includes(assignment.territory_id)).map(staff => <option key={staff.id} value={staff.id}>{staff.display_name} · {t[staff.role] || staff.role}</option>)}</select></label>
            <button disabled={!!pending} className={`${buttonClass} bg-[var(--color-primary)] text-white`} type="submit">{pending === 'assign' ? t.saving : t.save}</button>
          </form>}
        </div>
      </div>}
    </section>
  );
}
