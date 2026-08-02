import { ChevronDown, ChevronUp, Plus, Send, Trash2 } from 'lucide-react';
import { bendSimulatorCatalog } from '../../data/bendSimulatorCatalog';

const DEFAULT_SEGMENT = { lengthMm: 100, angleDeg: 90, insideRadiusMm: 3 };

function toPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clampAngle(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(180, Math.max(0, number)) : 90;
}

function machineId(machine) {
  return typeof machine === 'object' ? machine?.id : machine;
}

function convertDimension(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  return fromUnit === 'metric' ? value / 25.4 : value * 25.4;
}

function getCatalogItem(items, id, fallback) {
  return items.find((item) => item.id === id) || fallback;
}

function normalizeProfileValue(value = {}, catalog = bendSimulatorCatalog) {
  const fallbackMachine = catalog.machines[1] || catalog.machines[0];
  const fallbackUpperTool = catalog.upperTools[1] || catalog.upperTools[0];
  const fallbackLowerTool = catalog.lowerTools[4] || catalog.lowerTools[0];
  const fallbackMaterial = Object.keys(catalog.materials)[0];
  const unitSystem = value.unitSystem === 'imperial' ? 'imperial' : 'metric';
  const segments = (value.segments?.length ? value.segments : [DEFAULT_SEGMENT]).map((segment, index) => ({
    lengthMm: toPositiveNumber(segment.lengthMm, DEFAULT_SEGMENT.lengthMm),
    angleDeg: clampAngle(segment.angleDeg),
    insideRadiusMm: toPositiveNumber(segment.insideRadiusMm, toPositiveNumber(value.thicknessMm, 3)),
    order: index + 1,
  }));

  return {
    unitSystem,
    material: catalog.materials[value.material] ? value.material : fallbackMaterial,
    thicknessMm: toPositiveNumber(value.thicknessMm, 3),
    sheetWidthMm: toPositiveNumber(value.sheetWidthMm, 1000),
    machine: getCatalogItem(catalog.machines, machineId(value.machine), fallbackMachine),
    segments,
    upperTool: getCatalogItem(catalog.upperTools, value.upperTool, fallbackUpperTool).id,
    lowerTool: getCatalogItem(catalog.lowerTools, value.lowerTool, fallbackLowerTool).id,
  };
}

function NumericField({ label, value, onChange, unit, min = '0.001', max, error }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
      <span>{label}{unit ? ` (${unit})` : ''}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        value={value}
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
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function BendProfileEditor({ value, catalog = bendSimulatorCatalog, locale = 'en', onChange, onRequestReview }) {
  const isCn = locale === 'zh-CN' || locale === 'zh';
  const copy = isCn ? {
    title: '折弯工件设置',
    material: '材料', thickness: '板厚', width: '折弯长度', machine: '折弯机', upperTool: '上模', lowerTool: '下模',
    metric: '公制', imperial: '英制', segment: '折弯', length: '边长', angle: '成型角度', radius: '内 R',
    add: '添加折弯', remove: '删除折弯', moveUp: '上移', moveDown: '下移', review: '请 SAGEMRO AI 复核',
    invalid: '请输入大于 0 的数值。', invalidAngle: '请输入 0 到 180 之间的角度。', warning: '规划提示',
    mm: '毫米 (mm)', inch: '英寸 (in)',
  } : {
    title: 'Bend profile',
    material: 'Material', thickness: 'Thickness', width: 'Bend length', machine: 'Machine', upperTool: 'Upper tool', lowerTool: 'Lower tool',
    metric: 'Metric', imperial: 'Imperial', segment: 'Bend', length: 'Flange length', angle: 'Included angle', radius: 'Inside radius',
    add: 'Add bend', remove: 'Remove bend', moveUp: 'Move bend up', moveDown: 'Move bend down', review: 'Ask SAGEMRO AI to review',
    invalid: 'Enter a value greater than 0.', invalidAngle: 'Enter an angle from 0 to 180.', warning: 'Planning notes',
    mm: 'mm', inch: 'in',
  };
  const currentValue = normalizeProfileValue(value, catalog);
  const unit = currentValue.unitSystem === 'imperial' ? copy.inch : copy.mm;
  const warnings = value?.warnings || value?.result?.warnings || [];

  const emit = (next) => onChange?.(normalizeProfileValue(next, catalog));
  const updateGlobal = (field, rawValue) => {
    if ((field === 'thicknessMm' || field === 'sheetWidthMm') && Number(rawValue) <= 0) return;
    emit({ ...currentValue, [field]: rawValue });
  };
  const updateSegment = (index, field, rawValue) => {
    if ((field !== 'angleDeg' && Number(rawValue) <= 0) || (field === 'angleDeg' && (Number(rawValue) < 0 || Number(rawValue) > 180))) return;
    const segments = currentValue.segments.map((segment, segmentIndex) => (
      segmentIndex === index ? { ...segment, [field]: rawValue } : segment
    ));
    emit({ ...currentValue, segments });
  };
  const addSegment = () => emit({
    ...currentValue,
    segments: [...currentValue.segments, { ...DEFAULT_SEGMENT, insideRadiusMm: currentValue.thicknessMm }],
  });
  const removeSegment = (index) => {
    if (currentValue.segments.length === 1) return;
    emit({ ...currentValue, segments: currentValue.segments.filter((_, segmentIndex) => segmentIndex !== index) });
  };
  const moveSegment = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= currentValue.segments.length) return;
    const segments = [...currentValue.segments];
    [segments[index], segments[target]] = [segments[target], segments[index]];
    emit({ ...currentValue, segments });
  };
  const changeUnitSystem = (unitSystem) => {
    const convert = (dimension) => convertDimension(dimension, currentValue.unitSystem, unitSystem);
    emit({
      ...currentValue,
      unitSystem,
      thicknessMm: convert(currentValue.thicknessMm),
      sheetWidthMm: convert(currentValue.sheetWidthMm),
      segments: currentValue.segments.map((segment) => ({
        ...segment,
        lengthMm: convert(segment.lengthMm),
        insideRadiusMm: convert(segment.insideRadiusMm),
      })),
    });
  };

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{copy.title}</h2>
        <div className="inline-flex rounded-lg border border-[var(--color-border)] p-1" aria-label={isCn ? '单位制' : 'Unit system'}>
          {['metric', 'imperial'].map((unitSystem) => (
            <button
              key={unitSystem}
              type="button"
              onClick={() => changeUnitSystem(unitSystem)}
              aria-pressed={currentValue.unitSystem === unitSystem}
              className={`min-h-8 rounded-md px-3 text-xs font-semibold ${currentValue.unitSystem === unitSystem ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'}`}
            >
              {unitSystem === 'metric' ? copy.metric : copy.imperial}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SelectField label={copy.material} value={currentValue.material} onChange={(material) => updateGlobal('material', material)} options={Object.entries(catalog.materials).map(([value, item]) => ({ value, label: item.label }))} />
        <NumericField label={copy.thickness} value={currentValue.thicknessMm} unit={unit} onChange={(thicknessMm) => updateGlobal('thicknessMm', thicknessMm)} error={Number(value?.thicknessMm) <= 0 ? copy.invalid : null} />
        <NumericField label={copy.width} value={currentValue.sheetWidthMm} unit={unit} onChange={(sheetWidthMm) => updateGlobal('sheetWidthMm', sheetWidthMm)} error={Number(value?.sheetWidthMm) <= 0 ? copy.invalid : null} />
        <SelectField label={copy.machine} value={currentValue.machine.id} onChange={(machine) => updateGlobal('machine', machine)} options={catalog.machines.map((item) => ({ value: item.id, label: item.label }))} />
        <SelectField label={copy.upperTool} value={currentValue.upperTool} onChange={(upperTool) => updateGlobal('upperTool', upperTool)} options={catalog.upperTools.map((item) => ({ value: item.id, label: item.label }))} />
        <SelectField label={copy.lowerTool} value={currentValue.lowerTool} onChange={(lowerTool) => updateGlobal('lowerTool', lowerTool)} options={catalog.lowerTools.map((item) => ({ value: item.id, label: item.label }))} />
      </div>

      <div className="mt-6 space-y-3">
        {currentValue.segments.map((segment, index) => (
          <div key={`${segment.order}-${index}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.segment} {index + 1}</h3>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveSegment(index, -1)} disabled={index === 0} aria-label={copy.moveUp} className="rounded p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] disabled:opacity-40"><ChevronUp size={16} /></button>
                <button type="button" onClick={() => moveSegment(index, 1)} disabled={index === currentValue.segments.length - 1} aria-label={copy.moveDown} className="rounded p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] disabled:opacity-40"><ChevronDown size={16} /></button>
                <button type="button" onClick={() => removeSegment(index)} disabled={currentValue.segments.length === 1} aria-label={copy.remove} className="rounded p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-error,#b91c1c)] disabled:opacity-40"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumericField label={copy.length} value={segment.lengthMm} unit={unit} onChange={(lengthMm) => updateSegment(index, 'lengthMm', lengthMm)} error={Number(value?.segments?.[index]?.lengthMm) <= 0 ? copy.invalid : null} />
              <NumericField label={copy.angle} value={segment.angleDeg} unit="°" min="0" max="180" onChange={(angleDeg) => updateSegment(index, 'angleDeg', angleDeg)} error={Number(value?.segments?.[index]?.angleDeg) < 0 || Number(value?.segments?.[index]?.angleDeg) > 180 ? copy.invalidAngle : null} />
              <NumericField label={copy.radius} value={segment.insideRadiusMm} unit={unit} onChange={(insideRadiusMm) => updateSegment(index, 'insideRadiusMm', insideRadiusMm)} error={Number(value?.segments?.[index]?.insideRadiusMm) <= 0 ? copy.invalid : null} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => addSegment()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"><Plus size={16} />{copy.add}</button>
        <button type="button" onClick={() => onRequestReview?.(currentValue)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 text-sm font-semibold text-white"><Send size={16} />{copy.review}</button>
      </div>

      {warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3" role="status">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.warning}</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
            {warnings.map((warning) => <li key={warning.code || warning.message}>{warning.message || warning}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
