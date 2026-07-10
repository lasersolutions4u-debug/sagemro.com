import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { saveRepairRecord } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';
import { MaterialPicker } from './MaterialPicker';

const emptyPart = { name: '', qty: 1, unit: 'pcs', specs: '' };

function parseParts(partsUsed) {
  try {
    return JSON.parse(partsUsed || '[]');
  } catch {
    return [];
  }
}

function hasRepairRecordContent(record) {
  if (!record) return false;
  const hasText = Boolean(record.symptom || record.diagnosis || record.solution);
  const hasLabor = Number(record.labor_hours || 0) > 0;
  const parts = parseParts(record.parts_used);
  const hasParts = parts.some((part) => part?.name);
  const hasMaterialItems = Array.isArray(record.material_items) && record.material_items.length > 0;
  return hasText || hasLabor || hasParts || hasMaterialItems;
}

export function RepairRecordPanel({ workOrderId, userType, repairRecord, onSaved, onSubmitComplete, canSubmitComplete = false }) {
  const isCn = isCnLocale();
  const isEngineer = userType === 'engineer';
  const [isEditing, setIsEditing] = useState(false);

  const [symptom, setSymptom] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [solution, setSolution] = useState('');
  const [partsUsed, setPartsUsed] = useState([{ ...emptyPart }]);
  const [materialItems, setMaterialItems] = useState([]);
  const [laborHours, setLaborHours] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (repairRecord) {
      setSymptom(repairRecord.symptom || '');
      setDiagnosis(repairRecord.diagnosis || '');
      setSolution(repairRecord.solution || '');
      setLaborHours(repairRecord.labor_hours ? String(repairRecord.labor_hours) : '');
      const parts = parseParts(repairRecord.parts_used);
      setPartsUsed(parts.length > 0 ? parts : [{ ...emptyPart }]);
      setMaterialItems(Array.isArray(repairRecord.material_items) ? repairRecord.material_items : []);
      setIsEditing(isEngineer && !hasRepairRecordContent(repairRecord));
    } else if (isEngineer) {
      setIsEditing(true);
    }
  }, [repairRecord, isEngineer]);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const activeParts = partsUsed.filter(p => p.name.trim());
      await saveRepairRecord(workOrderId, {
        symptom: symptom.trim() || null,
        diagnosis: diagnosis.trim() || null,
        solution: solution.trim() || null,
        parts_used: activeParts.length > 0 ? activeParts : [],
        material_items: materialItems,
        labor_hours: laborHours ? parseFloat(laborHours) : 0,
      });
      toastSuccess(isCn ? '服务报告已保存' : 'Service report saved');
      setIsEditing(false);
      onSaved?.();
    } catch (e) {
      toastError((isCn ? '保存失败：' : 'Save failed: ') + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updatePart = (i, field, value) => {
    const next = [...partsUsed];
    next[i] = { ...next[i], [field]: field === 'qty' ? parseInt(value) || 1 : value };
    setPartsUsed(next);
  };

  const addPart = () => setPartsUsed([...partsUsed, { ...emptyPart }]);

  const removePart = (i) => {
    if (partsUsed.length <= 1) return;
    setPartsUsed(partsUsed.filter((_, idx) => idx !== i));
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

  // ====== 查看模式 ======
  if (!isEditing) {
    const hasContent = hasRepairRecordContent(repairRecord);
    if (!hasContent) {
      return (
        <div className="space-y-3 text-center py-8">
          <div className="text-sm text-[var(--color-text-muted)]">No service report yet</div>
          {isEngineer && (
            <>
              <div className="mx-auto max-w-sm text-xs text-[var(--color-text-secondary)]">
                Please complete and save this service report before submitting it to the customer.
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
              >
                Create Service Report
              </button>
            </>
          )}
        </div>
      );
    }
    const parts = parseParts(repairRecord?.parts_used);
    const structuredParts = Array.isArray(repairRecord?.material_items) ? repairRecord.material_items : [];

    return (
      <div className="space-y-4">
        <div className="p-3 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-xl text-sm text-[var(--color-text-primary)]">
          SAGEMRO Service Report: diagnosis, actions, parts, labor time, and follow-up notes for customer acceptance and equipment history.
        </div>
        {symptom && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Customer Symptom</h3>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">{symptom}</div>
          </div>
        )}
        {diagnosis && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Root Cause / Diagnosis</h3>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">{diagnosis}</div>
          </div>
        )}
        {solution && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Service Actions / Next Advice</h3>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">{solution}</div>
          </div>
        )}
        {structuredParts.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{isCn ? '配件引用清单' : 'Material Items'}</h3>
            <MaterialPicker items={structuredParts} readonly />
          </div>
        )}
        {parts.length > 0 && parts[0]?.name && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Parts Used</h3>
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-secondary)]">
                    <th className="py-2 px-3 text-left font-medium">Part Name</th>
                    <th className="py-2 px-3 text-center font-medium w-16">Qty</th>
                    <th className="py-2 px-3 text-left font-medium w-16">Unit</th>
                    <th className="py-2 px-3 text-left font-medium">Specs</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="py-2 px-3 text-[var(--color-text-primary)]">{p.name}</td>
                      <td className="py-2 px-3 text-center text-[var(--color-text-primary)]">{p.qty || 1}</td>
                      <td className="py-2 px-3 text-[var(--color-text-primary)]">{p.unit || 'pcs'}</td>
                      <td className="py-2 px-3 text-[var(--color-text-secondary)]">{p.specs || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {repairRecord?.labor_hours > 0 && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <span>Labor hours:</span>
            <span className="text-[var(--color-text-primary)] font-medium">{repairRecord.labor_hours} hrs</span>
          </div>
        )}
        {repairRecord?.updated_at && repairRecord.symptom && (
          <div className="text-xs text-[var(--color-text-muted)]">
            Report updated: {new Date(repairRecord.updated_at).toLocaleString()}
          </div>
        )}
        {/* 工程师可以继续编辑已有记录 */}
        {isEngineer && (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-2.5 text-sm bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl"
            >
              Edit Service Report
            </button>
            {canSubmitComplete && (
              <button
                onClick={onSubmitComplete}
                className="w-full py-2.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-xl"
              >
                Submit Final Report to Customer
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ====== 编辑模式 ======
  return (
    <div className="space-y-3">
      <div className="p-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text-secondary)] space-y-1">
        <div className="font-medium text-[var(--color-text-primary)]">SAGEMRO Service Report SOP</div>
        <div>1. Record customer symptom and current machine condition.</div>
        <div>2. Write root cause, on-site actions, parameters adjusted, parts used, and next maintenance advice.</div>
        <div>3. Share on-site photos or acceptance files in Messages when available; existing files remain visible in Details.</div>
        <div>4. Save this report before marking the service complete.</div>
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Customer Symptom</label>
        <textarea
          value={symptom}
          onChange={(e) => setSymptom(e.target.value)}
          placeholder="Describe the specific issue, e.g. Laser power dropped, severe dross on 3mm stainless steel cut..."
          rows={2}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Root Cause / Diagnosis</label>
        <textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="Issues found during inspection, e.g. Contaminated protective lens, thermal lensing on focus lens, low assist gas pressure..."
          rows={2}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Service Actions / Next Advice</label>
        <textarea
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          placeholder="Actions taken, e.g. Replaced protective lens and focus lens, cleaned optical path, adjusted gas pressure to 1.2MPa..."
          rows={3}
          className={inputClass + ' resize-none'}
        />
      </div>

      {/* 配件清单 */}
      <div>
        <div className="mb-2">
          <label className="block text-xs font-medium text-[var(--color-text-primary)]">Parts Used (manual entry)</label>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
            Use this only for parts actually consumed or replaced on site. If you already selected the same item in Material lines, do not enter it again here.
          </p>
        </div>
        <div className="space-y-2">
          {partsUsed.map((part, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(180px,1fr)_80px_90px_minmax(160px,0.8fr)_auto] sm:items-end">
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
                Part name
                <input
                  value={part.name}
                  onChange={(e) => updatePart(i, 'name', e.target.value)}
                  placeholder="Protective lens"
                  className={inputClass + ' mt-1'}
                />
              </label>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
                Qty
                <input
                  type="number"
                  value={part.qty}
                  onChange={(e) => updatePart(i, 'qty', e.target.value)}
                  placeholder="1"
                  min="1"
                  className={inputClass + ' mt-1 text-center'}
                />
              </label>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
                Unit
                <input
                  value={part.unit}
                  onChange={(e) => updatePart(i, 'unit', e.target.value)}
                  placeholder="pcs"
                  className={inputClass + ' mt-1'}
                />
              </label>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
                Spec / note
                <input
                  value={part.specs}
                  onChange={(e) => updatePart(i, 'specs', e.target.value)}
                  placeholder="D28 / BM110"
                  className={inputClass + ' mt-1'}
                />
              </label>
              <button
                onClick={() => removePart(i)}
                disabled={partsUsed.length <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                aria-label="Remove part"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addPart}
          className="mt-2 flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
        >
          <Plus size={14} />
          Add Part
        </button>
      </div>

      <MaterialPicker purpose="service_report" workOrderId={workOrderId} items={materialItems} onChange={setMaterialItems} />

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Labor Hours</label>
        <input
          type="number"
          value={laborHours}
          onChange={(e) => setLaborHours(e.target.value)}
          placeholder="e.g. 2.5"
          min="0"
          step="0.5"
          className={inputClass + ' w-32'}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setIsEditing(false)}
          className="flex-1 py-2.5 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl font-medium text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={submitting}
          className="flex-1 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-medium text-sm"
        >
          {submitting ? 'Saving...' : 'Save Service Report'}
        </button>
      </div>
    </div>
  );
}
