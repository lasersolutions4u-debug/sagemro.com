import { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, CheckCircle2, Download, Edit3, FileSpreadsheet, PackagePlus, RefreshCw, Save, SlidersHorizontal, Upload, XCircle } from 'lucide-react';
import {
  adjustAdminMaterialInventory,
  createAdminMaterial,
  getAdminMaterialRequests,
  getAdminMaterials,
  reviewAdminMaterialRequest,
  updateAdminMaterial,
} from '../services/api';
import { runtimeConfig } from '../config/runtime';

const CATEGORY_KEYS = [
  'laser_cutting',
  'bending',
  'welding',
  'general_electrical',
  'gas_system',
  'consumables',
  'other',
];

const STATUS_KEYS = ['active', 'inactive', 'pending'];

const MATERIAL_TEMPLATE_HEADERS = [
  'material_code',
  'category',
  'name',
  'name_en',
  'spec',
  'brand',
  'compatible_equipment',
  'supplier',
  'production_code',
  'unit',
  'reference_cost',
  'reference_price',
  'stock_quantity',
  'safety_stock',
  'status',
  'notes',
];

const MATERIAL_TEMPLATE_EXAMPLE = [
  'LC-LENS-001',
  'laser_cutting',
  '保护镜片',
  'Protective lens',
  'D28*4.1mm',
  'Generic',
  'fiber laser cutting machine',
  'Sample Supplier',
  'BATCH-2026-001',
  'pcs',
  '3.5',
  '8',
  '20',
  '5',
  'active',
  'Example only. Replace with reviewed product data.',
];

const EMPTY_FORM = {
  material_code: '',
  category: 'laser_cutting',
  name: '',
  name_en: '',
  spec: '',
  brand: '',
  compatible_equipment: '',
  supplier: '',
  production_code: '',
  unit: 'pcs',
  reference_cost: '',
  reference_price: '',
  stock_quantity: 0,
  safety_stock: 0,
  status: 'active',
  notes: '',
};

const TEXT = {
  en: {
    title: 'Material Master',
    subtitle: 'Maintain the spare parts and consumables that engineers can later reference in quotes, preparation lists, and service reports.',
    badge: 'Admin controlled product data',
    search: 'Search code, name, spec, brand, supplier',
    allCategories: 'All categories',
    allStatuses: 'All statuses',
    refresh: 'Refresh',
    total: (count) => `${count} item(s)`,
    loading: 'Loading...',
    empty: 'No materials yet. Add the first frequently used spare part.',
    newMaterial: 'New material',
    editMaterial: 'Edit material',
    save: 'Save material',
    create: 'Create material',
    saving: 'Saving...',
    saved: 'Material saved.',
    failed: 'Operation failed: ',
    adjustTitle: 'Adjust inventory',
    adjust: 'Adjust',
    adjustmentSaved: 'Inventory updated.',
    requestsTitle: 'Engineer requests',
    requestsSubtitle: 'Review parts engineers could not find in the master data.',
    noRequests: 'No pending material requests.',
    approveCreate: 'Approve and create',
    requestMoreInfo: 'Need more info',
    rejectRequest: 'Reject',
    requestUpdated: 'Request reviewed.',
    sourceWorkOrder: 'Work order',
    bulkTitle: 'Bulk import preview',
    bulkSubtitle: 'Download the template, fill product data, then upload CSV for preview only. Nothing is written to Material Master until an import confirmation workflow is added.',
    downloadTemplate: 'Download CSV template',
    uploadCsv: 'Preview CSV',
    previewOnly: 'Preview only. No product data will be saved from this upload.',
    previewReady: (count, errors) => `${count} row(s) loaded for preview. ${errors} issue(s) found.`,
    previewEmpty: 'Upload a CSV file to preview material rows before import.',
    fileReadFailed: 'CSV preview failed. Please use a UTF-8 CSV file based on the template.',
    csvErrors: 'CSV issues',
    previewRows: 'Preview rows',
    categories: {
      laser_cutting: 'Laser cutting',
      bending: 'Bending',
      welding: 'Welding',
      general_electrical: 'General electrical',
      gas_system: 'Gas system',
      consumables: 'Consumables',
      other: 'Other',
    },
    statuses: {
      active: 'Active',
      inactive: 'Inactive',
      pending: 'Pending',
    },
    requestStatuses: {
      submitted: 'Submitted',
      needs_info: 'Needs info',
      approved: 'Approved',
      rejected: 'Rejected',
      linked_existing: 'Linked existing',
    },
    adjustmentTypes: {
      manual_in: 'Manual in',
      manual_out: 'Manual out',
      correction: 'Correction',
      reservation_release: 'Release reservation',
    },
    fields: {
      material_code: 'Material code',
      category: 'Category',
      name: 'Chinese name',
      name_en: 'English name',
      spec: 'Specification',
      brand: 'Brand',
      compatible_equipment: 'Compatible equipment',
      supplier: 'Supplier',
      production_code: 'Production code / batch',
      unit: 'Unit',
      reference_cost: 'Reference cost',
      reference_price: 'Reference price',
      stock_quantity: 'Stock quantity',
      safety_stock: 'Safety stock',
      status: 'Status',
      notes: 'Notes',
      delta: 'Quantity change',
      reason: 'Reason',
      change_type: 'Adjustment type',
    },
    headers: {
      item: 'Item',
      spec: 'Spec / supplier',
      stock: 'Stock',
      price: 'Reference price',
      status: 'Status',
      action: 'Action',
    },
    previous: 'Previous',
    next: 'Next',
    cancel: 'Cancel',
  },
  'zh-CN': {
    title: '物料管理',
    subtitle: '由运营团队维护常用配件、易损件和耗材。工程师后续只能引用到报价、备件准备和服务报告，不能直接修改物料库。',
    badge: 'Admin 控制的产品数据',
    search: '搜索编码、名称、规格、品牌、供应商',
    allCategories: '全部类别',
    allStatuses: '全部状态',
    refresh: '刷新',
    total: (count) => `共 ${count} 个物料`,
    loading: '加载中...',
    empty: '暂无物料。先录入一个常用配件或易损件。',
    newMaterial: '新增物料',
    editMaterial: '编辑物料',
    save: '保存物料',
    create: '创建物料',
    saving: '保存中...',
    saved: '物料已保存。',
    failed: '操作失败：',
    adjustTitle: '调整库存',
    adjust: '调整',
    adjustmentSaved: '库存已更新。',
    requestsTitle: '工程师物料申请',
    requestsSubtitle: '工程师在工单里找不到合适配件时提交，Admin 核对后再进入物料库。',
    noRequests: '暂无待处理物料申请。',
    approveCreate: '批准并创建',
    requestMoreInfo: '补充信息',
    rejectRequest: '驳回',
    requestUpdated: '申请已处理。',
    sourceWorkOrder: '来源工单',
    bulkTitle: '批量导入预览',
    bulkSubtitle: '先下载模板，填写产品资料后上传 CSV 做预览校验。当前只是预览，不会写入物料库。',
    downloadTemplate: '下载 CSV 模板',
    uploadCsv: '预览 CSV',
    previewOnly: '仅预览。本次上传不会保存任何产品数据。',
    previewReady: (count, errors) => `已加载 ${count} 行预览，发现 ${errors} 个问题。`,
    previewEmpty: '上传 CSV 文件后，可以先预览物料数据再导入。',
    fileReadFailed: 'CSV 预览失败。请使用基于模板填写的 UTF-8 CSV 文件。',
    csvErrors: 'CSV 问题',
    previewRows: '预览行',
    categories: {
      laser_cutting: '激光切割',
      bending: '折弯',
      welding: '焊接',
      general_electrical: '通用电气',
      gas_system: '气路系统',
      consumables: '耗材',
      other: '其他',
    },
    statuses: {
      active: '启用',
      inactive: '停用',
      pending: '待确认',
    },
    requestStatuses: {
      submitted: '待审核',
      needs_info: '需补充',
      approved: '已批准',
      rejected: '已驳回',
      linked_existing: '已关联已有物料',
    },
    adjustmentTypes: {
      manual_in: '手动入库',
      manual_out: '手动出库',
      correction: '库存校正',
      reservation_release: '释放预留',
    },
    fields: {
      material_code: '物料编码',
      category: '类别',
      name: '中文名称',
      name_en: '英文名称',
      spec: '规格',
      brand: '品牌',
      compatible_equipment: '适配设备',
      supplier: '供应商',
      production_code: '生产编码 / 批次',
      unit: '单位',
      reference_cost: '参考进价',
      reference_price: '参考销售价',
      stock_quantity: '库存数量',
      safety_stock: '安全库存',
      status: '状态',
      notes: '备注',
      delta: '调整数量',
      reason: '调整原因',
      change_type: '调整类型',
    },
    headers: {
      item: '物料',
      spec: '规格 / 供应商',
      stock: '库存',
      price: '参考价格',
      status: '状态',
      action: '操作',
    },
    previous: '上一页',
    next: '下一页',
    cancel: '取消',
  },
};

function numberOrBlank(value) {
  if (value === null || value === undefined || value === '') return '';
  return Number(value);
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((items) => items.some((item) => item.trim()));
}

function buildMaterialPreview(text) {
  const [headerRow = [], ...bodyRows] = parseCsvRows(text);
  const headers = headerRow.map((header) => header.trim());
  const errors = [];
  const missingHeaders = MATERIAL_TEMPLATE_HEADERS.filter((field) => !headers.includes(field));
  if (missingHeaders.length) errors.push(`Missing columns: ${missingHeaders.join(', ')}`);

  const rows = bodyRows.map((items, rowIndex) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (items[index] ?? '').trim();
    });
    if (!row.material_code) errors.push(`Row ${rowIndex + 2}: material_code is required`);
    if (!row.name && !row.name_en) errors.push(`Row ${rowIndex + 2}: name or name_en is required`);
    if (row.category && !CATEGORY_KEYS.includes(row.category)) errors.push(`Row ${rowIndex + 2}: category is not recognized`);
    if (row.status && !STATUS_KEYS.includes(row.status)) errors.push(`Row ${rowIndex + 2}: status is not recognized`);
    return row;
  });

  return { rows, errors };
}

function statusClass(status) {
  if (status === 'active') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'pending') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
}

export function MaterialsPage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const [data, setData] = useState({ total: 0, list: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formSourceRequestId, setFormSourceRequestId] = useState('');
  const [adjusting, setAdjusting] = useState(null);
  const [adjustment, setAdjustment] = useState({ change_type: 'manual_in', delta: '', reason: '' });
  const [requests, setRequests] = useState({ total: 0, list: [] });
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [materialPreview, setMaterialPreview] = useState({ rows: [], errors: [] });
  const csvInputRef = useRef(null);
  const pageSize = 20;

  const filters = useMemo(() => ({
    search,
    category,
    status,
  }), [search, category, status]);

  const load = () => {
    setLoading(true);
    getAdminMaterials(page, pageSize, filters)
      .then(setData)
      .catch((error) => setMessage(t.failed + error.message))
      .finally(() => setLoading(false));
  };

  const loadRequests = () => {
    setRequestsLoading(true);
    getAdminMaterialRequests(1, 8, { status: 'submitted' })
      .then(setRequests)
      .catch((error) => setMessage(t.failed + error.message))
      .finally(() => setRequestsLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, filters]);

  useEffect(() => {
    loadRequests();
  }, []);

  const startCreate = () => {
    setEditing(null);
    setFormSourceRequestId('');
    setForm(EMPTY_FORM);
    setMessage('');
  };

  const startEdit = (material) => {
    setEditing(material);
    setFormSourceRequestId('');
    setForm({
      ...EMPTY_FORM,
      ...material,
      reference_cost: material.reference_cost ?? '',
      reference_price: material.reference_price ?? '',
      stock_quantity: material.stock_quantity ?? 0,
      safety_stock: material.safety_stock ?? 0,
    });
    setMessage('');
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const downloadMaterialTemplate = () => {
    const rows = [
      MATERIAL_TEMPLATE_HEADERS,
      MATERIAL_TEMPLATE_EXAMPLE,
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sagemro-material-master-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const previewMaterialCsv = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = buildMaterialPreview(String(reader.result || ''));
      setMaterialPreview(result);
      setMessage(t.previewReady(result.rows.length, result.errors.length));
    };
    reader.onerror = () => setMessage(t.fileReadFailed);
    reader.readAsText(file, 'UTF-8');
  };

  const saveMaterial = async () => {
    setSaving(true);
    setMessage('');
    const payload = {
      ...form,
      reference_cost: numberOrBlank(form.reference_cost),
      reference_price: numberOrBlank(form.reference_price),
      stock_quantity: parseInt(form.stock_quantity || 0, 10),
      safety_stock: parseInt(form.safety_stock || 0, 10),
    };
    try {
      if (editing?.id) {
        await updateAdminMaterial(editing.id, payload);
      } else {
        await createAdminMaterial(payload);
      }
      setMessage(t.saved);
      startCreate();
      load();
    } catch (error) {
      setMessage(t.failed + error.message);
    } finally {
      setSaving(false);
    }
  };

  const openAdjustment = (material) => {
    setAdjusting(material);
    setAdjustment({ change_type: 'manual_in', delta: '', reason: '' });
    setMessage('');
  };

  const saveAdjustment = async () => {
    if (!adjusting?.id) return;
    setSaving(true);
    setMessage('');
    try {
      await adjustAdminMaterialInventory(adjusting.id, {
        ...adjustment,
        delta: parseInt(adjustment.delta || 0, 10),
      });
      setMessage(t.adjustmentSaved);
      setAdjusting(null);
      load();
    } catch (error) {
      setMessage(t.failed + error.message);
    } finally {
      setSaving(false);
    }
  };

  const useRequestAsDraft = (request) => {
    setEditing(null);
    setFormSourceRequestId(request.id);
    setForm({
      ...EMPTY_FORM,
      material_code: '',
      category: request.category || 'other',
      name: request.suggested_name || '',
      name_en: request.suggested_name_en || '',
      spec: request.spec || '',
      brand: request.brand || '',
      compatible_equipment: request.compatible_equipment || '',
      supplier: request.supplier_suggestion || '',
      unit: request.unit || 'pcs',
      stock_quantity: Math.max(0, Math.round(Number(request.expected_quantity || 0))),
      notes: request.usage_note || '',
    });
    setMessage('');
  };

  const reviewRequest = async (request, action) => {
    setSaving(true);
    setMessage('');
    try {
      if (action === 'approve_create') {
        const draft = formSourceRequestId === request.id ? form : {
          ...EMPTY_FORM,
          category: request.category || 'other',
          name: request.suggested_name || '',
          name_en: request.suggested_name_en || '',
          spec: request.spec || '',
          brand: request.brand || '',
          compatible_equipment: request.compatible_equipment || '',
          supplier: request.supplier_suggestion || '',
          unit: request.unit || 'pcs',
          stock_quantity: Math.max(0, Math.round(Number(request.expected_quantity || 0))),
          notes: request.usage_note || '',
        };
        const materialPayload = {
          ...draft,
          material_code: draft.material_code || `${(request.category || 'MAT').slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`,
          category: draft.category || request.category || 'other',
          name: draft.name || request.suggested_name,
          name_en: draft.name_en || request.suggested_name_en || '',
          spec: draft.spec || request.spec || '',
          brand: draft.brand || request.brand || '',
          compatible_equipment: draft.compatible_equipment || request.compatible_equipment || '',
          supplier: draft.supplier || request.supplier_suggestion || '',
          unit: draft.unit || request.unit || 'pcs',
          reference_cost: numberOrBlank(draft.reference_cost),
          reference_price: numberOrBlank(draft.reference_price),
          stock_quantity: parseInt(draft.stock_quantity || request.expected_quantity || 0, 10),
          safety_stock: parseInt(draft.safety_stock || 0, 10),
          status: draft.status || 'active',
          notes: draft.notes || request.usage_note || '',
        };
        await reviewAdminMaterialRequest(request.id, {
          action: 'approve_create',
          review_notes: t.approveCreate,
          material: materialPayload,
        });
      } else {
        await reviewAdminMaterialRequest(request.id, {
          status: action,
          review_notes: action === 'rejected' ? t.rejectRequest : t.requestMoreInfo,
        });
      }
      setMessage(t.requestUpdated);
      startCreate();
      loadRequests();
      load();
    } catch (error) {
      setMessage(t.failed + error.message);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[linear-gradient(135deg,_rgba(245,158,11,0.14),_rgba(42,42,60,0.94)_42%,_rgba(30,30,46,1))] p-5 shadow-lg shadow-black/10">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--color-primary)]/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
              <Boxes size={14} />
              {t.badge}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{t.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
              {t.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { load(); loadRequests(); }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--color-text-secondary)] transition hover:bg-white/10 hover:text-[var(--color-text)]"
          >
            <RefreshCw size={15} />
            {t.refresh}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={17} className="text-[var(--color-primary)]" />
              <h3 className="font-semibold text-[var(--color-text-primary)]">{t.bulkTitle}</h3>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--color-text-secondary)]">{t.bulkSubtitle}</p>
            <p className="mt-2 text-xs font-medium text-amber-300">{t.previewOnly}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={previewMaterialCsv}
              className="hidden"
            />
            <button
              type="button"
              onClick={downloadMaterialTemplate}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
            >
              <Download size={15} />
              {t.downloadTemplate}
            </button>
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-black"
            >
              <Upload size={15} />
              {t.uploadCsv}
            </button>
          </div>
        </div>

        {materialPreview.rows.length === 0 && materialPreview.errors.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-5 text-sm text-[var(--color-text-muted)]">
            {t.previewEmpty}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
              <div className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">{t.csvErrors}</div>
              {materialPreview.errors.length === 0 ? (
                <div className="text-xs text-emerald-300">No blocking issues found.</div>
              ) : (
                <ul className="space-y-1 text-xs leading-5 text-amber-300">
                  {materialPreview.errors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}
                </ul>
              )}
            </div>
            <div className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
              <div className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">{t.previewRows}</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                      <th className="px-2 py-2 text-left">material_code</th>
                      <th className="px-2 py-2 text-left">category</th>
                      <th className="px-2 py-2 text-left">name</th>
                      <th className="px-2 py-2 text-left">name_en</th>
                      <th className="px-2 py-2 text-left">spec</th>
                      <th className="px-2 py-2 text-left">stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialPreview.rows.slice(0, 6).map((row, index) => (
                      <tr key={`${row.material_code}-${index}`} className="border-b border-[var(--color-border)]/50">
                        <td className="px-2 py-2">{row.material_code || '-'}</td>
                        <td className="px-2 py-2">{row.category || '-'}</td>
                        <td className="px-2 py-2">{row.name || '-'}</td>
                        <td className="px-2 py-2">{row.name_en || '-'}</td>
                        <td className="px-2 py-2">{row.spec || '-'}</td>
                        <td className="px-2 py-2">{row.stock_quantity || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)]">{t.requestsTitle}</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{t.requestsSubtitle}</p>
          </div>
          <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
            {requests.total}
          </span>
        </div>

        {requestsLoading ? (
          <div className="py-6 text-sm text-[var(--color-text-muted)]">{t.loading}</div>
        ) : requests.list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-6 text-sm text-[var(--color-text-muted)]">
            {t.noRequests}
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {requests.list.map((request) => (
              <div key={request.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-[var(--color-text-primary)]">{request.suggested_name}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {[request.spec, request.brand, request.unit].filter(Boolean).join(' · ') || '-'}
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-primary)]">{t.categories[request.category] || request.category}</div>
                  </div>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
                    {t.requestStatuses[request.status] || request.status}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-secondary)] sm:grid-cols-2">
                  <div>{t.sourceWorkOrder}: {request.work_order_id || '-'}</div>
                  <div>{t.fields.stock_quantity}: {request.expected_quantity || 1} {request.unit || 'pcs'}</div>
                  <div>{t.fields.compatible_equipment}: {request.compatible_equipment || '-'}</div>
                  <div>{t.fields.supplier}: {request.supplier_suggestion || '-'}</div>
                </div>
                {request.usage_note && (
                  <div className="mt-2 rounded-lg bg-[var(--color-surface)] px-3 py-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                    {request.usage_note}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => useRequestAsDraft(request)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  >
                    <Edit3 size={13} />
                    {editing ? t.editMaterial : t.newMaterial}
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewRequest(request, 'approve_create')}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-60"
                  >
                    <CheckCircle2 size={13} />
                    {t.approveCreate}
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewRequest(request, 'needs_info')}
                    disabled={saving}
                    className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] disabled:opacity-60"
                  >
                    {t.requestMoreInfo}
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewRequest(request, 'rejected')}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    <XCircle size={13} />
                    {t.rejectRequest}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <SlidersHorizontal size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder={t.search}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-9 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <select
              value={category}
              onChange={(event) => { setCategory(event.target.value); setPage(1); }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none"
            >
              <option value="all">{t.allCategories}</option>
              {CATEGORY_KEYS.map((key) => <option key={key} value={key}>{t.categories[key]}</option>)}
            </select>
            <select
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none"
            >
              <option value="all">{t.allStatuses}</option>
              {STATUS_KEYS.map((key) => <option key={key} value={key}>{t.statuses[key]}</option>)}
            </select>
            <span className="text-xs text-[var(--color-text-muted)]">{t.total(data.total)}</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.loading}</div>
          ) : data.list.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.empty}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.item}</th>
                    <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.spec}</th>
                    <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.stock}</th>
                    <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.price}</th>
                    <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.status}</th>
                    <th className="px-2 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t.headers.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.list.map((material) => (
                    <tr key={material.id} className="border-b border-[var(--color-border)]/50 align-top hover:bg-[var(--color-surface-elevated)]/50">
                      <td className="px-2 py-3">
                        <div className="font-medium text-[var(--color-text-primary)]">{material.name}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">{material.material_code}</div>
                        <div className="mt-1 text-xs text-[var(--color-primary)]">{t.categories[material.category] || material.category}</div>
                      </td>
                      <td className="px-2 py-3 text-[var(--color-text-secondary)]">
                        <div>{material.spec || '-'}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">{material.supplier || '-'}</div>
                        {material.production_code && (
                          <div className="mt-1 text-xs text-[var(--color-text-muted)]">{material.production_code}</div>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className={`font-medium ${material.stock_quantity <= material.safety_stock ? 'text-amber-300' : 'text-[var(--color-text-primary)]'}`}>
                          {material.stock_quantity} {material.unit}
                        </div>
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">{t.fields.safety_stock}: {material.safety_stock}</div>
                      </td>
                      <td className="px-2 py-3 text-[var(--color-text-secondary)]">
                        <div>{material.reference_price || 0}</div>
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">{t.fields.reference_cost}: {material.reference_cost || 0}</div>
                      </td>
                      <td className="px-2 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${statusClass(material.status)}`}>
                          {t.statuses[material.status] || material.status}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(material)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                          >
                            <Edit3 size={13} />
                            {t.editMaterial}
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjustment(material)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-primary)]/30 px-2 py-1 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                          >
                            <PackagePlus size={13} />
                            {t.adjust}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-secondary)] disabled:opacity-40"
            >
              {t.previous}
            </button>
            <span className="text-xs text-[var(--color-text-muted)]">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-secondary)] disabled:opacity-40"
            >
              {t.next}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">
                {editing ? t.editMaterial : t.newMaterial}
              </h3>
              {editing && <div className="mt-1 text-xs text-[var(--color-text-muted)]">{editing.material_code}</div>}
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)]"
            >
              {t.newMaterial}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Field label={t.fields.material_code} value={form.material_code} onChange={(value) => updateForm('material_code', value)} required />
            <Field label={t.fields.name} value={form.name} onChange={(value) => updateForm('name', value)} required />
            <Field label={t.fields.name_en} value={form.name_en} onChange={(value) => updateForm('name_en', value)} />
            <div className="grid grid-cols-2 gap-3">
              <SelectField label={t.fields.category} value={form.category} onChange={(value) => updateForm('category', value)} options={CATEGORY_KEYS.map((key) => [key, t.categories[key]])} />
              <SelectField label={t.fields.status} value={form.status} onChange={(value) => updateForm('status', value)} options={STATUS_KEYS.map((key) => [key, t.statuses[key]])} />
            </div>
            <Field label={t.fields.spec} value={form.spec} onChange={(value) => updateForm('spec', value)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.fields.brand} value={form.brand} onChange={(value) => updateForm('brand', value)} />
              <Field label={t.fields.unit} value={form.unit} onChange={(value) => updateForm('unit', value)} />
            </div>
            <Field label={t.fields.compatible_equipment} value={form.compatible_equipment} onChange={(value) => updateForm('compatible_equipment', value)} />
            <Field label={t.fields.supplier} value={form.supplier} onChange={(value) => updateForm('supplier', value)} />
            <Field label={t.fields.production_code} value={form.production_code} onChange={(value) => updateForm('production_code', value)} />
            <div className="grid grid-cols-2 gap-3">
              <Field type="number" label={t.fields.reference_cost} value={form.reference_cost} onChange={(value) => updateForm('reference_cost', value)} />
              <Field type="number" label={t.fields.reference_price} value={form.reference_price} onChange={(value) => updateForm('reference_price', value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field type="number" label={t.fields.stock_quantity} value={form.stock_quantity} onChange={(value) => updateForm('stock_quantity', value)} disabled={Boolean(editing)} />
              <Field type="number" label={t.fields.safety_stock} value={form.safety_stock} onChange={(value) => updateForm('safety_stock', value)} />
            </div>
            <TextareaField label={t.fields.notes} value={form.notes} onChange={(value) => updateForm('notes', value)} />

            <button
              type="button"
              onClick={saveMaterial}
              disabled={saving}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
            >
              <Save size={15} />
              {saving ? t.saving : (editing ? t.save : t.create)}
            </button>
          </div>
        </div>
      </div>

      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t.adjustTitle}</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {adjusting.name} · {adjusting.material_code}
            </p>
            <div className="mt-4 grid gap-3">
              <SelectField
                label={t.fields.change_type}
                value={adjustment.change_type}
                onChange={(value) => setAdjustment((prev) => ({ ...prev, change_type: value }))}
                options={Object.entries(t.adjustmentTypes)}
              />
              <Field
                type="number"
                label={t.fields.delta}
                value={adjustment.delta}
                onChange={(value) => setAdjustment((prev) => ({ ...prev, delta: value }))}
                required
              />
              <TextareaField
                label={t.fields.reason}
                value={adjustment.reason}
                onChange={(value) => setAdjustment((prev) => ({ ...prev, reason: value }))}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjusting(null)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={saveAdjustment}
                disabled={saving}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
              >
                {saving ? t.saving : t.adjust}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, disabled = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
        {label}{required ? ' *' : ''}
      </span>
      <input
        type={type}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)]"
      >
        {options.map(([key, labelText]) => <option key={key} value={key}>{labelText}</option>)}
      </select>
    </label>
  );
}

function TextareaField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      <textarea
        value={value ?? ''}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)]"
      />
    </label>
  );
}
