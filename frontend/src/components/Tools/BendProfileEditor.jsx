import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Send, Trash2 } from 'lucide-react';
import { bendSimulatorCatalog } from '../../data/bendSimulatorCatalog';
import {
  addBendSegment,
  commitBendProfileDraft,
  convertBendProfileUnits,
  createBendProfileDraft,
  getBendProfileUnitLabel,
  moveBendSegment,
  normalizeBendProfileValue,
  removeBendSegment,
  updateBendProfileDraft,
} from '../../utils/bendProfileEditorState';
import { getBendCatalogLabel, localizeBendWarnings } from '../../utils/bendSimulationPresentation';

function NumericField({ label, value, onChange, unit, min = '0.001', max, error }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
      <span>{label}{unit ? ` (${unit})` : ''}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
      />
      {error && <span className="text-xs text-[var(--color-error,#b91c1c)]">{error}</span>}
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function BendProfileEditor({ value, warnings = [], catalog = bendSimulatorCatalog, locale = 'en', onChange, onRequestReview }) {
  const isCn = locale === 'zh-CN' || locale === 'zh';
  const copy = isCn ? {
    title: '折弯工件设置', material: '材料', thickness: '板厚', width: '折弯长度', machine: '折弯机', upperTool: '上模', lowerTool: '下模',
    metric: '公制', imperial: '英制', segment: '折弯', length: '折弯跨距', angle: '成型角度', radius: '内 R',
    add: '添加折弯', remove: '删除折弯', moveUp: '上移', moveDown: '下移', review: '请 SAGEMRO 工程师复核',
    invalid: '请输入大于 0 的数值。', invalidAngle: '请输入 0 到 180 之间的角度。', warning: '规划提示',
  } : {
    title: 'Bend profile', material: 'Material', thickness: 'Thickness', width: 'Bend length', machine: 'Machine', upperTool: 'Upper tool', lowerTool: 'Lower tool',
    metric: 'Metric', imperial: 'Imperial', segment: 'Bend', length: 'Bend span', angle: 'Included angle', radius: 'Inside radius',
    add: 'Add bend', remove: 'Remove bend', moveUp: 'Move bend up', moveDown: 'Move bend down', review: 'Ask a SAGEMRO engineer to review',
    invalid: 'Enter a value greater than 0.', invalidAngle: 'Enter an angle from 0 to 180.', warning: 'Planning notes',
  };
  const [draft, setDraft] = useState(() => createBendProfileDraft(value));
  const incomingSignature = JSON.stringify(value);
  const previousIncomingSignature = useRef(incomingSignature);

  useEffect(() => {
    if (previousIncomingSignature.current === incomingSignature) return;
    previousIncomingSignature.current = incomingSignature;
    setDraft(createBendProfileDraft(value));
  }, [incomingSignature, value]);

  const currentValue = normalizeBendProfileValue(draft, catalog);
  const errors = commitBendProfileDraft(draft, catalog).errors;
  const unit = getBendProfileUnitLabel(locale, draft.unitSystem);
  const localizedWarnings = localizeBendWarnings(warnings, locale);
  const applyDraft = (nextDraft) => {
    setDraft(nextDraft);
    const committed = commitBendProfileDraft(nextDraft, catalog);
    if (committed.value) onChange?.(committed.value);
  };
  const updateGlobal = (field, nextValue) => applyDraft(updateBendProfileDraft(draft, { field, value: nextValue }));
  const updateSegment = (index, field, nextValue) => applyDraft(updateBendProfileDraft(draft, { index, field, value: nextValue }));

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{copy.title}</h2>
        <div className="inline-flex rounded-lg border border-[var(--color-border)] p-1" aria-label={isCn ? '单位制' : 'Unit system'}>
          {['metric', 'imperial'].map((unitSystem) => (
            <button key={unitSystem} type="button" onClick={() => applyDraft(convertBendProfileUnits(draft, unitSystem))} aria-pressed={draft.unitSystem === unitSystem} className={`min-h-8 rounded-md px-3 text-xs font-semibold ${draft.unitSystem === unitSystem ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'}`}>
              {unitSystem === 'metric' ? copy.metric : copy.imperial}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SelectField label={copy.material} value={currentValue.material} onChange={(material) => updateGlobal('material', material)} options={Object.entries(catalog.materials).map(([itemValue, item]) => ({ value: itemValue, label: getBendCatalogLabel(item, locale) }))} />
        <NumericField label={copy.thickness} value={draft.thicknessMm} unit={unit} onChange={(thicknessMm) => updateGlobal('thicknessMm', thicknessMm)} error={errors.thicknessMm ? copy.invalid : null} />
        <NumericField label={copy.width} value={draft.sheetWidthMm} unit={unit} onChange={(sheetWidthMm) => updateGlobal('sheetWidthMm', sheetWidthMm)} error={errors.sheetWidthMm ? copy.invalid : null} />
        <SelectField label={copy.machine} value={currentValue.machine.id} onChange={(machine) => updateGlobal('machine', machine)} options={catalog.machines.map((item) => ({ value: item.id, label: getBendCatalogLabel(item, locale) }))} />
        <SelectField label={copy.upperTool} value={currentValue.upperTool} onChange={(upperTool) => updateGlobal('upperTool', upperTool)} options={catalog.upperTools.map((item) => ({ value: item.id, label: getBendCatalogLabel(item, locale) }))} />
        <SelectField label={copy.lowerTool} value={currentValue.lowerTool} onChange={(lowerTool) => updateGlobal('lowerTool', lowerTool)} options={catalog.lowerTools.map((item) => ({ value: item.id, label: getBendCatalogLabel(item, locale) }))} />
      </div>

      <div className="mt-6 space-y-3">
        {draft.segments.map((segment, index) => (
          <div key={segment.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.segment} {index + 1}</h3>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => applyDraft(moveBendSegment(draft, index, -1))} disabled={index === 0} aria-label={copy.moveUp} className="rounded p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] disabled:opacity-40"><ChevronUp size={16} /></button>
                <button type="button" onClick={() => applyDraft(moveBendSegment(draft, index, 1))} disabled={index === draft.segments.length - 1} aria-label={copy.moveDown} className="rounded p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] disabled:opacity-40"><ChevronDown size={16} /></button>
                <button type="button" onClick={() => applyDraft(removeBendSegment(draft, index))} disabled={draft.segments.length === 1} aria-label={copy.remove} className="rounded p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-error,#b91c1c)] disabled:opacity-40"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumericField label={copy.length} value={segment.lengthMm} unit={unit} onChange={(lengthMm) => updateSegment(index, 'lengthMm', lengthMm)} error={errors[`segments.${index}.lengthMm`] ? copy.invalid : null} />
              <NumericField label={copy.angle} value={segment.angleDeg} unit="°" min="0" max="180" onChange={(angleDeg) => updateSegment(index, 'angleDeg', angleDeg)} error={errors[`segments.${index}.angleDeg`] ? copy.invalidAngle : null} />
              <NumericField label={copy.radius} value={segment.insideRadiusMm} unit={unit} onChange={(insideRadiusMm) => updateSegment(index, 'insideRadiusMm', insideRadiusMm)} error={errors[`segments.${index}.insideRadiusMm`] ? copy.invalid : null} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => applyDraft(addBendSegment(draft))} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"><Plus size={16} />{copy.add}</button>
        <button type="button" onClick={() => onRequestReview?.(commitBendProfileDraft(draft, catalog).value)} disabled={Object.keys(errors).length > 0} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} />{copy.review}</button>
      </div>

      {localizedWarnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3" role="status">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.warning}</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
            {localizedWarnings.map((warning) => <li key={warning.code || warning.message}>{warning.message || warning}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
