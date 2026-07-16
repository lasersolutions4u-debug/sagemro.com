import { useMemo } from 'react';
import { ArrowRight, Ruler } from 'lucide-react';
import {
  assistGasOptions,
  buildIndustryToolReviewPrompt,
  calculateIndustryToolResult,
  defaultIndustryToolForms,
  dustLoadOptions,
  materialDensities,
  shapeProfiles,
  steelPriceReferences,
} from '../../data/industryTools';

const FIELD_LABELS = {
  material: 'Material',
  shape: 'Profile',
  quantity: 'Quantity',
  lengthMm: 'Length (mm)',
  widthMm: 'Width (mm)',
  thicknessMm: 'Thickness (mm)',
  diameterMm: 'Diameter (mm)',
  outerDiameterMm: 'Outer diameter (mm)',
  wallThicknessMm: 'Wall thickness (mm)',
  heightMm: 'Height (mm)',
  legAMm: 'Leg A (mm)',
  legBMm: 'Leg B (mm)',
  flangeWidthMm: 'Flange width (mm)',
  webThicknessMm: 'Web thickness (mm)',
  flangeThicknessMm: 'Flange thickness (mm)',
  referenceUsdPerTon: 'Reference price (USD / metric ton)',
  cutLengthM: 'Cut length (m)',
  cuttingSpeedMMin: 'Cutting speed (m/min)',
  pierces: 'Pierces',
  pierceSeconds: 'Pierce time (sec)',
  machineRateUsdHour: 'Machine rate (USD/hr)',
  gasRateUsdHour: 'Gas rate (USD/hr)',
  setupMinutes: 'Setup time (min)',
  materialFactor: 'Material factor',
  bendLengthMm: 'Bend length (mm)',
  vDieMm: 'V die opening (mm)',
  safetyFactor: 'Safety factor',
  assistGas: 'Assist gas',
  nozzleDiameterMm: 'Nozzle diameter (mm)',
  pressureBar: 'Pressure (bar)',
  cuttingMinutes: 'Cutting time (min)',
  dutyCyclePercent: 'Duty cycle (%)',
  gasCostUsdM3: 'Gas cost (USD / m3)',
  laserPowerKw: 'Laser power (kW)',
  insideRadiusMm: 'Inside radius (mm)',
  bendAngleDeg: 'Bend angle (deg)',
  kFactor: 'K-factor',
  bendCount: 'Bend count',
  flangeAMm: 'Flange A (mm)',
  flangeBMm: 'Flange B (mm)',
  outsourceCostUsdMonth: 'Outsource cost (USD/month)',
  machinePaymentUsdMonth: 'Machine payment (USD/month)',
  operatorCostUsdMonth: 'Operator cost (USD/month)',
  maintenanceUsdMonth: 'Maintenance (USD/month)',
  utilitiesUsdMonth: 'Utilities (USD/month)',
  addedRevenueUsdMonth: 'Added revenue (USD/month)',
  upfrontCostUsd: 'Upfront cost (USD)',
  tableLengthMm: 'Table length (mm)',
  tableWidthMm: 'Table width (mm)',
  cuttingHoursDay: 'Cutting hours/day',
  dustLoad: 'Dust load',
};

function getFieldsForTool(toolId, values) {
  if (toolId === 'metal-weight') {
    return ['material', 'shape', ...shapeProfiles[values.shape || 'sheet_plate'].fields, 'quantity'];
  }

  if (toolId === 'steel-price') {
    return ['material', 'shape', ...shapeProfiles[values.shape || 'sheet_plate'].fields, 'quantity', 'referenceUsdPerTon'];
  }

  if (toolId === 'laser-cost') {
    return ['cutLengthM', 'cuttingSpeedMMin', 'pierces', 'pierceSeconds', 'machineRateUsdHour', 'gasRateUsdHour', 'setupMinutes'];
  }

  if (toolId === 'press-brake-tonnage') {
    return ['thicknessMm', 'bendLengthMm', 'vDieMm', 'materialFactor', 'safetyFactor'];
  }

  if (toolId === 'gas-consumption') {
    return ['assistGas', 'nozzleDiameterMm', 'pressureBar', 'cuttingMinutes', 'dutyCyclePercent', 'gasCostUsdM3'];
  }

  if (toolId === 'cutting-speed') {
    return ['material', 'assistGas', 'thicknessMm', 'laserPowerKw'];
  }

  if (toolId === 'bend-allowance') {
    return ['thicknessMm', 'insideRadiusMm', 'bendAngleDeg', 'kFactor', 'bendCount', 'flangeAMm', 'flangeBMm'];
  }

  if (toolId === 'equipment-roi') {
    return ['outsourceCostUsdMonth', 'machinePaymentUsdMonth', 'operatorCostUsdMonth', 'maintenanceUsdMonth', 'utilitiesUsdMonth', 'addedRevenueUsdMonth', 'upfrontCostUsd'];
  }

  if (toolId === 'auxiliary-sizing') {
    return ['laserPowerKw', 'tableLengthMm', 'tableWidthMm', 'cuttingHoursDay', 'dustLoad'];
  }

  return [];
}

export function IndustryToolCalculator({ tool, values, onChange, onSendMessage, onAfterSend }) {
  const currentValues = values || defaultIndustryToolForms[tool.id];
  const result = useMemo(() => calculateIndustryToolResult(tool.id, currentValues), [tool.id, currentValues]);
  const fields = getFieldsForTool(tool.id, currentValues);

  const updateValue = (name, value) => {
    onChange?.(name, value);
  };

  const sendForReview = () => {
    onSendMessage?.(buildIndustryToolReviewPrompt(tool, result));
    onAfterSend?.();
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
        <div className="mb-4">
          <div className="text-xs uppercase text-[var(--color-text-muted)]">Free industry tool</div>
          <h3 className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{tool.label}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{tool.leadAction}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => {
            if (field === 'material') {
              return (
                <SelectField
                  key={field}
                  label={FIELD_LABELS[field]}
                  value={currentValues.material}
                  onChange={(value) => updateValue('material', value)}
                  options={Object.entries(materialDensities).map(([value, material]) => ({ value, label: material.label }))}
                />
              );
            }

            if (field === 'shape') {
              return (
                <SelectField
                  key={field}
                  label={FIELD_LABELS[field]}
                  value={currentValues.shape}
                  onChange={(value) => updateValue('shape', value)}
                  options={Object.entries(shapeProfiles).map(([value, shape]) => ({ value, label: shape.label }))}
                />
              );
            }

            if (field === 'assistGas') {
              return (
                <SelectField
                  key={field}
                  label={FIELD_LABELS[field]}
                  value={currentValues.assistGas}
                  onChange={(value) => updateValue('assistGas', value)}
                  options={Object.entries(assistGasOptions).map(([value, gas]) => ({ value, label: gas.label }))}
                />
              );
            }

            if (field === 'dustLoad') {
              return (
                <SelectField
                  key={field}
                  label={FIELD_LABELS[field]}
                  value={currentValues.dustLoad}
                  onChange={(value) => updateValue('dustLoad', value)}
                  options={Object.entries(dustLoadOptions).map(([value, load]) => ({ value, label: load.label }))}
                />
              );
            }

            return (
              <InputField
                key={field}
                label={FIELD_LABELS[field] || field}
                value={currentValues[field] || ''}
                onChange={(value) => updateValue(field, value)}
              />
            );
          })}
        </div>

        {(tool.id === 'metal-weight' || tool.id === 'steel-price') && (
          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
              Profile note
            </div>
            <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {shapeProfiles[currentValues.shape || 'sheet_plate'].description}
            </p>
          </div>
        )}

        {tool.id === 'steel-price' && (
          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">Market references</div>
            <div className="grid gap-2">
              {steelPriceReferences.map((item) => (
                <a
                  key={item.label}
                  href={item.url || undefined}
                  target={item.url ? '_blank' : undefined}
                  rel="noreferrer"
                  className="rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-xs leading-relaxed text-[var(--color-text-secondary)]"
                >
                  <strong className="block text-[var(--color-text-primary)]">{item.label}: {item.value}</strong>
                  {item.note}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Ruler size={18} className="text-[var(--color-primary)]" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">{result.title}</h3>
        </div>
        <div className="space-y-2">
          {result.rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 rounded-lg bg-[var(--color-surface)] px-3 py-2 text-sm">
              <span className="text-[var(--color-text-secondary)]">{label}</span>
              <strong className="text-right text-[var(--color-text-primary)]">{value}</strong>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">{result.note}</p>
        {onSendMessage && (
          <button
            type="button"
            onClick={sendForReview}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-primary-hover)]"
          >
            Review this result in service chat
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

function InputField({ label, value, onChange }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-primary)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-primary)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
