import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { runtimeConfig } from '../config/runtime';
import { getBusinessOrganization, getBusinessService, getBusinessServiceMedia, mutateBusinessService, searchBusinessServiceMaterials } from '../services/api';
import { RepairRecordPanel } from '../../../frontend/src/components/WorkOrder/RepairRecordPanel';
import { FieldWorkPanel } from '../../../frontend/src/components/WorkOrder/FieldWorkPanel';

const button = 'rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-40';
const labels = {
  'task.device_identity': ['确认设备身份', 'Verify equipment identity'], 'task.problem_and_goal': ['确认问题与服务目标', 'Confirm issue and service goal'],
  'task.contact_and_window': ['确认联系人与服务时间', 'Confirm contact and service window'], 'risk.hazards_reviewed': ['评估现场风险', 'Review site hazards'],
  'risk.isolation_permission': ['确认隔离与作业许可', 'Confirm isolation and work permission'], 'risk.ppe_and_access': ['确认防护与现场准入', 'Confirm PPE and site access'],
  'ready.tools_and_documents': ['备齐工具和资料', 'Prepare tools and documentation'], 'ready.parts_and_consumables': ['确认配件与耗材', 'Check parts and consumables'],
  'ready.start_conditions': ['核实开工条件', 'Verify start conditions'], 'execute.baseline_evidence': ['记录设备初始状态', 'Record baseline evidence'],
  'execute.actions_recorded': ['记录服务措施', 'Record service actions'], 'execute.scope_authorized': ['确认作业在授权范围内', 'Confirm authorized scope'],
  'verify.functional_test': ['完成功能测试', 'Complete functional testing'], 'verify.safety_restored': ['确认安全状态恢复', 'Verify safety restored'],
  'verify.residual_risk': ['说明剩余风险', 'Disclose residual risks'], 'handover.service_report': ['提交最终服务报告', 'Submit final service report'],
  'handover.customer_confirmation': ['客户验收', 'Customer acceptance'], 'handover.follow_up': ['安排后续跟进', 'Arrange follow-up'],
};
function savedIdentity() {
  try {
    const user = JSON.parse(localStorage.getItem('admin_user'));
    const role = user?.staffRole, id = user?.staffId || (role === 'admin' ? 'admin' : null);
    return id && ['admin', 'business_director', 'business_manager', 'business_specialist'].includes(role) ? { id, role } : null;
  } catch { return null; }
}

export function BusinessServicePanel({ collapsed = false, ...props }) {
  const [open, setOpen] = useState(!collapsed);
  return open ? <BusinessServiceContent {...props} /> : <button type="button" className={`${button} mt-4`} onClick={() => setOpen(true)}>{runtimeConfig.locale === 'zh-CN' ? '打开商务服务执行' : 'Open business service execution'}</button>;
}

function BusinessServiceContent({ workOrderId, expectedStaffId, scopeVersion, isCurrent, onAccessError, readOnly = false }) {
  const zh = runtimeConfig.locale === 'zh-CN';
  const text = useCallback((cn, en) => zh ? cn : en, [zh]);
  const changed = text('账号或权限范围已变化，请关闭并重新打开工单。', 'Your account or access scope changed. Close and reopen this order.');
  const [identity] = useState(savedIdentity);
  const [state, setState] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [blocked, setBlocked] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [message, setMessage] = useState(''), [internal, setInternal] = useState(false);
  const snapshot = useRef(null), epoch = useRef(0), busy = useRef(false), blockedRef = useRef(false), retries = useRef(new Map());
  const controllers = useRef(new Set()), props = useRef({ isCurrent, onAccessError, expectedStaffId, scopeVersion, readOnly });
  useLayoutEffect(() => { props.current = { isCurrent, onAccessError, expectedStaffId, scopeVersion, readOnly }; }, [isCurrent, onAccessError, expectedStaffId, scopeVersion, readOnly]);
  const current = useCallback(() => {
    const saved = savedIdentity();
    return !blockedRef.current && identity && saved?.id === identity.id && saved.role === identity.role
      && (!props.current.expectedStaffId || identity.id === props.current.expectedStaffId)
      && (!props.current.isCurrent || props.current.isCurrent());
  }, [identity]);
  const cancelRequests = useCallback(() => {
    epoch.current++; controllers.current.forEach(controller => controller.abort()); controllers.current.clear();
  }, []);
  const invalidate = useCallback(err => {
    cancelRequests();
    blockedRef.current = true; snapshot.current = null; retries.current.clear();
    setState(null); setMessage(''); setInternal(false); setNotice(''); setBlocked(true); setError(changed); setLoading(false); setPending(false);
    props.current.onAccessError?.(err, 'detail');
  }, [cancelRequests, changed]);
  const guard = useCallback(() => { if (!current()) throw Object.assign(new Error(changed), { status: 403 }); }, [current, changed]);
  const fail = useCallback(err => {
    if ([401, 403, 404, 409].includes(err.status)) invalidate(err);
    else if (err.name !== 'AbortError') setError(err.message);
  }, [invalidate]);
  const refresh = useCallback(async () => {
    const generation = epoch.current, controller = new AbortController(); controllers.current.add(controller);
    try {
      guard();
      const scope = props.current.scopeVersion || snapshot.current?.scope_version || (await getBusinessOrganization(identity.id, controller.signal)).scope_version;
      guard();
      const data = await getBusinessService(workOrderId, identity.id, scope, controller.signal);
      if (generation !== epoch.current || controller.signal.aborted) throw new DOMException('View changed', 'AbortError');
      guard();
      if (data.scope_version !== scope) throw Object.assign(new Error(changed), { status: 409 });
      if (!Number.isInteger(data.revision) || !Number.isInteger(data.quote_version) || !data.capabilities) throw new Error(text('服务状态数据不完整。', 'Incomplete service state.'));
      snapshot.current = data; setState(data); setRefreshRequired(false); return data;
    } catch (err) { if (generation === epoch.current) fail(err); throw err; }
    finally { controllers.current.delete(controller); }
  }, [workOrderId, identity, guard, changed, text, fail]);

  useEffect(() => {
    blockedRef.current = false; snapshot.current = null; setState(null); setBlocked(false); setError(''); setNotice(''); setLoading(true); retries.current.clear();
    const check = () => { if (!current()) invalidate(Object.assign(new Error(changed), { status: 403 })); };
    const toast = event => { if (current()) setNotice(event.detail.message); };
    window.addEventListener('focus', check); window.addEventListener('storage', check); window.addEventListener('sagemro:toast', toast);
    refresh().catch(() => {}).finally(() => setLoading(false));
    return () => { cancelRequests(); window.removeEventListener('focus', check); window.removeEventListener('storage', check); window.removeEventListener('sagemro:toast', toast); };
  }, [refresh, expectedStaffId, scopeVersion, isCurrent, current, invalidate, changed, cancelRequests]);

  const mutate = useCallback(async (action, data = {}, key) => {
    if (busy.current) throw new Error(text('操作处理中，请稍候。', 'An operation is in progress.'));
    const generation = epoch.current, controller = new AbortController(); controllers.current.add(controller);
    busy.current = true; setPending(true); setError(''); setNotice('');
    try {
      guard();
      if (props.current.readOnly || !snapshot.current) throw Object.assign(new Error(changed), { status: 403 });
      const multipart = data instanceof FormData;
      const fingerprint = JSON.stringify(multipart ? [...data.entries()].map(([name, value]) => [name, value instanceof Blob ? [value.name, value.size, value.lastModified] : value]) : data);
      const retryId = `${action}:${key || fingerprint}`;
      let context = retries.current.get(retryId);
      if (!context) {
        context = { expected_staff_id: identity.id, scope_version: snapshot.current.scope_version,
          quote_version: snapshot.current.quote_version, revision: snapshot.current.revision, idempotency_key: key || crypto.randomUUID() };
        retries.current.set(retryId, context);
      }
      const result = await mutateBusinessService(workOrderId, action, multipart ? data : { ...data, ...context }, controller.signal, context);
      if (generation !== epoch.current || controller.signal.aborted) throw new DOMException('View changed', 'AbortError');
      guard();
      try { await refresh(); retries.current.delete(retryId); }
      catch (err) {
        if ([401, 403, 404, 409].includes(err.status) || err.name === 'AbortError') throw err;
        setRefreshRequired(true);
        setNotice(text('操作已保存，但状态刷新失败。请刷新服务状态后继续。', 'The operation was saved, but refresh failed. Refresh service status before continuing.'));
      }
      return result;
    } catch (err) { if (generation === epoch.current) fail(err); throw err; }
    finally { controllers.current.delete(controller); if (generation === epoch.current) { busy.current = false; setPending(false); } }
  }, [workOrderId, identity, refresh, text, guard, changed, fail]);

  const serviceApi = useMemo(() => ({
    currency: zh ? 'CNY' : 'USD',
    saveRepairRecord: (_id, report) => mutate('report', report),
    getFieldDays: async () => { guard(); return snapshot.current?.field_days || { field_days: [], media: [] }; },
    getFieldMedia: async (_id, mediaId, signal) => {
      try {
        guard(); const generation = epoch.current;
        const blob = await getBusinessServiceMedia(workOrderId, mediaId, identity.id, snapshot.current.scope_version, signal);
        guard(); if (generation !== epoch.current) throw new DOMException('View changed', 'AbortError'); return blob;
      } catch (err) { fail(err); throw err; }
    },
    checkInFieldDay: (_id, { photo, expectedCheckoutTime, location }, key) => {
      const form = new FormData(); form.append('photo', photo); form.append('expected_checkout_time', expectedCheckoutTime); form.append('location', JSON.stringify(location));
      return mutate('field-days/check-in', form, key);
    },
    checkInWorkOrder: async () => { throw new Error(text('请使用现场签到并上传照片。', 'Use field check-in with a photo.')); },
    submitFieldDayReport: (_id, dayId, report, key) => {
      const form = new FormData();
      for (const [name, value] of Object.entries(report)) {
        if (['progress_photos', 'internal_photos'].includes(name)) { for (const file of value) form.append(name, file); }
        else if (value !== undefined && value !== null) form.append(name, String(value));
      }
      return mutate(`field-days/${encodeURIComponent(dayId)}/report`, form, key);
    },
    requestFieldExtension: (_id, report) => mutate('extensions', report),
    searchMaterials: async ({ search }) => {
      const controller = new AbortController(), generation = epoch.current; controllers.current.add(controller);
      try {
        guard(); const data = await searchBusinessServiceMaterials(workOrderId, search, identity.id, snapshot.current.scope_version, controller.signal);
        guard(); if (generation !== epoch.current) throw new DOMException('View changed', 'AbortError'); return data;
      } catch (err) { fail(err); throw err; } finally { controllers.current.delete(controller); }
    },
    createMaterialRequest: data => mutate('material-requests', data),
  }), [mutate, workOrderId, identity, zh, guard, fail, text]);

  const caps = state?.capabilities || {}, can = key => !readOnly && caps[key] === true;
  const status = state?.work_order_status, workOrder = state?.work_order || {};
  const statusLabel = { pending_payment: text('等待申请开工', 'Ready to request start'), payment_review: text('等待开工审批', 'Awaiting start approval'),
    in_service: text('服务进行中', 'Service in progress'), resolved: text('等待客户验收', 'Awaiting customer acceptance'), completed: text('服务已验收', 'Service accepted') };
  const fieldDetail = useMemo(() => ({ ...state?.work_order, field_days: state?.field_days?.field_days || [],
    field_extension_requests: state?.extensions || state?.work_order?.field_extension_requests || [] }), [state]);
  return <section aria-label={text('商务服务执行', 'Business service execution')} className="mt-5 min-w-0 space-y-4 border-t border-[var(--color-border)] pt-5"
    style={{ '--color-text-primary': 'var(--color-text)', '--color-primary-hover': 'var(--color-primary-dark)', '--color-border-strong': 'var(--color-border)' }}>
    <header className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{text('商务服务执行', 'Business service execution')}</h3>
      <button type="button" className={button} disabled={loading || pending || blocked} onClick={() => { setError(''); refresh().then(() => setNotice('')).catch(() => {}); }}>{text('刷新服务状态', 'Refresh service')}</button></header>
    {error && <p role="alert" className="break-words text-sm text-amber-500">{error}</p>}
    {notice && <p role="status" className="break-words text-sm">{notice}</p>}
    {loading && <p role="status">{text('加载服务记录…', 'Loading service records…')}</p>}
    {state && !blocked && (state.execution ? <>
      <p role="status" className="border-l-4 border-[var(--color-primary)] pl-3 font-medium">{statusLabel[status] || status}</p>
      <p className="text-xs text-[var(--color-text-secondary)]">{text('仅实际指派的商务人员填写服务记录；Admin 保留开工审批。客户验收与尾款结清分开记录。', 'Only the assigned business executor records service work. Admin retains start approval. Customer acceptance and final payment are tracked separately.')}</p>
      {state.blocked_reason && <p className="text-sm text-amber-500">{{
        executor_inactive: text('执行人当前无有效权限，请联系 Admin 核对账号与辖区。', 'The executor has no current access. Ask Admin to review account and territory authorization.'),
        payment_required: text('开工前应付款尚未全部核验，请先处理收款。', 'Required pre-start payments have not all been verified.'),
        service_standard_required: text('请完成必需的服务标准确认后继续。', 'Complete the required service checklist before continuing.'),
      }[state.blocked_reason]}</p>}
      <fieldset disabled={pending || refreshRequired} className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-2">
          {can('can_request_start') && <button type="button" className={`${button} bg-[var(--color-primary)] text-black`} onClick={() => mutate('request-start').catch(() => {})}>{text('申请开工', 'Request start')}</button>}
          {can('can_approve_start') && identity?.role === 'admin' && <button type="button" className={`${button} bg-[var(--color-primary)] text-black`} onClick={() => mutate('approve-start').catch(() => {})}>{text('批准开工', 'Approve start')}</button>}
        </div>
        {(state.service_standard?.items || []).length > 0 && <details open={status !== 'in_service'}><summary className="cursor-pointer text-sm font-medium">{text('服务标准清单', 'Service standards checklist')}</summary>
          <ul className="mt-3 space-y-2">{state.service_standard.items.map(item => <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] py-2 text-sm">
            <span>{labels[item.key]?.[zh ? 0 : 1] || item.key}{item.required ? ' *' : ''}</span>
            {item.state === 'confirmed' ? <span className="text-[var(--color-success)]">{text('已确认', 'Confirmed')}</span>
              : ((item.owner === 'engineer' && can('can_confirm_execution_items')) || (item.owner === 'admin' && can('can_confirm_admin_items'))) ? <button type="button" className={button} onClick={() => mutate(`standard/items/${encodeURIComponent(item.key)}/confirm`, { state: 'confirmed' }).catch(() => {})}>{text('确认', 'Confirm')}</button>
                : <span className="text-[var(--color-text-muted)]">{text('待确认', 'Pending')}</span>}
          </li>)}</ul></details>}
        {workOrder.service_mode === 'onsite' && <FieldWorkPanel key={`field:${workOrderId}`} workOrderId={workOrderId} detail={fieldDetail} userType="admin" userId={identity?.id} canEdit={can('can_edit')} serviceApi={serviceApi} locale={runtimeConfig.locale} onChanged={refresh} />}
        {(can('can_edit') || state.repair_record) && <div className="min-w-0 border-t border-[var(--color-border)] pt-4">
          <RepairRecordPanel key={`report:${workOrderId}`} workOrderId={workOrderId} userType="admin" canEdit={can('can_edit')} readOnly={!can('can_edit')}
            repairRecord={state.repair_record} serviceApi={serviceApi} locale={runtimeConfig.locale} onSaved={refresh}
            canSubmitComplete={can('can_complete')} onConfirmComplete={() => window.confirm(text('提交最终报告给客户验收？此操作不会确认尾款到账。', 'Submit the final report for customer acceptance? This does not confirm final payment.'))}
            onSubmitComplete={() => mutate('complete')} />
        </div>}
        <div className="space-y-3 border-t border-[var(--color-border)] pt-4"><h4 className="text-sm font-medium">{text('服务沟通', 'Service messages')}</h4>
          <div className="max-h-64 space-y-2 overflow-y-auto">{(state.messages || []).map(row => <article key={row.id} className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
            <span className="text-xs text-[var(--color-text-muted)]">{row.is_internal_note ? text('内部记录 · 客户不可见', 'Internal · Not visible to customer') : text('客户可见', 'Customer visible')}</span><p className="whitespace-pre-wrap break-words">{row.content}</p></article>)}</div>
          {can('can_message') && <form className="space-y-2" onSubmit={event => { event.preventDefault(); if (message.trim()) mutate('messages', { content: message.trim(), is_internal_note: internal }).then(() => setMessage('')).catch(() => {}); }}>
            <label className="block text-sm">{text('消息内容', 'Message')}<textarea autoComplete="off" maxLength={5000} value={message} onChange={event => setMessage(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3" /></label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={internal} onChange={event => setInternal(event.target.checked)} />{text('仅内部可见', 'Internal only')}</label>
            <button className={button} type="submit" disabled={!message.trim()}>{text('发送消息', 'Send message')}</button>
          </form>}
        </div>
      </fieldset>
    </> : <p className="text-sm text-[var(--color-text-muted)]">{text('确认付款并指派实际执行人后，开放服务执行。', 'Service execution becomes available after payment verification and executor assignment.')}</p>)}
  </section>;
}
