import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  ChartNoAxesCombined,
  CircleDollarSign,
  Factory,
  Ruler,
  Scale,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import {
  industryTools,
  materialDensities,
  parsePositiveNumber,
  roundNumber,
  steelPriceReferences,
} from '../../data/industryTools';

const toolIcons = {
  'metal-weight': Scale,
  'steel-price': ChartNoAxesCombined,
  'laser-cost': CircleDollarSign,
  'press-brake-tonnage': Factory,
};

const defaultForms = {
  'metal-weight': {
    material: 'carbon_steel',
    lengthMm: '3000',
    widthMm: '1500',
    thicknessMm: '6',
    quantity: '1',
  },
  'steel-price': {
    material: 'carbon_steel',
    referenceUsdPerTon: '760',
    requiredTons: '1',
  },
  'laser-cost': {
    cutLengthM: '120',
    cuttingSpeedMMin: '2.8',
    pierces: '80',
    pierceSeconds: '1.2',
    machineRateUsdHour: '55',
    gasRateUsdHour: '18',
    setupMinutes: '15',
  },
  'press-brake-tonnage': {
    materialFactor: '1',
    thicknessMm: '6',
    bendLengthMm: '3000',
    vDieMm: '48',
    safetyFactor: '1.2',
  },
};

function materialOption(key) {
  return materialDensities[key] || materialDensities.carbon_steel;
}

function calculateMetalWeight(values) {
  const material = materialOption(values.material);
  const lengthM = parsePositiveNumber(values.lengthMm) / 1000;
  const widthM = parsePositiveNumber(values.widthMm) / 1000;
  const thicknessM = parsePositiveNumber(values.thicknessMm) / 1000;
  const quantity = parsePositiveNumber(values.quantity, 1);
  const weightKg = lengthM * widthM * thicknessM * material.densityKgM3 * quantity;
  const priceUsd = (weightKg / 1000) * material.priceUsdPerTon;

  return {
    title: 'Estimated material weight',
    rows: [
      ['Material', material.label],
      ['Total weight', `${roundNumber(weightKg, 2)} kg / ${roundNumber(weightKg * 2.20462, 2)} lb`],
      ['Reference material value', `$${roundNumber(priceUsd, 2)} USD`],
      ['Basis', `${material.densityKgM3} kg/m3 density`],
    ],
    note: 'Weight and material value are estimates. Mill tolerance, coating, grade, and supplier minimums can change the real number.',
  };
}

function calculateSteelPrice(values) {
  const material = materialOption(values.material);
  const reference = parsePositiveNumber(values.referenceUsdPerTon, material.priceUsdPerTon);
  const tons = parsePositiveNumber(values.requiredTons, 1);

  return {
    title: 'Reference material budget',
    rows: [
      ['Material', material.label],
      ['Reference price', `$${roundNumber(reference, 2)} USD / metric ton`],
      ['Estimated material budget', `$${roundNumber(reference * tons, 2)} USD`],
      ['Required quantity', `${roundNumber(tons, 3)} metric tons`],
    ],
    note: 'Market reference for planning. Supplier quotes decide final purchasing cost. Confirm grade, tolerance, freight, taxes, and local availability before purchasing.',
  };
}

function calculateLaserCost(values) {
  const cutLengthM = parsePositiveNumber(values.cutLengthM);
  const speed = parsePositiveNumber(values.cuttingSpeedMMin, 1);
  const pierces = parsePositiveNumber(values.pierces);
  const pierceSeconds = parsePositiveNumber(values.pierceSeconds);
  const machineRate = parsePositiveNumber(values.machineRateUsdHour);
  const gasRate = parsePositiveNumber(values.gasRateUsdHour);
  const setupMinutes = parsePositiveNumber(values.setupMinutes);
  const cuttingMinutes = cutLengthM / speed;
  const pierceMinutes = (pierces * pierceSeconds) / 60;
  const totalMinutes = cuttingMinutes + pierceMinutes + setupMinutes;
  const hourlyCost = machineRate + gasRate;
  const cost = (totalMinutes / 60) * hourlyCost;

  return {
    title: 'Estimated laser cutting cost',
    rows: [
      ['Cutting time', `${roundNumber(cuttingMinutes, 1)} min`],
      ['Pierce time', `${roundNumber(pierceMinutes, 1)} min`],
      ['Total machine time', `${roundNumber(totalMinutes, 1)} min`],
      ['Estimated cost', `$${roundNumber(cost, 2)} USD`],
    ],
    note: 'This is a planning estimate. Nesting, material handling, assist gas pressure, scrap, deburring, and local labor rates can change the final price.',
  };
}

function calculatePressBrakeTonnage(values) {
  const thicknessMm = parsePositiveNumber(values.thicknessMm);
  const bendLengthMm = parsePositiveNumber(values.bendLengthMm);
  const vDieMm = parsePositiveNumber(values.vDieMm, thicknessMm * 8);
  const materialFactor = parsePositiveNumber(values.materialFactor, 1);
  const safetyFactor = parsePositiveNumber(values.safetyFactor, 1.2);
  const thicknessIn = thicknessMm / 25.4;
  const lengthFt = bendLengthMm / 304.8;
  const vDieIn = vDieMm / 25.4;
  const requiredTons = ((575 * thicknessIn * thicknessIn * lengthFt) / vDieIn) * materialFactor;
  const withSafety = requiredTons * safetyFactor;

  return {
    title: 'Estimated press brake tonnage',
    rows: [
      ['Required tonnage', `${roundNumber(requiredTons, 1)} tons`],
      ['With safety margin', `${roundNumber(withSafety, 1)} tons`],
      ['Suggested V opening', `${roundNumber(vDieMm, 1)} mm`],
      ['Formula basis', 'Air bending estimate for mild steel adjusted by material factor'],
    ],
    note: 'Confirm tooling, die condition, bend radius, material tensile strength, and machine rating before production.',
  };
}

function calculateResult(toolId, values) {
  if (toolId === 'metal-weight') return calculateMetalWeight(values);
  if (toolId === 'steel-price') return calculateSteelPrice(values);
  if (toolId === 'laser-cost') return calculateLaserCost(values);
  return calculatePressBrakeTonnage(values);
}

function buildReviewPrompt(tool, result) {
  const lines = result.rows.map(([label, value]) => `- ${label}: ${value}`).join('\n');
  return `Please review this ${tool.label} result as SAGEMRO AI.

${lines}

Explain what the result means, what assumptions may be risky, what information should be confirmed, and what practical next-step options the customer should consider. Keep the analysis neutral and do not push a vendor.`;
}

export function IndustryToolsModal({ isOpen, onClose, onSendMessage }) {
  const [activeToolId, setActiveToolId] = useState(industryTools[0].id);
  const [forms, setForms] = useState(defaultForms);
  const activeTool = industryTools.find((tool) => tool.id === activeToolId) || industryTools[0];
  const values = forms[activeToolId] || defaultForms[activeToolId];
  const result = useMemo(() => calculateResult(activeToolId, values), [activeToolId, values]);

  const updateValue = (name, value) => {
    setForms((current) => ({
      ...current,
      [activeToolId]: {
        ...(current[activeToolId] || defaultForms[activeToolId]),
        [name]: value,
      },
    }));
  };

  const sendForReview = () => {
    onSendMessage?.(buildReviewPrompt(activeTool, result));
    onClose?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Industry Tools" size="full">
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
          <div className="mb-3 flex items-center gap-2 px-1 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            <Calculator size={14} />
            Shop-floor calculators
          </div>
          <div className="grid gap-2">
            {industryTools.map((tool) => {
              const Icon = toolIcons[tool.id] || Calculator;
              const selected = tool.id === activeToolId;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveToolId(tool.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    selected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-transparent bg-[var(--color-surface)] hover:border-[var(--color-border)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                    <div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">{tool.label}</div>
                      <div className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">{tool.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <div className="mb-4">
              <div className="text-xs uppercase text-[var(--color-text-muted)]">Free industry tool</div>
              <h3 className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{activeTool.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{activeTool.leadAction}</p>
            </div>

            {activeToolId === 'metal-weight' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Material" value={values.material} onChange={(value) => updateValue('material', value)} />
                <InputField label="Quantity" value={values.quantity} onChange={(value) => updateValue('quantity', value)} />
                <InputField label="Length (mm)" value={values.lengthMm} onChange={(value) => updateValue('lengthMm', value)} />
                <InputField label="Width (mm)" value={values.widthMm} onChange={(value) => updateValue('widthMm', value)} />
                <InputField label="Thickness (mm)" value={values.thicknessMm} onChange={(value) => updateValue('thicknessMm', value)} />
              </div>
            )}

            {activeToolId === 'steel-price' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Material" value={values.material} onChange={(value) => updateValue('material', value)} />
                <InputField label="Reference price (USD / metric ton)" value={values.referenceUsdPerTon} onChange={(value) => updateValue('referenceUsdPerTon', value)} />
                <InputField label="Required quantity (metric tons)" value={values.requiredTons} onChange={(value) => updateValue('requiredTons', value)} />
              </div>
            )}

            {activeToolId === 'laser-cost' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <InputField label="Cut length (m)" value={values.cutLengthM} onChange={(value) => updateValue('cutLengthM', value)} />
                <InputField label="Cutting speed (m/min)" value={values.cuttingSpeedMMin} onChange={(value) => updateValue('cuttingSpeedMMin', value)} />
                <InputField label="Pierces" value={values.pierces} onChange={(value) => updateValue('pierces', value)} />
                <InputField label="Pierce time (sec)" value={values.pierceSeconds} onChange={(value) => updateValue('pierceSeconds', value)} />
                <InputField label="Machine rate (USD/hr)" value={values.machineRateUsdHour} onChange={(value) => updateValue('machineRateUsdHour', value)} />
                <InputField label="Gas rate (USD/hr)" value={values.gasRateUsdHour} onChange={(value) => updateValue('gasRateUsdHour', value)} />
                <InputField label="Setup time (min)" value={values.setupMinutes} onChange={(value) => updateValue('setupMinutes', value)} />
              </div>
            )}

            {activeToolId === 'press-brake-tonnage' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <InputField label="Thickness (mm)" value={values.thicknessMm} onChange={(value) => updateValue('thicknessMm', value)} />
                <InputField label="Bend length (mm)" value={values.bendLengthMm} onChange={(value) => updateValue('bendLengthMm', value)} />
                <InputField label="V die opening (mm)" value={values.vDieMm} onChange={(value) => updateValue('vDieMm', value)} />
                <InputField label="Material factor" value={values.materialFactor} onChange={(value) => updateValue('materialFactor', value)} />
                <InputField label="Safety factor" value={values.safetyFactor} onChange={(value) => updateValue('safetyFactor', value)} />
              </div>
            )}

            {activeToolId === 'steel-price' && (
              <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">Market references</div>
                <div className="grid gap-2">
                  {steelPriceReferences.map((item) => (
                    <a
                      key={item.label}
                      href={item.url || undefined}
                      target={item.url ? '_blank' : undefined}
                      rel="noreferrer"
                      className="rounded-xl bg-[var(--color-surface-elevated)] px-3 py-2 text-xs leading-relaxed text-[var(--color-text-secondary)]"
                    >
                      <strong className="block text-[var(--color-text-primary)]">{item.label}: {item.value}</strong>
                      {item.note}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Ruler size={18} className="text-[var(--color-primary)]" />
              <h3 className="font-semibold text-[var(--color-text-primary)]">{result.title}</h3>
            </div>
            <div className="space-y-2">
              {result.rows.map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 rounded-xl bg-[var(--color-surface)] px-3 py-2 text-sm">
                  <span className="text-[var(--color-text-secondary)]">{label}</span>
                  <strong className="text-right text-[var(--color-text-primary)]">{value}</strong>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">{result.note}</p>
            <button
              type="button"
              onClick={sendForReview}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-primary-hover)]"
            >
              Ask SAGEMRO AI to review this result
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
    </Modal>
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
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />
    </label>
  );
}

function SelectField({ label, value, onChange }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-primary)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      >
        {Object.entries(materialDensities).map(([key, material]) => (
          <option key={key} value={key}>{material.label}</option>
        ))}
      </select>
    </label>
  );
}
