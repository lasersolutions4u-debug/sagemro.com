import { useMemo } from 'react';
import { ArrowRight, Ruler } from 'lucide-react';
import {
  buildIndustryToolReviewPrompt,
  calculateIndustryToolResult,
  defaultIndustryToolForms,
  getLocalizedAssistGasOptions,
  getLocalizedDustLoadOptions,
  getLocalizedMaterialDensities,
  getLocalizedShapeProfiles,
  getLocalizedSteelPriceReferences,
  getLocalizedTool,
  shapeProfiles,
  steelPriceReferences,
} from '../../data/industryTools';
import { isCnLocale } from '../../utils/locale';

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

const FIELD_LABELS_CN = {
  material: '材料',
  shape: '型材',
  quantity: '数量',
  lengthMm: '长度 (mm)',
  widthMm: '宽度 (mm)',
  thicknessMm: '厚度 (mm)',
  diameterMm: '直径 (mm)',
  outerDiameterMm: '外径 (mm)',
  wallThicknessMm: '壁厚 (mm)',
  heightMm: '高度 (mm)',
  legAMm: '边 A (mm)',
  legBMm: '边 B (mm)',
  flangeWidthMm: '翼缘宽度 (mm)',
  webThicknessMm: '腹板厚度 (mm)',
  flangeThicknessMm: '翼缘厚度 (mm)',
  referenceUsdPerTon: '参考价格 (USD / 公吨)',
  cutLengthM: '切割长度 (m)',
  cuttingSpeedMMin: '切割速度 (m/min)',
  pierces: '穿孔数量',
  pierceSeconds: '单次穿孔时间 (秒)',
  machineRateUsdHour: '设备小时费率 (USD/hr)',
  gasRateUsdHour: '气体费率 (USD/hr)',
  setupMinutes: '调机时间 (min)',
  materialFactor: '材料系数',
  bendLengthMm: '折弯长度 (mm)',
  vDieMm: 'V 槽开口 (mm)',
  safetyFactor: '安全系数',
  assistGas: '辅助气体',
  nozzleDiameterMm: '喷嘴直径 (mm)',
  pressureBar: '压力 (bar)',
  cuttingMinutes: '切割时间 (min)',
  dutyCyclePercent: '占空比 (%)',
  gasCostUsdM3: '气体单价 (USD / m3)',
  laserPowerKw: '激光功率 (kW)',
  insideRadiusMm: '内 R (mm)',
  bendAngleDeg: '折弯角度 (deg)',
  kFactor: 'K 因子',
  bendCount: '折弯次数',
  flangeAMm: '边长 A (mm)',
  flangeBMm: '边长 B (mm)',
  outsourceCostUsdMonth: '外协成本 (USD/月)',
  machinePaymentUsdMonth: '设备月供 (USD/月)',
  operatorCostUsdMonth: '操作人员成本 (USD/月)',
  maintenanceUsdMonth: '维护成本 (USD/月)',
  utilitiesUsdMonth: '水电气成本 (USD/月)',
  addedRevenueUsdMonth: '新增收入 (USD/月)',
  upfrontCostUsd: '前期投入 (USD)',
  tableLengthMm: '台面长度 (mm)',
  tableWidthMm: '台面宽度 (mm)',
  cuttingHoursDay: '每日切割小时数',
  dustLoad: '粉尘负荷',
};

function getFieldsForTool(toolId, values, profiles = shapeProfiles) {
  if (toolId === 'metal-weight') {
    return ['material', 'shape', ...profiles[values.shape || 'sheet_plate'].fields, 'quantity'];
  }

  if (toolId === 'steel-price') {
    return ['material', 'shape', ...profiles[values.shape || 'sheet_plate'].fields, 'quantity', 'referenceUsdPerTon'];
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
  const locale = isCnLocale() ? 'zh-CN' : 'en';
  const visibleTool = getLocalizedTool(tool, locale);
  const currentValues = values || defaultIndustryToolForms[tool.id];
  const result = useMemo(() => calculateIndustryToolResult(tool.id, currentValues, locale), [tool.id, currentValues, locale]);
  const materials = getLocalizedMaterialDensities(locale);
  const profiles = getLocalizedShapeProfiles(locale);
  const assistGases = getLocalizedAssistGasOptions(locale);
  const dustLoads = getLocalizedDustLoadOptions(locale);
  const priceReferences = locale === 'zh-CN' ? getLocalizedSteelPriceReferences(locale) : steelPriceReferences;
  const fieldLabels = locale === 'zh-CN' ? FIELD_LABELS_CN : FIELD_LABELS;
  const copy = locale === 'zh-CN'
    ? {
        eyebrow: '免费行业工具',
        profileNote: '型材说明',
        marketReferences: '市场参考',
        reviewButton: '让 SAGEMRO AI 帮我复核这个结果',
      }
    : {
        eyebrow: 'Free industry tool',
        profileNote: 'Profile note',
        marketReferences: 'Market references',
        reviewButton: 'Ask SAGEMRO AI to review this result',
      };
  const fields = getFieldsForTool(tool.id, currentValues, profiles);

  const updateValue = (name, value) => {
    onChange?.(name, value);
  };

  const sendForReview = () => {
    onSendMessage?.(buildIndustryToolReviewPrompt(visibleTool, result));
    onAfterSend?.();
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
        <div className="mb-4">
          <div className="text-xs uppercase text-[var(--color-text-muted)]">{copy.eyebrow}</div>
          <h3 className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{visibleTool.label}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{visibleTool.leadAction}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => {
            if (field === 'material') {
              return (
                <SelectField
                  key={field}
                  label={fieldLabels[field]}
                  value={currentValues.material}
                  onChange={(value) => updateValue('material', value)}
                  options={Object.entries(materials).map(([value, material]) => ({ value, label: material.label }))}
                />
              );
            }

            if (field === 'shape') {
              return (
                <SelectField
                  key={field}
                  label={fieldLabels[field]}
                  value={currentValues.shape}
                  onChange={(value) => updateValue('shape', value)}
                  options={Object.entries(profiles).map(([value, shape]) => ({ value, label: shape.label }))}
                />
              );
            }

            if (field === 'assistGas') {
              return (
                <SelectField
                  key={field}
                  label={fieldLabels[field]}
                  value={currentValues.assistGas}
                  onChange={(value) => updateValue('assistGas', value)}
                  options={Object.entries(assistGases).map(([value, gas]) => ({ value, label: gas.label }))}
                />
              );
            }

            if (field === 'dustLoad') {
              return (
                <SelectField
                  key={field}
                  label={fieldLabels[field]}
                  value={currentValues.dustLoad}
                  onChange={(value) => updateValue('dustLoad', value)}
                  options={Object.entries(dustLoads).map(([value, load]) => ({ value, label: load.label }))}
                />
              );
            }

            return (
              <InputField
                key={field}
                label={fieldLabels[field] || field}
                value={currentValues[field] || ''}
                onChange={(value) => updateValue(field, value)}
              />
            );
          })}
        </div>

        {(tool.id === 'metal-weight' || tool.id === 'steel-price') && (
          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
              {copy.profileNote}
            </div>
            <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {profiles[currentValues.shape || 'sheet_plate'].description}
            </p>
          </div>
        )}

        {tool.id === 'steel-price' && (
          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">{copy.marketReferences}</div>
            <div className="grid gap-2">
              {priceReferences.map((item) => (
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
            {copy.reviewButton}
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
