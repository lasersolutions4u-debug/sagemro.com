import { Modal } from '../common/Modal';
import {
  Bot,
  Users,
  Wallet,
  ShieldCheck,
  Target,
  Receipt,
  ClipboardCheck,
  Brain,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const painPoints = [
  {
    icon: Users,
    title: 'Hard to Find Engineers',
    desc: 'No reliable way to find qualified engineers. OEM service is overpriced, and freelance technicians lack accountability.',
  },
  {
    icon: Wallet,
    title: 'Opaque Pricing',
    desc: 'No standard pricing for repairs. Negotiations waste time, and overcharging is common.',
  },
  {
    icon: ShieldCheck,
    title: 'No Service Guarantee',
    desc: 'No warranty after repair. When issues arise, the technician disappears. No records to reference.',
  },
];

const comparisons = [
  {
    dim: 'Finding Engineers',
    legacy: 'Word of mouth / OEM agents',
    ours: 'AI matches the best-fit engineer',
  },
  {
    dim: 'Pricing',
    legacy: 'Verbal negotiation, opaque',
    ours: 'Platform-reviewed, AI-verified, transparent',
  },
  {
    dim: 'Service Guarantee',
    legacy: 'No records, no accountability',
    ours: 'Full work-order tracking, platform-guaranteed',
  },
  {
    dim: 'Knowledge Retention',
    legacy: 'None',
    ours: 'AI remembers every machine and every repair',
  },
  {
    dim: 'Data Value',
    legacy: 'None',
    ours: 'Regional pricing benchmarks, AI-powered estimates',
  },
];

const customerValue = [
  'No more searching for reliable engineers',
  'Transparent pricing with confidence',
  'Platform-backed service records and guarantees',
];

const engineerValue = [
  'Steady job flow from platform dispatch',
  'No haggling — AI-assisted quoting',
  'Rating system and tier progression to build your reputation',
];

export function AboutModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="About SAGEMRO AI" size="md">
      <div className="space-y-6">
        {/* Hero */}
        <div className="text-center py-2">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-3">
            <Bot size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-medium text-[var(--color-text-primary)] mb-1">
            SAGEMRO AI
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            AI-Powered After-Sales Platform for Sheet Metal Equipment · Connecting Customers and Engineers
          </p>
        </div>

        {/* 痛点 */}
        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            Problems We Solve
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {painPoints.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-3 bg-[var(--color-surface-elevated)] rounded-xl"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center mb-2">
                  <Icon size={16} className="text-[var(--color-primary)]" />
                </div>
                <div className="text-[13px] font-medium text-[var(--color-text-primary)] mb-1">
                  {title}
                </div>
                <div className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 解决方案流程 */}
        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            How It Works
          </h3>
          <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl">
            <div className="flex items-center justify-between gap-2 text-[12px] text-[var(--color-text-primary)] flex-wrap">
              <span className="px-2 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-md">Customer</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-md">SAGEMRO AI</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">Platform Match</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">Engineer</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">Quote & Approve</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">On-Site Service</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">Review & Close</span>
            </div>
            <p className="mt-3 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
              AI is the entry point. The platform is the guarantee. Data is the brain.
            </p>
          </div>
        </section>

        {/* 对比表 */}
        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            Traditional Approach vs SAGEMRO
          </h3>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[var(--color-surface-elevated)]">
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text-secondary)]">Dimension</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text-secondary)]">Traditional</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-primary)]">SAGEMRO</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row, i) => (
                  <tr
                    key={row.dim}
                    className={i % 2 === 0 ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-surface-elevated)]/50'}
                  >
                    <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{row.dim}</td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      <div className="flex items-start gap-1">
                        <XCircle size={13} className="text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
                        <span>{row.legacy}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      <div className="flex items-start gap-1">
                        <CheckCircle2 size={13} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                        <span>{row.ours}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 数据飞轮 */}
        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            Why AI Is Our Competitive Moat
          </h3>
          <div className="p-4 bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="flex items-center gap-2 p-2 bg-[var(--color-surface)] rounded-lg">
                <Brain size={16} className="text-[var(--color-primary)] flex-shrink-0" />
                <span className="text-[12px] text-[var(--color-text-primary)]">More data, smarter AI</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-[var(--color-surface)] rounded-lg">
                <Target size={16} className="text-[var(--color-primary)] flex-shrink-0" />
                <span className="text-[12px] text-[var(--color-text-primary)]">Smarter AI, greater trust</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-[var(--color-surface)] rounded-lg">
                <TrendingUp size={16} className="text-[var(--color-primary)] flex-shrink-0" />
                <span className="text-[12px] text-[var(--color-text-primary)]">More users, more data</span>
              </div>
            </div>
            <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
              Every completed work order, every confirmed quote, and every review enriches the platform's knowledge.
              Others can copy the interface, but they cannot replicate our data.
            </p>
          </div>
        </section>

        {/* 双端价值 */}
        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            Value for Both Sides
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Receipt size={16} className="text-[var(--color-primary)]" />
                <span className="text-[13px] font-medium text-[var(--color-text-primary)]">For Customers</span>
              </div>
              <ul className="space-y-1.5">
                {customerValue.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                    <CheckCircle2 size={12} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardCheck size={16} className="text-[var(--color-primary)]" />
                <span className="text-[13px] font-medium text-[var(--color-text-primary)]">For Engineers</span>
              </div>
              <ul className="space-y-1.5">
                {engineerValue.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                    <CheckCircle2 size={12} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Slogan + 版权 */}
        <div className="pt-4 border-t border-[var(--color-border)] text-center space-y-2">
          <p className="text-sm font-medium text-[var(--color-primary)]">
            Making After-Sales Service Effortless
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            © 2026 SageMRO. All rights reserved.
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            A product of Jinan Euchio Machinery Co., Ltd.
          </p>
        </div>
      </div>
    </Modal>
  );
}
