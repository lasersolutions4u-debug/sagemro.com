import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { saveRepairRecord } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';

const emptyPart = { name: '', qty: 1, unit: '个', specs: '' };

export function RepairRecordPanel({ workOrderId, userType, repairRecord, onSaved }) {
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
      try {
        const parts = JSON.parse(repairRecord.parts_used || '[]');
        setPartsUsed(parts.length > 0 ? parts : [{ ...emptyPart }]);
      } catch { setPartsUsed([{ ...emptyPart }]); }
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
      toastSuccess('维修记录已保存');
      setIsEditing(false);
      onSaved?.();
    } catch (e) {
      toastError('保存失败: ' + e.message);
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
      return <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">暂无维修记录</div>;
    }
    const parts = (() => { try { return JSON.parse(repairRecord?.parts_used || '[]'); } catch { return []; } })();

    return (
      <div className="space-y-4">
        {symptom && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">故障现象</h3>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">{symptom}</div>
          </div>
        )}
        {diagnosis && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">诊断结果</h3>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">{diagnosis}</div>
          </div>
        )}
        {solution && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">维修方案</h3>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">{solution}</div>
          </div>
        )}
        {parts.length > 0 && parts[0]?.name && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">更换配件</h3>
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-secondary)]">
                    <th className="py-2 px-3 text-left font-medium">配件名称</th>
                    <th className="py-2 px-3 text-center font-medium w-16">数量</th>
                    <th className="py-2 px-3 text-left font-medium w-16">单位</th>
                    <th className="py-2 px-3 text-left font-medium">规格</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="py-2 px-3 text-[var(--color-text-primary)]">{p.name}</td>
                      <td className="py-2 px-3 text-center text-[var(--color-text-primary)]">{p.qty || 1}</td>
                      <td className="py-2 px-3 text-[var(--color-text-primary)]">{p.unit || '个'}</td>
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
            <span>实际工时：</span>
            <span className="text-[var(--color-text-primary)] font-medium">{repairRecord.labor_hours} 小时</span>
          </div>
        )}
        {repairRecord?.updated_at && repairRecord.symptom && (
          <div className="text-xs text-[var(--color-text-muted)]">
            最后更新：{new Date(repairRecord.updated_at).toLocaleString('zh-CN')}
          </div>
        )}
        {/* 工程师可以继续编辑已有记录 */}
        {isEngineer && (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full py-2.5 text-sm bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl"
          >
            编辑维修记录
          </button>
        )}
      </div>
    );
  }

  // ====== 编辑模式 ======
  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--color-text-muted)]">记录诊断结果和维修过程，方便以后追溯。</div>

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">故障现象</label>
        <textarea
          value={symptom}
          onChange={(e) => setSymptom(e.target.value)}
          placeholder="设备出现的具体问题，如：激光切割机功率下降，切割 3mm 不锈钢时底部挂渣严重..."
          rows={2}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">诊断结果</label>
        <textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="经过检测发现的问题，如：保护镜片污染、聚焦镜热透镜效应、辅助气压不足..."
          rows={2}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">维修方案</label>
        <textarea
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          placeholder="采取了哪些措施，如：更换保护镜片和聚焦镜、清洁光路、调整气压至 1.2MPa..."
          rows={3}
          className={inputClass + ' resize-none'}
        />
      </div>

      {/* 配件清单 */}
      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-2">更换配件</label>
        <div className="space-y-2">
          {partsUsed.map((part, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                value={part.name}
                onChange={(e) => updatePart(i, 'name', e.target.value)}
                placeholder="配件名称"
                className={inputClass + ' flex-1 min-w-0'}
              />
              <input
                type="number"
                value={part.qty}
                onChange={(e) => updatePart(i, 'qty', e.target.value)}
                placeholder="数量"
                min="1"
                className={inputClass + ' w-16 text-center'}
              />
              <input
                value={part.unit}
                onChange={(e) => updatePart(i, 'unit', e.target.value)}
                placeholder="单位"
                className={inputClass + ' w-16'}
              />
              <input
                value={part.specs}
                onChange={(e) => updatePart(i, 'specs', e.target.value)}
                placeholder="规格"
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
          添加配件
        </button>
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">实际工时（小时）</label>
        <input
          type="number"
          value={laborHours}
          onChange={(e) => setLaborHours(e.target.value)}
          placeholder="如：2.5"
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
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={submitting}
          className="flex-1 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-medium text-sm"
        >
          {submitting ? '保存中...' : '保存维修记录'}
        </button>
      </div>
    </div>
  );
}
