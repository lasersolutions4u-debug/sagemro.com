import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Loader2,
  PackageCheck,
  PackagePlus,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  confirmMaterialRequisitionReceipt,
  createMaterialRequisition,
  getMaterialRequisition,
  getMaterialRequisitions,
  getWorkOrderMaterialItems,
  submitMaterialRequisition,
} from '../../services/api';
import { confirmDialog, toastSuccess } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';
import { formatMaterialRequisitionDate } from './materialRequisitionFormat';
import {
  getMaterialRequisitionRetryOperation,
  shouldPreserveReceiptRetryKey,
} from './materialRequisitionRetry';

const COPY = {
  en: {
    title: 'Material requisition',
    subtitle: 'Request parts for this work order and track fulfillment through engineer receipt.',
    newDraft: 'New draft',
    quotePrefill: 'Import quote materials',
    prefill: 'Copy preparation lines',
    addLine: 'Add line',
    createDraft: 'Create draft',
    creating: 'Creating draft...',
    name: 'Material name',
    spec: 'Specification',
    unit: 'Unit',
    quantity: 'Quantity',
    notes: 'Notes',
    remove: 'Remove line',
    noPreparation: 'No preparation material lines are available to copy.',
    noQuote: 'No quote material lines are available to import.',
    draftError: 'Add at least one line with a material name and a positive integer quantity.',
    listTitle: 'Current requisitions',
    empty: 'No requisitions have been created for this work order.',
    loading: 'Loading material requisitions...',
    loadFailed: 'Could not load material requisitions.',
    retry: 'Retry',
    open: 'Open requisition',
    close: 'Close details',
    detailLoading: 'Loading requisition progress...',
    detailFailed: 'Could not load requisition details.',
    purpose: 'Purpose',
    required: 'Required date',
    status: 'Status',
    requested: 'Requested',
    allocated: 'Allocated',
    ordered: 'Ordered',
    purchased: 'Purchased',
    issued: 'Issued',
    received: 'Engineer received',
    arrival: 'Expected arrival',
    submitDraft: 'Submit draft',
    submitting: 'Submitting...',
    submitConfirm: 'Submit this material requisition for operations approval?',
    confirmReceipt: 'Confirm receipt',
    receiving: 'Confirming...',
    receiptQuantity: 'Receipt quantity',
    created: 'Draft created. Review it before submitting.',
    submitted: 'Material requisition submitted.',
    receiptConfirmed: 'Receipt confirmed.',
    freeForm: 'Manual entry',
  },
  cn: {
    title: '物料领用申请',
    subtitle: '为当前工单申请所需物料，并跟踪至工程师签收。',
    newDraft: '新建草稿',
    quotePrefill: '导入报价物料',
    prefill: '复制准备物料',
    addLine: '添加明细',
    createDraft: '创建草稿',
    creating: '正在创建草稿...',
    name: '物料名称',
    spec: '规格',
    unit: '单位',
    quantity: '数量',
    notes: '备注',
    remove: '移除明细',
    noPreparation: '当前工单没有可复制的准备物料。',
    noQuote: '当前报价没有可导入的物料明细。',
    draftError: '请至少添加一条物料名称完整、数量为正整数的明细。',
    listTitle: '当前申请单',
    empty: '当前工单还没有物料领用申请。',
    loading: '正在加载物料领用申请...',
    loadFailed: '物料领用申请加载失败。',
    retry: '重试',
    open: '打开申请单',
    close: '关闭详情',
    detailLoading: '正在加载申请进度...',
    detailFailed: '申请单详情加载失败。',
    purpose: '用途',
    required: '需求日期',
    status: '状态',
    requested: '申请数量',
    allocated: '已分配',
    ordered: '已采购',
    purchased: '已到货',
    issued: '已发料',
    received: '工程师签收',
    arrival: '预计到货',
    submitDraft: '提交草稿',
    submitting: '正在提交...',
    submitConfirm: '确认提交此物料领用申请，进入运营审批流程？',
    confirmReceipt: '确认签收',
    receiving: '正在确认...',
    receiptQuantity: '本次签收数量',
    created: '草稿已创建，请核对后提交。',
    submitted: '物料领用申请已提交。',
    receiptConfirmed: '签收已确认。',
    freeForm: '手工录入',
  },
};

const STATUS_LABELS = {
  draft: ['Draft', '草稿'],
  submitted: ['Submitted', '已提交'],
  approved: ['Approved', '已批准'],
  processing: ['Processing', '处理中'],
  partially_fulfilled: ['Partially fulfilled', '部分齐料'],
  ready: ['Ready', '待发料'],
  issued: ['Issued', '已发料'],
  received: ['Received', '已签收'],
  closed: ['Closed', '已关闭'],
  rejected: ['Rejected', '已驳回'],
  cancelled: ['Cancelled', '已取消'],
  pending: ['Pending', '待处理'],
  stock_allocated: ['Stock allocated', '库存已分配'],
  purchasing: ['Purchasing', '采购中'],
  partially_ready: ['Partially ready', '部分到货'],
};

function emptyDraftLine() {
  return {
    material_id: null,
    material_code: '',
    name: '',
    name_en: '',
    spec: '',
    brand: '',
    unit: 'pcs',
    requested_quantity: '1',
    notes: '',
  };
}

function mapMaterialItemsToDraft(items) {
  return items.map((item) => ({
    material_id: item.material_id || null,
    material_code: item.material_code || '',
    name: item.name || '',
    name_en: item.name_en || '',
    spec: item.spec || '',
    brand: item.brand || '',
    unit: item.unit || 'pcs',
    requested_quantity: String(item.quantity || 1),
    notes: item.note || '',
  }));
}

function operationKey(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function statusLabel(status, isCn) {
  const label = STATUS_LABELS[status];
  return label ? label[isCn ? 1 : 0] : (status || '-');
}

function statusTone(status) {
  if (['closed', 'received'].includes(status)) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600';
  if (['rejected', 'cancelled'].includes(status)) return 'border-red-500/30 bg-red-500/10 text-red-600';
  if (['submitted', 'approved', 'ready', 'issued'].includes(status)) return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
  return 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]';
}

export function MaterialRequisitionPanel({ workOrderId, onBusyChange }) {
  const isCn = isCnLocale();
  const t = isCn ? COPY.cn : COPY.en;
  const [requisitions, setRequisitions] = useState([]);
  const [quoteItems, setQuoteItems] = useState([]);
  const [preparationItems, setPreparationItems] = useState([]);
  const [draftItems, setDraftItems] = useState([emptyDraftLine()]);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [receiptQuantities, setReceiptQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingReceiptId, setPendingReceiptId] = useState('');
  const draftRetryRef = useRef(null);
  const draftInFlightRef = useRef(null);
  const receiptRetryRef = useRef({});
  const receiptInFlightRef = useRef(null);
  const detailRequestIdRef = useRef(0);
  const autoPrefillWorkOrderRef = useRef('');
  const panelBusy = creating || submitting || Boolean(pendingReceiptId);

  const workOrderRequisitions = useMemo(
    () => requisitions.filter((item) => item.work_order_id === workOrderId),
    [requisitions, workOrderId],
  );

  const loadPanel = useCallback(async () => {
    setLoading(true);
    setError('');
    const [requisitionResult, quoteResult, preparationResult] = await Promise.allSettled([
      getMaterialRequisitions(workOrderId),
      getWorkOrderMaterialItems(workOrderId, 'quote'),
      getWorkOrderMaterialItems(workOrderId, 'preparation'),
    ]);
    let nextRequisitions = [];
    if (requisitionResult.status === 'rejected') {
      setRequisitions([]);
      setError(requisitionResult.reason?.message || t.loadFailed);
    } else {
      nextRequisitions = requisitionResult.value.requisitions || [];
      setRequisitions(nextRequisitions);
    }
    if (quoteResult.status === 'fulfilled') {
      const nextQuoteItems = quoteResult.value.list || [];
      const quoteDraftItems = mapMaterialItemsToDraft(quoteResult.value.list || []);
      setQuoteItems(nextQuoteItems);
      if (requisitionResult.status === 'fulfilled'
        && !nextRequisitions.length
        && quoteDraftItems.length
        && autoPrefillWorkOrderRef.current !== workOrderId) {
        autoPrefillWorkOrderRef.current = workOrderId;
        setDraftItems(quoteDraftItems);
      }
    } else {
      setQuoteItems([]);
    }
    if (preparationResult.status === 'fulfilled') {
      setPreparationItems(preparationResult.value.list || []);
    } else {
      setPreparationItems([]);
    }
    setLoading(false);
  }, [t.loadFailed, workOrderId]);

  useEffect(() => {
    loadPanel();
    return () => {
      detailRequestIdRef.current += 1;
    };
  }, [loadPanel]);

  useEffect(() => {
    onBusyChange?.(panelBusy);
  }, [onBusyChange, panelBusy]);

  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const clearDraftRetry = () => {
    if (creating || draftInFlightRef.current) return;
    draftRetryRef.current = null;
  };

  const updateDraftItem = (index, field, value) => {
    if (creating || draftInFlightRef.current) return;
    clearDraftRetry();
    setDraftItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const addDraftItem = () => {
    if (creating || draftInFlightRef.current) return;
    clearDraftRetry();
    setDraftItems((current) => [...current, emptyDraftLine()]);
  };

  const removeDraftItem = (index) => {
    if (creating || draftInFlightRef.current) return;
    clearDraftRetry();
    setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const copyPreparationItems = () => {
    if (creating || draftInFlightRef.current) return;
    if (!preparationItems.length) {
      setError(t.noPreparation);
      return;
    }
    clearDraftRetry();
    setDraftItems(mapMaterialItemsToDraft(preparationItems));
    setError('');
  };

  const copyQuoteItems = () => {
    if (creating || draftInFlightRef.current) return;
    if (!quoteItems.length) {
      setError(t.noQuote);
      return;
    }
    clearDraftRetry();
    setDraftItems(mapMaterialItemsToDraft(quoteItems));
    setError('');
  };

  const validDraftItem = (item) => {
    const quantity = Number(item.requested_quantity);
    return Boolean(item.name.trim()) && Number.isInteger(quantity) && quantity > 0;
  };

  const applyRequisitionUpdate = (updated) => {
    setSelectedRequisition(updated);
    setRequisitions((current) => current.map((item) => (
      item.id === updated.id ? { ...item, ...updated } : item
    )));
    setReceiptQuantities(Object.fromEntries((updated.items || []).map((item) => [
      item.id,
      String(Math.max(0, Number(item.issued_quantity || 0) - Number(item.engineer_received_quantity || 0))),
    ])));
  };

  const createDraft = async () => {
    if (draftInFlightRef.current) return;
    if (!draftItems.length || !draftItems.every(validDraftItem)) {
      setError(t.draftError);
      return;
    }
    const payload = {
      work_order_id: workOrderId,
      items: draftItems.map((item) => ({
        material_id: item.material_id || undefined,
        material_code: item.material_code.trim() || undefined,
        name: item.name.trim(),
        name_en: item.name_en.trim() || undefined,
        spec: item.spec.trim() || undefined,
        brand: item.brand.trim() || undefined,
        unit: item.unit.trim() || 'pcs',
        requested_quantity: Number(item.requested_quantity),
        notes: item.notes.trim() || undefined,
      })),
    };
    const fingerprint = JSON.stringify(payload);
    const draftRetry = draftRetryRef.current;
    const operation = draftRetry?.fingerprint === fingerprint
      ? draftRetry
      : getMaterialRequisitionRetryOperation(null, payload, () => operationKey('engineer-draft'));
    const draftRequest = { payload, key: operation.key };
    draftRetryRef.current = operation;
    draftInFlightRef.current = draftRequest;
    onBusyChange?.(true);
    setCreating(true);
    setError('');
    try {
      const data = await createMaterialRequisition(draftRequest.payload, draftRequest.key);
      draftRetryRef.current = null;
      setRequisitions((current) => [data.requisition, ...current]);
      applyRequisitionUpdate(data.requisition);
      setDraftItems([emptyDraftLine()]);
      toastSuccess(t.created);
    } catch (createError) {
      if (!shouldPreserveReceiptRetryKey(createError)) draftRetryRef.current = null;
      setError(createError.message || t.draftError);
    } finally {
      if (draftInFlightRef.current === draftRequest) draftInFlightRef.current = null;
      setCreating(false);
    }
  };

  const openRequisition = async (requisition) => {
    const requestId = ++detailRequestIdRef.current;
    setDetailLoading(true);
    setDetailError('');
    try {
      const data = await getMaterialRequisition(requisition.id);
      if (requestId !== detailRequestIdRef.current) return;
      applyRequisitionUpdate(data.requisition);
    } catch (openError) {
      if (requestId !== detailRequestIdRef.current) return;
      setDetailError(openError.message || t.detailFailed);
    } finally {
      if (requestId === detailRequestIdRef.current) setDetailLoading(false);
    }
  };

  const closeRequisitionDetails = () => {
    detailRequestIdRef.current += 1;
    setDetailLoading(false);
    setSelectedRequisition(null);
    setDetailError('');
  };

  const submitDraft = async () => {
    if (!selectedRequisition || !(await confirmDialog(t.submitConfirm, {
      title: t.submitDraft,
      confirmText: t.submitDraft,
    }))) return;
    onBusyChange?.(true);
    setSubmitting(true);
    setDetailError('');
    try {
      const data = await submitMaterialRequisition(selectedRequisition.id);
      applyRequisitionUpdate(data.requisition);
      toastSuccess(t.submitted);
    } catch (submitError) {
      setDetailError(submitError.message || t.detailFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const updateReceiptQuantity = (item, value) => {
    if (receiptInFlightRef.current?.itemId === item.id) return;
    setReceiptQuantities((current) => ({ ...current, [item.id]: value }));
    delete receiptRetryRef.current[item.id];
  };

  const confirmReceipt = async (item) => {
    if (receiptInFlightRef.current) return;
    const quantity = Number(receiptQuantities[item.id]);
    const remaining = Number(item.issued_quantity || 0) - Number(item.engineer_received_quantity || 0);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > remaining) return;
    const payload = { item_id: item.id, quantity };
    const retryOperation = receiptRetryRef.current[item.id];
    const operation = getMaterialRequisitionRetryOperation(
      retryOperation,
      payload,
      () => operationKey('engineer-receipt'),
    );
    const receiptRequest = { itemId: item.id, payload, key: operation.key };
    receiptRetryRef.current[item.id] = operation;
    receiptInFlightRef.current = receiptRequest;
    onBusyChange?.(true);
    setPendingReceiptId(item.id);
    setDetailError('');
    try {
      const data = await confirmMaterialRequisitionReceipt(
        selectedRequisition.id,
        receiptRequest.payload,
        receiptRequest.key,
      );
      delete receiptRetryRef.current[item.id];
      applyRequisitionUpdate(data.requisition);
      toastSuccess(t.receiptConfirmed);
    } catch (error) {
      if (!shouldPreserveReceiptRetryKey(error)) {
        delete receiptRetryRef.current[item.id];
      }
      setDetailError(error.message || t.detailFailed);
    } finally {
      if (receiptInFlightRef.current === receiptRequest) receiptInFlightRef.current = null;
      setPendingReceiptId('');
    }
  };

  const renderDraft = () => (
    <section className="space-y-3" aria-labelledby="material-requisition-draft-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 id="material-requisition-draft-title" className="text-sm font-semibold text-[var(--color-text-primary)]">{t.newDraft}</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={copyQuoteItems}
            disabled={creating || !quoteItems.length}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-primary)]/40 px-3 py-2 text-sm text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-50"
          >
            <PackagePlus size={16} />
            {t.quotePrefill}
          </button>
          <button
            type="button"
            onClick={copyPreparationItems}
            disabled={creating || !preparationItems.length}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
          >
            <ClipboardList size={16} />
            {t.prefill}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {draftItems.map((item, index) => (
          <div key={`draft-${index}`} className="grid gap-2 border-b border-[var(--color-border)] pb-3 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_80px_88px_36px]">
            <input
              value={item.name}
              onChange={(event) => updateDraftItem(index, 'name', event.target.value)}
              disabled={creating}
              placeholder={t.name}
              aria-label={t.name}
              className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            />
            <input
              value={item.spec}
              onChange={(event) => updateDraftItem(index, 'spec', event.target.value)}
              disabled={creating}
              placeholder={t.spec}
              aria-label={t.spec}
              className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            />
            <input
              value={item.unit}
              onChange={(event) => updateDraftItem(index, 'unit', event.target.value)}
              disabled={creating}
              placeholder={t.unit}
              aria-label={t.unit}
              className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            />
            <input
              type="number"
              min="1"
              step="1"
              value={item.requested_quantity}
              onChange={(event) => updateDraftItem(index, 'requested_quantity', event.target.value)}
              disabled={creating}
              aria-label={t.quantity}
              className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            />
            <button
              type="button"
              onClick={() => removeDraftItem(index)}
              disabled={creating}
              aria-label={t.remove}
              title={t.remove}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 size={16} />
            </button>
            <input
              value={item.notes}
              onChange={(event) => updateDraftItem(index, 'notes', event.target.value)}
              disabled={creating}
              placeholder={t.notes}
              aria-label={t.notes}
              className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 md:col-span-4"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={addDraftItem}
          disabled={creating}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
        >
          <Plus size={16} />
          {t.addLine}
        </button>
        <button
          type="button"
          onClick={createDraft}
          disabled={creating}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}
          {creating ? t.creating : t.createDraft}
        </button>
      </div>
    </section>
  );

  const renderProgressItem = (item) => {
    const canReceive = Number(item.issued_quantity || 0) > Number(item.engineer_received_quantity || 0);
    const remaining = Number(item.issued_quantity || 0) - Number(item.engineer_received_quantity || 0);
    const receiptQuantity = receiptQuantities[item.id] ?? String(remaining);
    const receiptValid = Number.isInteger(Number(receiptQuantity))
      && Number(receiptQuantity) > 0
      && Number(receiptQuantity) <= remaining;
    const progress = [
      [t.requested, item.requested_quantity],
      [t.allocated, item.stock_allocated_quantity],
      [t.ordered, item.procurement_ordered_quantity],
      [t.purchased, item.procurement_received_quantity],
      [t.issued, item.issued_quantity],
      [t.received, item.engineer_received_quantity],
    ];

    return (
      <div key={item.id} className="space-y-3 border-b border-[var(--color-border)] py-4 last:border-b-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="font-medium text-[var(--color-text-primary)]">{isCn ? item.name : (item.name_en || item.name)}</div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">
              {[item.material_code, item.spec, item.brand].filter(Boolean).join(' · ') || t.freeForm}
            </div>
          </div>
          <span className={`w-fit shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(item.status)}`}>
            {statusLabel(item.status, isCn)}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 lg:grid-cols-8">
          {progress.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] text-[var(--color-text-muted)]">{label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-[var(--color-text-primary)]">{Number(value || 0)} {item.unit || 'pcs'}</dd>
            </div>
          ))}
          <div className="min-w-0">
            <dt className="text-[11px] text-[var(--color-text-muted)]">{t.arrival}</dt>
            <dd className="mt-0.5 text-sm text-[var(--color-text-primary)]">{formatMaterialRequisitionDate(item.expected_arrival, isCn)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] text-[var(--color-text-muted)]">{t.status}</dt>
            <dd className="mt-0.5 text-sm text-[var(--color-text-primary)]">{statusLabel(item.status, isCn)}</dd>
          </div>
        </dl>

        {canReceive && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-end">
            <label className="block sm:w-40">
              <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.receiptQuantity}</span>
              <input
                type="number"
                min="1"
                max={remaining}
                step="1"
                value={receiptQuantity}
                onChange={(event) => updateReceiptQuantity(item, event.target.value)}
                disabled={pendingReceiptId === item.id}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
              />
            </label>
            <button
              type="button"
              onClick={() => confirmReceipt(item)}
              disabled={!receiptValid || Boolean(pendingReceiptId)}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {pendingReceiptId === item.id ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
              {pendingReceiptId === item.id ? t.receiving : t.confirmReceipt}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
          <ClipboardList size={18} className="text-[var(--color-primary)]" />
          {t.title}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.subtitle}</p>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-2 border-l-2 border-red-500 bg-red-500/5 px-3 py-2 text-sm text-red-600 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadPanel} className="inline-flex items-center gap-1 whitespace-nowrap font-medium">
            <RefreshCw size={14} /> {t.retry}
          </button>
        </div>
      )}

      {renderDraft()}

      <section className="space-y-3" aria-labelledby="material-requisition-list-title">
        <h3 id="material-requisition-list-title" className="text-sm font-semibold text-[var(--color-text-primary)]">{t.listTitle}</h3>
        {loading ? (
          <div className="flex items-center gap-2 py-5 text-sm text-[var(--color-text-muted)]">
            <Loader2 size={16} className="animate-spin" /> {t.loading}
          </div>
        ) : workOrderRequisitions.length === 0 ? (
          <div className="border-y border-dashed border-[var(--color-border)] py-5 text-sm text-[var(--color-text-muted)]">{t.empty}</div>
        ) : (
          <div className="overflow-hidden border-y border-[var(--color-border)]">
            {workOrderRequisitions.map((requisition) => (
              <button
                type="button"
                key={requisition.id}
                onClick={() => openRequisition(requisition)}
                aria-label={`${t.open} ${requisition.requisition_no}`}
                className="flex w-full items-center justify-between gap-3 border-b border-[var(--color-border)] px-1 py-3 text-left last:border-b-0 hover:bg-[var(--color-surface-elevated)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--color-text-primary)]">{requisition.requisition_no}</span>
                  <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{formatMaterialRequisitionDate(requisition.created_at, isCn)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(requisition.status)}`}>
                    {statusLabel(requisition.status, isCn)}
                  </span>
                  <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {(detailLoading || selectedRequisition || detailError) && (
        <section className="space-y-3 border-t border-[var(--color-border)] pt-4" aria-live="polite">
          {detailLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-[var(--color-text-muted)]">
              <Loader2 size={16} className="animate-spin" /> {t.detailLoading}
            </div>
          ) : selectedRequisition ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[var(--color-text-primary)]">{selectedRequisition.requisition_no}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    {selectedRequisition.purpose && <span>{t.purpose}: {selectedRequisition.purpose}</span>}
                    {selectedRequisition.required_date && <span>{t.required}: {formatMaterialRequisitionDate(selectedRequisition.required_date, isCn)}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeRequisitionDetails}
                  aria-label={t.close}
                  title={t.close}
                  disabled={submitting || Boolean(pendingReceiptId)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className={`w-fit whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(selectedRequisition.status)}`}>
                  {t.status}: {statusLabel(selectedRequisition.status, isCn)}
                </span>
                {selectedRequisition.status === 'draft' && (
                  <button
                    type="button"
                    onClick={submitDraft}
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {submitting ? t.submitting : t.submitDraft}
                  </button>
                )}
              </div>

              {detailError && <div role="alert" className="border-l-2 border-red-500 bg-red-500/5 px-3 py-2 text-sm text-red-600">{detailError}</div>}
              <div>{(selectedRequisition.items || []).map(renderProgressItem)}</div>
            </>
          ) : (
            <div role="alert" className="border-l-2 border-red-500 bg-red-500/5 px-3 py-2 text-sm text-red-600">{detailError}</div>
          )}
        </section>
      )}
    </div>
  );
}
