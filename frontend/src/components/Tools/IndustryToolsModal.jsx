import {
  Calculator,
  ChartNoAxesCombined,
  CircleDollarSign,
  Gauge,
  ExternalLink,
  Factory,
  Fan,
  Flame,
  Ruler,
  Scale,
  Snowflake,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { industryTools } from '../../data/industryTools';

const toolIcons = {
  'metal-weight': Scale,
  'steel-price': ChartNoAxesCombined,
  'laser-cost': CircleDollarSign,
  'press-brake-tonnage': Factory,
  'gas-consumption': Flame,
  'cutting-speed': Gauge,
  'bend-allowance': Ruler,
  'equipment-roi': CircleDollarSign,
  'auxiliary-sizing': Snowflake,
};

export function IndustryToolsModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Industry Tools" size="2xl">
      <div>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
              <Calculator size={14} className="text-[var(--color-primary)]" />
              Shop-floor tools
            </div>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
              Quick references for weight, cost, speed, bending, ROI, and auxiliary equipment checks.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/tools"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              All tools
              <ExternalLink size={13} />
            </a>
            <a
              href="/insights"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              Insights
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {industryTools.map((tool) => {
            const Icon = toolIcons[tool.id] || Fan;
            return (
              <a
                key={tool.id}
                href={`/tools/${tool.slug}`}
                className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold leading-5 text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)]">
                      {tool.shortLabel || tool.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">
                      {tool.description}
                    </span>
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
