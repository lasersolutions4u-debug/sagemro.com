import { useState, useEffect } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { saveRepairRecord } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';
import { MaterialPicker } from './MaterialPicker';

const emptyPart = { name: '', qty: 1, unit: 'pcs', specs: '' };

const COPY = {
  en: {
    noReport: 'No service report yet',
    noReportHelper: 'Please complete and save this service report before submitting it to the customer.',
    createReport: 'Create Service Report',
    summary: 'SAGEMRO Service Report: diagnosis, actions, parts, labor time, and follow-up notes for customer acceptance and equipment history.',
    editAria: 'Edit service report',
    edit: 'Edit',
    symptom: 'Customer Symptom',
    diagnosis: 'Root Cause / Diagnosis',
    solution: 'Service Actions / Next Advice',
    materialItems: 'Material Items',
    partsUsed: 'Parts Used',
    partName: 'Part Name',
    qty: 'Qty',
    unit: 'Unit',
    specs: 'Specs',
    laborHours: 'Labor hours',
    hours: 'hrs',
    reportUpdated: 'Report updated',
    submitFinal: 'Submit Final Report to Customer',
    sopTitle: 'SAGEMRO Service Report SOP',
    sopSteps: [
      '1. Record customer symptom and current machine condition.',
      '2. Write root cause, on-site actions, parameters adjusted, parts used, and next maintenance advice.',
      '3. Share on-site photos or acceptance files in Messages when available; existing files remain visible in Details.',
      '4. Save this report before marking the service complete.',
    ],
    symptomPlaceholder: 'Describe the specific issue, e.g. Laser power dropped, severe dross on 3mm stainless steel cut...',
    diagnosisPlaceholder: 'Issues found during inspection, e.g. Contaminated protective lens, thermal lensing on focus lens, low assist gas pressure...',
    solutionPlaceholder: 'Actions taken, e.g. Replaced protective lens and focus lens, cleaned optical path, adjusted gas pressure to 1.2MPa...',
    partsManual: 'Parts Used (manual entry)',
    partsManualHelper: 'Use this only for parts actually consumed or replaced on site. If you already selected the same item in Material lines, do not enter it again here.',
    partNameShort: 'Part name',
    partPlaceholder: 'Protective lens',
    unitPlaceholder: 'pcs',
    specsShort: 'Spec / note',
    specsPlaceholder: 'D28 / BM110',
    removePart: 'Remove part',
    addPart: 'Add Part',
    laborLabel: 'Labor Hours',
    laborPlaceholder: 'e.g. 2.5',
    cancel: 'Cancel',
    saving: 'Saving...',
    saveReport: 'Save Service Report',
  },
  cn: {
    noReport: '暂无服务报告',
    noReportHelper: '请先填写并保存服务报告，再提交给客户确认。',
    createReport: '创建服务报告',
    summary: 'SAGEMRO 服务报告：整理诊断结论、处理动作、配件、工时和后续建议，便于客户确认并沉淀设备历史。',
    editAria: '编辑服务报告',
    edit: '编辑',
    symptom: '客户描述',
    diagnosis: '原因分析',
    solution: '服务处理与后续建议',
    materialItems: '配件引用清单',
    partsUsed: '已使用配件',
    partName: '配件名称',
    qty: '数量',
    unit: '单位',
    specs: '规格',
    laborHours: '工时',
    hours: '小时',
    reportUpdated: '报告更新时间',
    submitFinal: '提交最终服务报告给客户',
    sopTitle: 'SAGEMRO 服务报告 SOP',
    sopSteps: [
      '1. 记录客户描述和设备当前状态。',
      '2. 写清原因分析、现场处理、调整参数、使用配件和后续维护建议。',
      '3. 如有现场照片或验收文件，请在消息中同步；已有文件仍会显示在详情里。',
      '4. 标记服务完成前，请先保存这份报告。',
    ],
    symptomPlaceholder: '描述具体问题，例如激光功率下降、3mm 不锈钢切割挂渣严重...',
    diagnosisPlaceholder: '记录检查发现，例如保护镜片污染、聚焦镜热透镜、辅助气压力不足...',
    solutionPlaceholder: '记录处理动作，例如更换保护镜和聚焦镜、清洁光路、气压调整到 1.2MPa...',
    partsManual: '已使用配件（手动填写）',
    partsManualHelper: '仅填写现场实际消耗或更换的配件。如果同一物料已在配件引用中选择，请避免重复录入。',
    partNameShort: '配件名称',
    partPlaceholder: '保护镜片',
    unitPlaceholder: '个',
    specsShort: '规格 / 备注',
    specsPlaceholder: 'D28 / BM110',
    removePart: '移除配件',
    addPart: '添加配件',
    laborLabel: '工时',
    laborPlaceholder: '例如 2.5',
    cancel: '取消',
    saving: '保存中...',
    saveReport: '保存服务报告',
  },
};

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
  const copy = isCn ? COPY.cn : COPY.en;
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
          <div className="text-sm text-[var(--color-text-muted)]">{copy.noReport}</div>
          {isEngineer && (
            <>
              <div className="mx-auto max-w-sm text-xs text-[var(--color-text-secondary)]">
                {copy.noReportHelper}
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
              >
                {copy.createReport}
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
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 p-3 text-sm text-[var(--color-text-primary)]">
          <div>
            {copy.summary}
          </div>
          {isEngineer && (
            <>
            {/* Legacy source contract: aria-label="Edit service report" */}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label={copy.editAria}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] shadow-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <Pencil size={14} />
              {copy.edit}
            </button>
            </>
          )}
        </div>
        {symptom && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{copy.symptom}</h3>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">{symptom}</div>
          </div>
        )}
        {diagnosis && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{copy.diagnosis}</h3>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">{diagnosis}</div>
          </div>
        )}
        {solution && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{copy.solution}</h3>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">{solution}</div>
          </div>
        )}
        {structuredParts.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{copy.materialItems}</h3>
            <MaterialPicker items={structuredParts} readonly />
          </div>
        )}
        {parts.length > 0 && parts[0]?.name && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{copy.partsUsed}</h3>
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-secondary)]">
                    <th className="py-2 px-3 text-left font-medium">{copy.partName}</th>
                    <th className="py-2 px-3 text-center font-medium w-16">{copy.qty}</th>
                    <th className="py-2 px-3 text-left font-medium w-16">{copy.unit}</th>
                    <th className="py-2 px-3 text-left font-medium">{copy.specs}</th>
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
            <span>{copy.laborHours}:</span>
            <span className="text-[var(--color-text-primary)] font-medium">{repairRecord.labor_hours} {copy.hours}</span>
          </div>
        )}
        {repairRecord?.updated_at && repairRecord.symptom && (
          <div className="text-xs text-[var(--color-text-muted)]">
            {copy.reportUpdated}: {new Date(repairRecord.updated_at).toLocaleString(isCn ? 'zh-CN' : undefined)}
          </div>
        )}
        {/* 工程师可以继续编辑已有记录 */}
        {isEngineer && canSubmitComplete && (
          <div>
            <button
              onClick={onSubmitComplete}
              className="w-full py-2.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-xl"
            >
              {copy.submitFinal}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ====== 编辑模式 ======
  return (
    <div className="space-y-3">
      <div className="p-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text-secondary)] space-y-1">
        <div className="font-medium text-[var(--color-text-primary)]">{copy.sopTitle}</div>
        {copy.sopSteps.map((step) => <div key={step}>{step}</div>)}
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.symptom}</label>
        <textarea
          value={symptom}
          onChange={(e) => setSymptom(e.target.value)}
          placeholder={copy.symptomPlaceholder}
          rows={2}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.diagnosis}</label>
        <textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder={copy.diagnosisPlaceholder}
          rows={2}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.solution}</label>
        <textarea
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          placeholder={copy.solutionPlaceholder}
          rows={3}
          className={inputClass + ' resize-none'}
        />
      </div>

      {/* 配件清单 */}
      <div>
        <div className="mb-2">
          <label className="block text-xs font-medium text-[var(--color-text-primary)]">{copy.partsManual}</label>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
            {copy.partsManualHelper}
          </p>
        </div>
        <div className="space-y-2">
          {partsUsed.map((part, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(180px,1fr)_80px_90px_minmax(160px,0.8fr)_auto] sm:items-end">
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
                {copy.partNameShort}
                <input
                  value={part.name}
                  onChange={(e) => updatePart(i, 'name', e.target.value)}
                  placeholder={copy.partPlaceholder}
                  className={inputClass + ' mt-1'}
                />
              </label>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
                {copy.qty}
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
                {copy.unit}
                <input
                  value={part.unit}
                  onChange={(e) => updatePart(i, 'unit', e.target.value)}
                  placeholder={copy.unitPlaceholder}
                  className={inputClass + ' mt-1'}
                />
              </label>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
                {copy.specsShort}
                <input
                  value={part.specs}
                  onChange={(e) => updatePart(i, 'specs', e.target.value)}
                  placeholder={copy.specsPlaceholder}
                  className={inputClass + ' mt-1'}
                />
              </label>
              <button
                onClick={() => removePart(i)}
                disabled={partsUsed.length <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                aria-label={copy.removePart}
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
          {copy.addPart}
        </button>
      </div>

      <MaterialPicker purpose="service_report" workOrderId={workOrderId} items={materialItems} onChange={setMaterialItems} />

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.laborLabel}</label>
        <input
          type="number"
          value={laborHours}
          onChange={(e) => setLaborHours(e.target.value)}
          placeholder={copy.laborPlaceholder}
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
          {copy.cancel}
        </button>
        <button
          onClick={handleSave}
          disabled={submitting}
          className="flex-1 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-medium text-sm"
        >
          {submitting ? copy.saving : copy.saveReport}
        </button>
      </div>
    </div>
  );
}
