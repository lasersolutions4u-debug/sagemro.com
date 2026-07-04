import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { searchMaterials } from '../../services/api';
import { toastError } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function itemKey(item, index) {
  return item.id || item.material_id || `${item.material_code || item.name}-${index}`;
}

export function MaterialPicker({ purpose = 'quote', items = [], onChange, readonly = false }) {
  const isCn = isCnLocale();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

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
                <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">{money(item.unit_price)} CNY</td>
                <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">{money(item.line_total || Number(item.quantity || 0) * Number(item.unit_price || 0))} CNY</td>
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
        <div className="text-sm font-semibold text-[var(--color-primary)]">{money(total)} CNY</div>
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
    </div>
  );
}
