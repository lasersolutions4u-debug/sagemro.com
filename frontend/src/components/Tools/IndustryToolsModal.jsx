import { useState } from 'react';
import {
  Calculator,
  ChartNoAxesCombined,
  CircleDollarSign,
  Factory,
  Scale,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { IndustryToolCalculator } from './IndustryToolCalculator';
import {
  defaultIndustryToolForms,
  industryTools,
} from '../../data/industryTools';

const toolIcons = {
  'metal-weight': Scale,
  'steel-price': ChartNoAxesCombined,
  'laser-cost': CircleDollarSign,
  'press-brake-tonnage': Factory,
};

export function IndustryToolsModal({ isOpen, onClose, onSendMessage }) {
  const [activeToolId, setActiveToolId] = useState(industryTools[0].id);
  const [forms, setForms] = useState(defaultIndustryToolForms);
  const activeTool = industryTools.find((tool) => tool.id === activeToolId) || industryTools[0];
  const values = forms[activeToolId] || defaultIndustryToolForms[activeToolId];

  const updateValue = (name, value) => {
    setForms((current) => ({
      ...current,
      [activeToolId]: {
        ...(current[activeToolId] || defaultIndustryToolForms[activeToolId]),
        [name]: value,
      },
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Industry Tools" size="full">
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
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
                  className={`rounded-lg border p-3 text-left transition ${
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

        <IndustryToolCalculator
          tool={activeTool}
          values={values}
          onChange={updateValue}
          onSendMessage={onSendMessage}
          onAfterSend={onClose}
        />
      </div>
    </Modal>
  );
}
