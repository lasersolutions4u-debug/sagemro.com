import { useEffect, useMemo, useState } from 'react';
import { PackagePlus, Plus, Search, Trash2, X } from 'lucide-react';
import { createMaterialRequest, searchMaterials } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function itemKey(item, index) {
  return item.id || item.material_id || `${item.material_code || item.name}-${index}`;
}

const CATEGORY_OPTIONS = [
  ['laser_cutting', { cn: '激光切割', en: 'Laser cutting' }],
  ['bending', { cn: '折弯', en: 'Bending' }],
  ['welding', { cn: '焊接', en: 'Welding' }],
  ['general_electrical', { cn: '通用电气', en: 'General electrical' }],
  ['gas_system', { cn: '气路系统', en: 'Gas system' }],
  ['consumables', { cn: '耗材', en: 'Consumables' }],
  ['other', { cn: '其他', en: 'Other' }],
];

const EMPTY_REQUEST = {
  suggested_name: '',
  suggested_name_en: '',
  category: 'laser_cutting',
  spec: '',
  brand: '',
  compatible_equipment: '',
  supplier_suggestion: '',
  expected_quantity: 1,
  unit: 'pcs',
  usage_note: '',
  urgency: 'normal',
};

export function MaterialPicker({ purpose = 'quote', workOrderId = '', items = [], onChange, readonly = false }) {
  const isCn = isCnLocale();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState(EMPTY_REQUEST);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0),
    [items]
  );

  useEffect(() => {
    if (readonly || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchMaterials({ search: query.trim(), pageSize: 8 })
        .then((data) => {
          if (!cancelled) setResults(data.list || []);
        })
        .catch((error) => {
          if (!cancelled) toastError((isCn ? '物料搜索失败：' : 'Material search failed: ') + error.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isCn, query, readonly]);

  const updateItem = (index, patch) => {
    const next = items.map((item, i) => {
      if (i !== index) return item;
      const merged = { ...item, ...patch };
      const quantity = Number(merged.quantity || 0);
      const unitPrice = Number(merged.unit_price || 0);
      return { ...merged, line_total: Math.round(quantity * unitPrice * 100) / 100 };
    });
    onChange?.(next);
  };

  const addMaterial = (material) => {
    const nextItem = {
      material_id: material.id,
      purpose,
      material_code: material.material_code,
      name: material.name,
      name_en: material.name_en,
      spec: material.spec,
      brand: material.brand,
      unit: material.unit || 'pcs',
      quantity: 1,
      unit_price: Number(material.reference_price || 0),
      line_total: Number(material.reference_price || 0),
      note: '',
    };
    onChange?.([...items, nextItem]);
    setQuery('');
    setResults([]);
  };

  const removeItem = (index) => {
    onChange?.(items.filter((_, i) => i !== index));
  };

  const openMaterialRequest = () => {
    setRequestForm((prev) => ({
      ...EMPTY_REQUEST,
      ...prev,
      suggested_name: prev.suggested_name || query.trim(),
      usage_note: prev.usage_note || (purpose === 'quote'
        ? (isCn ? '用于当前工单报价配件清单' : 'Needed for the current work order quote')
        : (isCn ? '用于当前工单服务报告或备件核对' : 'Needed for the current work order report or preparation')),
    }));
    setRequestOpen(true);
  };

  const updateRequestForm = (field, value) => {
    setRequestForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitMaterialRequest = async () => {
    if (!requestForm.suggested_name.trim()) {
      toastError(isCn ? '请填写建议物料名称' : 'Please enter the suggested part name');
      return;
    }
    setSubmittingRequest(true);
    try {
      await createMaterialRequest({
        ...requestForm,
        work_order_id: workOrderId || undefined,
        expected_quantity: Number(requestForm.expected_quantity || 1),
      });
      toastSuccess(isCn ? '物料申请已提交，运营团队会审核后维护到物料库。' : 'Material request submitted. Operations will review it before adding it to the master data.');
      setRequestOpen(false);
      setRequestForm(EMPTY_REQUEST);
    } catch (error) {
      toastError((isCn ? '提交物料申请失败：' : 'Material request failed: ') + error.message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  if (readonly) {
    if (!items.length) return null;
    return (
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-secondary)]">
              <th className="px-3 py-2 text-left font-medium">{isCn ? '配件' : 'Part'}</th>
              <th className="px-3 py-2 text-center font-medium">{isCn ? '数量' : 'Qty'}</th>
              <th className="px-3 py-2 text-right font-medium">{isCn ? '单价' : 'Unit Price'}</th>
              <th className="px-3 py-2 text-right font-medium">{isCn ? '小计' : 'Line Total'}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={itemKey(item, index)} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 text-[var(--color-text-primary)]">
                  <div>{isCn ? item.name : (item.name_en || item.name)}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {[item.material_code, item.spec, item.brand].filter(Boolean).join(' · ') || '-'}
                  </div>
                </td>
                <td className="px-3 py-2 text-center text-[var(--color-text-primary)]">{item.quantity || 1} {item.unit || 'pcs'}</td>
                <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">{money(item.unit_price)} USD</td>
                <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">{money(item.line_total || Number(item.quantity || 0) * Number(item.unit_price || 0))} USD</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-[var(--color-text-primary)]">{isCn ? '引用物料库' : 'Material lines'}</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {isCn ? '从物料库选择配件，报价和服务报告会保留清晰明细。' : 'Select parts from the material master for cleaner quotes and reports.'}
          </div>
        </div>
        <div className="text-sm font-semibold text-[var(--color-primary)]">{money(total)} USD</div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={isCn ? '搜索物料编码、名称、规格' : 'Search code, name, or specification'}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {(results.length > 0 || loading) && (
        <div className="max-h-48 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {loading && <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">{isCn ? '搜索中...' : 'Searching...'}</div>}
          {!loading && results.map((material) => (
            <button
              type="button"
              key={material.id}
              onClick={() => addMaterial(material)}
              className="flex w-full items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--color-surface-elevated)]"
            >
              <span>
                <span className="block text-sm text-[var(--color-text-primary)]">{isCn ? material.name : (material.name_en || material.name)}</span>
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {[material.material_code, material.spec, material.brand].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="flex items-center gap-1 text-xs text-[var(--color-primary)]"><Plus size={14} />{isCn ? '加入' : 'Add'}</span>
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && !loading && results.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-secondary)]">
          <div className="font-medium text-[var(--color-text-primary)]">
            {isCn ? '没有找到合适的物料？' : 'No matching part in the master data?'}
          </div>
          <div className="mt-1">
            {isCn ? '提交一个新增申请，Admin 审核后再进入物料库。' : 'Submit a request. Admin reviews it before it becomes reusable master data.'}
          </div>
          <button
            type="button"
            onClick={openMaterialRequest}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[var(--color-primary)]/30 px-2 py-1 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
          >
            <PackagePlus size={14} />
            {isCn ? '申请新增物料' : 'Request new part'}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={itemKey(item, index)} className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 md:grid-cols-[1fr_72px_112px_32px]">
              <div className="min-w-0">
                <div className="truncate text-sm text-[var(--color-text-primary)]">{isCn ? item.name : (item.name_en || item.name)}</div>
                <div className="truncate text-xs text-[var(--color-text-muted)]">{[item.material_code, item.spec, item.brand].filter(Boolean).join(' · ') || '-'}</div>
              </div>
              <input
                type="number"
                min="0"
                step="1"
                value={item.quantity}
                onChange={(event) => updateItem(index, { quantity: Number(event.target.value || 0) })}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price}
                onChange={(event) => updateItem(index, { unit_price: Number(event.target.value || 0) })}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-sm text-[var(--color-text-primary)]"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="flex h-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-500"
                aria-label={isCn ? '移除物料' : 'Remove material'}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {requestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {isCn ? '申请新增物料' : 'Request a new part'}
                </h3>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                  {isCn
                    ? '这不会直接改动物料库。Admin 会核对名称、规格、供应来源和价格后再维护。'
                    : 'This does not change the material master directly. Admin will verify name, spec, supply, and pricing first.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequestOpen(false)}
                className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
                aria-label={isCn ? '关闭' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <RequestField
                label={isCn ? '建议名称' : 'Suggested name'}
                value={requestForm.suggested_name}
                onChange={(value) => updateRequestForm('suggested_name', value)}
                required
              />
              <RequestField
                label={isCn ? '英文名称（可选）' : 'English name (optional)'}
                value={requestForm.suggested_name_en}
                onChange={(value) => updateRequestForm('suggested_name_en', value)}
              />
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{isCn ? '类别' : 'Category'}</span>
                <select
                  value={requestForm.category}
                  onChange={(event) => updateRequestForm('category', event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
                >
                  {CATEGORY_OPTIONS.map(([key, label]) => (
                    <option key={key} value={key}>{isCn ? label.cn : label.en}</option>
                  ))}
                </select>
              </label>
              <RequestField
                label={isCn ? '规格' : 'Specification'}
                value={requestForm.spec}
                onChange={(value) => updateRequestForm('spec', value)}
              />
              <RequestField
                label={isCn ? '品牌' : 'Brand'}
                value={requestForm.brand}
                onChange={(value) => updateRequestForm('brand', value)}
              />
              <RequestField
                label={isCn ? '适配设备' : 'Compatible equipment'}
                value={requestForm.compatible_equipment}
                onChange={(value) => updateRequestForm('compatible_equipment', value)}
              />
              <RequestField
                label={isCn ? '建议供应商（可选）' : 'Suggested supplier (optional)'}
                value={requestForm.supplier_suggestion}
                onChange={(value) => updateRequestForm('supplier_suggestion', value)}
              />
              <div className="grid grid-cols-[1fr_88px] gap-2">
                <RequestField
                  type="number"
                  label={isCn ? '预计数量' : 'Expected qty'}
                  value={requestForm.expected_quantity}
                  onChange={(value) => updateRequestForm('expected_quantity', value)}
                />
                <RequestField
                  label={isCn ? '单位' : 'Unit'}
                  value={requestForm.unit}
                  onChange={(value) => updateRequestForm('unit', value)}
                />
              </div>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{isCn ? '用途说明' : 'Usage note'}</span>
              <textarea
                value={requestForm.usage_note}
                rows={3}
                onChange={(event) => updateRequestForm('usage_note', event.target.value)}
                className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRequestOpen(false)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
              >
                {isCn ? '取消' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={submitMaterialRequest}
                disabled={submittingRequest}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {submittingRequest ? (isCn ? '提交中...' : 'Submitting...') : (isCn ? '提交申请' : 'Submit request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestField({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">
        {label}{required ? ' *' : ''}
      </span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
      />
    </label>
  );
}
