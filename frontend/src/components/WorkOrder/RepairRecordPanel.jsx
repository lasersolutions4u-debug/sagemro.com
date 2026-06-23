import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { saveRepairRecord } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

const emptyPart = { name: '', qty: 1, unit: 'pcs', specs: '' };

const COPY = {
  cn: {
    saved: '服务报告已保存',
    saveFailed: '保存失败',
    noReport: '暂无服务报告',
    intro: 'SAGEMRO 服务报告：记录诊断、服务动作、备件、工时和后续建议，用于客户验收和设备历史沉淀。',
    customerSymptom: '客户症状',
    diagnosis: '根因 / 诊断',
    actions: '服务动作 / 后续建议',
    partsUsed: '使用备件',
    partName: '备件名称',
    qty: '数量',
    unit: '单位',
    specs: '规格',
    laborHours: '服务工时',
    hrs: '小时',
    reportUpdated: '报告更新时间',
    editReport: '编辑服务报告',
    sopTitle: 'SAGEMRO 服务报告 SOP',
    sop1: '1. 记录客户症状和当前设备状态。',
    sop2: '2. 写明根因、现场操作、调整参数、使用备件和后续保养建议。',
    sop3: '3. 如有现场照片或验收文件，请上传到“附件”页签。',
    sop4: '4. 标记服务完成前，请先保存本服务报告。',
    symptomPlaceholder: '描述具体问题，例如：激光功率下降，3mm 不锈钢切割挂渣严重...',
    diagnosisPlaceholder: '记录检查发现，例如：保护镜片污染、聚焦镜热透镜、辅助气体压力偏低...',
    actionPlaceholder: '记录处理动作，例如：更换保护镜片和聚焦镜、清洁光路、调整气压至 1.2MPa...',
    partNamePlaceholder: '备件名称',
    qtyPlaceholder: '数量',
    unitPlaceholder: '单位',
    specsPlaceholder: '规格',
    laborPlaceholder: '例如：2.5',
    addPart: '添加备件',
    cancel: '取消',
    saving: '保存中...',
    save: '保存服务报告',
  },
  en: {
    saved: 'Service report saved',
    saveFailed: 'Save failed',
    noReport: 'No service report yet',
    intro: 'SAGEMRO Service Report: diagnosis, actions, parts, labor time, and follow-up notes for customer acceptance and equipment history.',
    customerSymptom: 'Customer Symptom',
    diagnosis: 'Root Cause / Diagnosis',
    actions: 'Service Actions / Next Advice',
    partsUsed: 'Parts Used',
    partName: 'Part Name',
    qty: 'Qty',
    unit: 'Unit',
    specs: 'Specs',
    laborHours: 'Labor hours',
    hrs: 'hrs',
    reportUpdated: 'Report updated',
    editReport: 'Edit Service Report',
    sopTitle: 'SAGEMRO Service Report SOP',
    sop1: '1. Record customer symptom and current machine condition.',
    sop2: '2. Write root cause, on-site actions, parameters adjusted, parts used, and next maintenance advice.',
    sop3: '3. Upload on-site photos or acceptance files in the Attachments tab when available.',
    sop4: '4. Save this report before marking the service complete.',
    symptomPlaceholder: 'Describe the specific issue, e.g. Laser power dropped, severe dross on 3mm stainless steel cut...',
    diagnosisPlaceholder: 'Issues found during inspection, e.g. Contaminated protective lens, thermal lensing on focus lens, low assist gas pressure...',
    actionPlaceholder: 'Actions taken, e.g. Replaced protective lens and focus lens, cleaned optical path, adjusted gas pressure to 1.2MPa...',
    partNamePlaceholder: 'Part name',
    qtyPlaceholder: 'Qty',
    unitPlaceholder: 'Unit',
    specsPlaceholder: 'Specs',
    laborPlaceholder: 'e.g. 2.5',
    addPart: 'Add Part',
    cancel: 'Cancel',
    saving: 'Saving...',
    save: 'Save Service Report',
  },
};

function parseParts(partsUsed) {
  try {
    return JSON.parse(partsUsed || '[]');
  } catch {
    return [];
  }
}

export function RepairRecordPanel({ workOrderId, userType, repairRecord, onSaved }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const isEngineer = userType === 'engineer';
  const [isEditing, setIsEditing] = useState(false);

  const [symptom, setSymptom] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [solution, setSolution] = useState('');
  const [partsUsed, setPartsUsed] = useState([{ ...emptyPart }]);
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
      setIsEditing(false);
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
        labor_hours: laborHours ? parseFloat(laborHours) : 0,
      });
      toastSuccess(copy.saved);
      setIsEditing(false);
      onSaved?.();
    } catch (e) {
      toastError(`${copy.saveFailed}: ${e.message}`);
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
    const hasContent = symptom || diagnosis || solution || (repairRecord?.labor_hours > 0);
    if (!hasContent) {
      return <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">{copy.noReport}</div>;
    }
    const parts = parseParts(repairRecord?.parts_used);

    return (
      <div className="space-y-4">
        <div className="p-3 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-xl text-sm text-[var(--color-text-primary)]">
          {copy.intro}
        </div>
        {symptom && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{copy.customerSymptom}</h3>
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
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{copy.actions}</h3>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">{solution}</div>
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
            <span className="text-[var(--color-text-primary)] font-medium">{repairRecord.labor_hours} {copy.hrs}</span>
          </div>
        )}
        {repairRecord?.updated_at && repairRecord.symptom && (
          <div className="text-xs text-[var(--color-text-muted)]">
            {copy.reportUpdated}: {new Date(repairRecord.updated_at).toLocaleString(isCn ? 'zh-CN' : 'en-US')}
          </div>
        )}
        {/* 工程师可以继续编辑已有记录 */}
        {isEngineer && (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full py-2.5 text-sm bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl"
          >
            {copy.editReport}
          </button>
        )}
      </div>
    );
  }

  // ====== 编辑模式 ======
  return (
    <div className="space-y-3">
      <div className="p-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text-secondary)] space-y-1">
        <div className="font-medium text-[var(--color-text-primary)]">{copy.sopTitle}</div>
        <div>{copy.sop1}</div>
        <div>{copy.sop2}</div>
        <div>{copy.sop3}</div>
        <div>{copy.sop4}</div>
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.customerSymptom}</label>
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
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.actions}</label>
        <textarea
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          placeholder={copy.actionPlaceholder}
          rows={3}
          className={inputClass + ' resize-none'}
        />
      </div>

      {/* 配件清单 */}
      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-2">{copy.partsUsed}</label>
        <div className="space-y-2">
          {partsUsed.map((part, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                value={part.name}
                onChange={(e) => updatePart(i, 'name', e.target.value)}
                placeholder={copy.partNamePlaceholder}
                className={inputClass + ' flex-1 min-w-0'}
              />
              <input
                type="number"
                value={part.qty}
                onChange={(e) => updatePart(i, 'qty', e.target.value)}
                placeholder={copy.qtyPlaceholder}
                min="1"
                className={inputClass + ' w-16 text-center'}
              />
              <input
                value={part.unit}
                onChange={(e) => updatePart(i, 'unit', e.target.value)}
                placeholder={copy.unitPlaceholder}
                className={inputClass + ' w-16'}
              />
              <input
                value={part.specs}
                onChange={(e) => updatePart(i, 'specs', e.target.value)}
                placeholder={copy.specsPlaceholder}
                className={inputClass + ' w-28'}
              />
              <button
                onClick={() => removePart(i)}
                disabled={partsUsed.length <= 1}
                className="p-2 text-[var(--color-text-muted)] hover:text-red-500 disabled:opacity-30 flex-shrink-0 mt-1"
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

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{copy.laborHours}</label>
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
          {submitting ? copy.saving : copy.save}
        </button>
      </div>
    </div>
  );
}
