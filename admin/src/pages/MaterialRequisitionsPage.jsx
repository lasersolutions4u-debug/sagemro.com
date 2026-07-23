import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, CircleX, ClipboardCheck, PackageCheck, PackageOpen, RefreshCw,
  RotateCcw, ShoppingCart, Truck, X,
} from 'lucide-react';
import { runtimeConfig } from '../config/runtime';
import {
  decideMaterialRequisition,
  cancelMaterialRequisitionItem,
  getMaterialRequisition,
  getMaterialRequisitions,
  postMaterialRequisitionQuantityAction,
  updateMaterialRequisitionProcurement,
} from '../services/api';
import {
  getRetryOperation,
  isRetryableActionError,
  retryOperationMatches,
  requisitionLabel,
} from './materialRequisitionOperations';

const ROLE_ACTIONS = {
  admin: ['approve', 'reject', 'cancel', 'close', 'cancel_item', 'allocate_stock', 'receive_purchase', 'issue', 'return', 'record_purchase', 'update_purchase'],
  operations: ['approve', 'reject', 'cancel', 'close', 'cancel_item'],
  warehouse: ['allocate_stock', 'receive_purchase', 'issue', 'return'],
  procurement: ['record_purchase', 'update_purchase', 'receive_purchase'],
};

const TEXT = {
  en: {
    title: 'Material requisitions',
    subtitle: 'Approve demand, resolve shortages, issue stock, and close fulfilled work-order requisitions.',
    refresh: 'Refresh', loading: 'Loading...', empty: 'No material requisitions match this view.',
    allStatuses: 'All statuses', number: 'Requisition', workOrder: 'Work order', urgency: 'Urgency',
    required: 'Required', status: 'Status', updated: 'Updated', purpose: 'Purpose', lines: 'Material lines',
    history: 'Workflow history', actionNote: 'Reason or note', quantity: 'Qty', supplier: 'Supplier / PO reference',
    arrival: 'Expected arrival', approve: 'Approve', reject: 'Reject', cancel: 'Cancel requisition', close: 'Close',
    cancel_item: 'Cancel line', pendingAction: 'Saving action...', noteRequired: 'Enter a reason or note before cancelling a line.',
    allocate_stock: 'Allocate', record_purchase: 'Order', update_purchase: 'Update purchase', receive_purchase: 'Receive purchase', issue: 'Issue', return: 'Return',
    requested: 'Requested', allocated: 'Allocated', ordered: 'Ordered', purchased: 'Purchased', issued: 'Issued', received: 'Engineer received',
    loadFailed: 'Could not load requisitions.', actionFailed: 'Action failed: ', closeDrawer: 'Close details',
    noHistory: 'No workflow events recorded.', current: 'Current status', freeForm: 'Free-form material',
  },
  'zh-CN': {
    title: '物料领用申请',
    subtitle: '集中处理工单物料审批、缺料采购、发料退库和履约关闭。',
    refresh: '刷新', loading: '加载中...', empty: '当前视图暂无物料领用申请。',
    allStatuses: '全部状态', number: '申请单', workOrder: '工单', urgency: '紧急程度',
    required: '需求日期', status: '状态', updated: '更新时间', purpose: '用途', lines: '物料明细',
    history: '流程记录', actionNote: '原因或备注', quantity: '数量', supplier: '供应商 / 采购单号',
    arrival: '预计到货', approve: '批准', reject: '驳回', cancel: '取消申请', close: '关闭申请',
    cancel_item: '取消明细', pendingAction: '正在保存操作...', noteRequired: '取消物料明细前请填写原因或备注。',
    allocate_stock: '分配库存', record_purchase: '记录采购', update_purchase: '更新采购信息', receive_purchase: '采购入库', issue: '发料', return: '退库',
    requested: '申请', allocated: '已分配', ordered: '已采购', purchased: '已到货', issued: '已发料', received: '工程师签收',
    loadFailed: '物料领用申请加载失败。', actionFailed: '操作失败：', closeDrawer: '关闭详情',
    noHistory: '暂无流程记录。', current: '当前状态', freeForm: '自由录入物料',
  },
};

const STATUS_KEYS = ['draft', 'submitted', 'approved', 'processing', 'partially_fulfilled', 'ready', 'issued', 'received', 'closed', 'rejected', 'cancelled'];
const TERMINAL = new Set(['closed', 'rejected', 'cancelled']);

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(runtimeConfig.locale, { dateStyle: 'medium', timeStyle: 'short' });
}

function statusTone(status) {
  if (['closed', 'received'].includes(status)) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (['rejected', 'cancelled'].includes(status)) return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (['submitted', 'approved', 'ready'].includes(status)) return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
}

function canClose(requisition) {
  return requisition.items?.length > 0 && requisition.items.every((item) => ['received', 'cancelled'].includes(item.status));
}

function buildLineInputs(items = [], current = {}) {
  return Object.fromEntries(items.map((item) => [item.id, {
    quantity: current[item.id]?.quantity || '1',
    supplier_reference: item.supplier_reference || '',
    expected_arrival: item.expected_arrival || '',
  }]));
}

function actionAvailable(requisition, item, action) {
  if (action === 'approve' || action === 'reject') return requisition.status === 'submitted';
  if (action === 'close') return !TERMINAL.has(requisition.status) && canClose(requisition);
  if (action === 'cancel') {
    return !TERMINAL.has(requisition.status)
      && requisition.items.every((line) => Number(line.issued_quantity || 0) === 0 && Number(line.engineer_received_quantity || 0) === 0);
  }
  if (action === 'cancel_item') {
    return !TERMINAL.has(requisition.status) && Boolean(item) && item.status !== 'cancelled'
      && Number(item.issued_quantity || 0) === 0
      && Number(item.engineer_received_quantity || 0) === 0;
  }
  if (!item || item.status === 'cancelled' || !['approved', 'processing', 'partially_fulfilled', 'ready', 'issued'].includes(requisition.status)) return false;
  const requested = Number(item.requested_quantity || 0);
  const allocated = Number(item.stock_allocated_quantity || 0);
  const ordered = Number(item.procurement_ordered_quantity || 0);
  const purchased = Number(item.procurement_received_quantity || 0);
  const issued = Number(item.issued_quantity || 0);
  const received = Number(item.engineer_received_quantity || 0);
  if (action === 'allocate_stock') return Boolean(item.material_id) && allocated + ordered < requested;
  if (action === 'record_purchase') return allocated + ordered < requested;
  if (action === 'update_purchase') return ordered > 0;
  if (action === 'receive_purchase') return purchased < ordered;
  if (action === 'issue') return issued < allocated + purchased;
  if (action === 'return') return issued > received;
  return false;
}

export function MaterialRequisitionsPage({ staffRole = 'admin' }) {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const [requisitions, setRequisitions] = useState([]);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [lineInputs, setLineInputs] = useState({});
  const [pendingActions, setPendingActions] = useState(new Set());
  const [retryOperations, setRetryOperations] = useState({});
  const pendingActionKeys = useRef(new Set());
  const drawerTriggerRef = useRef(null);
  const drawerCloseRef = useRef(null);
  const drawerPending = pendingActions.size > 0;

  const allowedActions = ROLE_ACTIONS[staffRole] || [];
  const filtered = useMemo(() => (
    status === 'all' ? requisitions : requisitions.filter((item) => item.status === status)
  ), [requisitions, status]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMaterialRequisitions();
      setRequisitions(data.requisitions || []);
    } catch (err) {
      setError(err.message || t.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (requisition, trigger) => {
    drawerTriggerRef.current = trigger;
    setError('');
    try {
      const data = await getMaterialRequisition(requisition.id);
      setSelectedRequisition(data.requisition);
      setLineInputs(buildLineInputs(data.requisition.items));
      setNote('');
    } catch (err) {
      setError(err.message || t.loadFailed);
    }
  };

  const closeDetail = () => {
    if (drawerPending) return;
    setSelectedRequisition(null);
    requestAnimationFrame(() => drawerTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!selectedRequisition) return undefined;
    drawerCloseRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeDetail();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedRequisition, drawerPending]);

  const applyUpdatedRequisition = (updated) => {
    setSelectedRequisition((current) => ({ ...updated, history: updated.history || current?.history || [] }));
    setLineInputs((current) => buildLineInputs(updated.items, current));
    setRequisitions((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
  };

  const runAction = async (key, operation, { onSuccess, onError } = {}) => {
    if (pendingActionKeys.current.size > 0) return;
    pendingActionKeys.current.add(key);
    setPendingActions((current) => new Set(current).add(key));
    setError('');
    try {
      const data = await operation();
      applyUpdatedRequisition(data.requisition);
      onSuccess?.();
    } catch (err) {
      onError?.(err);
      setError(`${t.actionFailed}${err.message}`);
    } finally {
      pendingActionKeys.current.delete(key);
      setPendingActions((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const handleDecision = (action) => runAction(
    `header:${action}`,
    () => decideMaterialRequisition(selectedRequisition.id, action, note),
  );

  const inputFor = (itemId) => lineInputs[itemId] || { quantity: '1', supplier_reference: '', expected_arrival: '' };
  const setInput = (itemId, field, value) => {
    const nextInput = { ...inputFor(itemId), [field]: value };
    setLineInputs((current) => ({ ...current, [itemId]: nextInput }));
    setRetryOperations((current) => {
      if (!current[itemId]) return current;
      const nextPayload = {
        item_id: itemId,
        quantity: Number(nextInput.quantity),
        ...(current[itemId].action === 'record_purchase' ? {
          supplier_reference: nextInput.supplier_reference,
          expected_arrival: nextInput.expected_arrival,
        } : {}),
      };
      if (retryOperationMatches(current[itemId], current[itemId].action, nextPayload)) return current;
      const nextRetryOperations = { ...current };
      delete nextRetryOperations[itemId];
      return nextRetryOperations;
    });
  };

  const handleLineAction = (item, action) => {
    if (pendingActionKeys.current.size > 0) return;
    const input = inputFor(item.id);
    if (action === 'cancel_item') {
      if (!note.trim()) {
        setError(t.noteRequired);
        return undefined;
      }
      return runAction(
        `${item.id}:${action}`,
        () => cancelMaterialRequisitionItem(selectedRequisition.id, item.id, note),
      );
    }
    if (action === 'update_purchase') {
      return runAction(
        `${item.id}:${action}`,
        () => updateMaterialRequisitionProcurement(selectedRequisition.id, {
          item_id: item.id,
          supplier_reference: input.supplier_reference,
          expected_arrival: input.expected_arrival,
        }),
      );
    }
    const payload = { item_id: item.id, quantity: Number(input.quantity) };
    if (action === 'record_purchase') {
      payload.supplier_reference = input.supplier_reference;
      payload.expected_arrival = input.expected_arrival;
    }
    const retryOperation = getRetryOperation(retryOperations[item.id], action, payload);
    setRetryOperations((current) => ({ ...current, [item.id]: retryOperation }));
    const clearRetryOperation = () => setRetryOperations((current) => {
      if (current[item.id]?.idempotencyKey !== retryOperation.idempotencyKey) return current;
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    return runAction(
      `${item.id}:${action}`,
      () => postMaterialRequisitionQuantityAction(
        selectedRequisition.id, action, payload, retryOperation.idempotencyKey,
      ),
      {
        onSuccess: clearRetryOperation,
        onError: (err) => { if (!isRetryableActionError(err)) clearRetryOperation(); },
      },
    );
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
            <option value="all">{t.allStatuses}</option>
            {STATUS_KEYS.map((key) => <option key={key} value={key}>{requisitionLabel(runtimeConfig.locale, 'status', key)}</option>)}
          </select>
          <button type="button" onClick={load} className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm hover:border-[var(--color-primary)]">
            <RefreshCw size={15} />{t.refresh}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      <div className="overflow-x-auto border-y border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-secondary)]">
            <tr>
              {[t.number, t.workOrder, t.urgency, t.required, t.status, t.updated].map((label) => <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="px-3 py-10 text-center text-[var(--color-text-muted)]">{t.loading}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="6" className="px-3 py-10 text-center text-[var(--color-text-muted)]">{t.empty}</td></tr>
            ) : filtered.map((requisition) => (
              <tr key={requisition.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]/70">
                <td className="px-3 py-2.5 font-medium"><button type="button" onClick={(event) => openDetail(requisition, event.currentTarget)} className="text-[var(--color-primary)] hover:underline">{requisition.requisition_no}</button></td>
                <td className="px-3 py-2.5">{requisition.work_order_id}</td>
                <td className="px-3 py-2.5">{requisitionLabel(runtimeConfig.locale, 'urgency', requisition.urgency)}</td>
                <td className="px-3 py-2.5">{requisition.required_date || '-'}</td>
                <td className="px-3 py-2.5"><span className={`inline-flex whitespace-nowrap rounded border px-2 py-1 text-xs ${statusTone(requisition.status)}`}>{requisitionLabel(runtimeConfig.locale, 'status', requisition.status)}</span></td>
                <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{formatDate(requisition.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRequisition && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true" onMouseDown={(event) => { if (!drawerPending && event.target === event.currentTarget) closeDetail(); }}>
          <section aria-busy={drawerPending} className="flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{selectedRequisition.requisition_no}</h3>
                  <span className={`inline-flex whitespace-nowrap rounded border px-2 py-1 text-xs ${statusTone(selectedRequisition.status)}`}>{requisitionLabel(runtimeConfig.locale, 'status', selectedRequisition.status)}</span>
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">{t.workOrder}: {selectedRequisition.work_order_id} · {t.required}: {selectedRequisition.required_date || '-'}</div>
              </div>
              <button ref={drawerCloseRef} type="button" title={t.closeDrawer} disabled={drawerPending} onClick={closeDetail} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] disabled:opacity-50"><X size={18} /></button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <dl className="mb-5 grid gap-x-6 gap-y-2 border-b border-[var(--color-border)] pb-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-[var(--color-text-muted)]">{t.purpose}</dt><dd className="mt-1">{selectedRequisition.purpose || '-'}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-muted)]">{t.current}</dt><dd className="mt-1">{requisitionLabel(runtimeConfig.locale, 'status', selectedRequisition.status)}</dd></div>
              </dl>

              <div className="mb-4 flex flex-col gap-2 border-b border-[var(--color-border)] pb-4 sm:flex-row sm:items-center">
                <input value={note} disabled={drawerPending} onChange={(event) => setNote(event.target.value)} placeholder={t.actionNote} className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] disabled:opacity-50" />
                <div className="flex flex-wrap gap-2">
                  {allowedActions.filter((action) => ['approve', 'reject', 'cancel', 'close'].includes(action) && actionAvailable(selectedRequisition, null, action)).map((action) => {
                    const Icon = action === 'approve' ? Check : action === 'reject' ? CircleX : action === 'close' ? ClipboardCheck : X;
                    return <button key={action} type="button" disabled={drawerPending} onClick={() => handleDecision(action)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs hover:border-[var(--color-primary)] disabled:opacity-50"><Icon size={14} />{t[action]}</button>;
                  })}
                </div>
              </div>
              {drawerPending && <div className="mb-4 text-xs font-medium text-[var(--color-primary)]" role="status">{t.pendingAction}</div>}

              <h4 className="mb-2 text-sm font-semibold">{t.lines}</h4>
              <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
                {selectedRequisition.items?.map((item) => {
                  const input = inputFor(item.id);
                  const lineActions = allowedActions.filter((action) => ['allocate_stock', 'record_purchase', 'update_purchase', 'receive_purchase', 'issue', 'return', 'cancel_item'].includes(action) && actionAvailable(selectedRequisition, item, action));
                  const showsPurchaseFields = lineActions.some((action) => ['record_purchase', 'update_purchase'].includes(action));
                  return (
                    <div key={item.id} className="py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="font-medium">{item.name_en && runtimeConfig.locale === 'en' ? item.name_en : item.name}</div>
                          <div className="mt-1 text-xs text-[var(--color-text-muted)]">{item.material_code || t.freeForm} · {[item.spec, item.brand, item.unit].filter(Boolean).join(' · ')}</div>
                        </div>
                        <span className={`self-start whitespace-nowrap rounded border px-2 py-1 text-xs ${statusTone(item.status)}`}>{requisitionLabel(runtimeConfig.locale, 'status', item.status)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                        {[
                          [t.requested, item.requested_quantity], [t.allocated, item.stock_allocated_quantity], [t.ordered, item.procurement_ordered_quantity],
                          [t.purchased, item.procurement_received_quantity], [t.issued, item.issued_quantity], [t.received, item.engineer_received_quantity],
                        ].map(([label, value]) => <div key={label}><span className="text-[var(--color-text-muted)]">{label}</span><div className="mt-0.5 font-medium">{Number(value || 0)}</div></div>)}
                      </div>
                      {lineActions.length > 0 && (
                        <div className="mt-3 grid gap-2 md:grid-cols-[90px_minmax(0,1fr)_150px_auto]">
                          <input type="number" min="1" step="1" value={input.quantity} disabled={drawerPending} onChange={(event) => setInput(item.id, 'quantity', event.target.value)} aria-label={t.quantity} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm disabled:opacity-50" />
                          {showsPurchaseFields ? <input value={input.supplier_reference} disabled={drawerPending} onChange={(event) => setInput(item.id, 'supplier_reference', event.target.value)} placeholder={t.supplier} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm disabled:opacity-50" /> : <div />}
                          {showsPurchaseFields ? <input type="date" value={input.expected_arrival} disabled={drawerPending} onChange={(event) => setInput(item.id, 'expected_arrival', event.target.value)} aria-label={t.arrival} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm disabled:opacity-50" /> : <div />}
                          <div className="flex flex-wrap justify-end gap-2">
                            {lineActions.map((action) => {
                              const Icon = action === 'allocate_stock' ? PackageOpen : ['record_purchase', 'update_purchase'].includes(action) ? ShoppingCart : action === 'receive_purchase' ? PackageCheck : action === 'issue' ? Truck : action === 'cancel_item' ? CircleX : RotateCcw;
                              return <button key={action} type="button" disabled={drawerPending} onClick={() => handleLineAction(item, action)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-2.5 py-2 text-xs hover:border-[var(--color-primary)] disabled:opacity-50"><Icon size={14} />{t[action]}</button>;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <h4 className="mb-2 mt-5 text-sm font-semibold">{t.history}</h4>
              <div className="border-l border-[var(--color-border)] pl-4">
                {selectedRequisition.history?.length ? selectedRequisition.history.map((entry, index) => {
                  const actor = requisitionLabel(runtimeConfig.locale, 'actor', entry.actor_type);
                  return <div key={`${entry.action}-${entry.created_at}-${index}`} className="relative pb-4 text-sm before:absolute before:-left-[19px] before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-[var(--color-primary)]"><div className="font-medium">{requisitionLabel(runtimeConfig.locale, 'action', entry.action)}</div><div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{actor} · {formatDate(entry.created_at)}{entry.status ? ` · ${requisitionLabel(runtimeConfig.locale, 'status', entry.status)}` : ''}</div></div>;
                }) : <div className="pb-2 text-sm text-[var(--color-text-muted)]">{t.noHistory}</div>}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
