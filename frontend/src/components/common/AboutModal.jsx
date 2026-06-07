import { Modal } from '../common/Modal';
import {
  Bot,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Cog,
  FileText,
  HeartPulse,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

const serviceFlow = [
  'AI preliminary diagnosis',
  'SAGEMRO review',
  'Official service request',
  'Engineer dispatch',
  'Service report',
  'Parts, maintenance, or Euchio machine upgrade follow-up',
];

const aiModules = [
  'Fault Diagnosis AI',
  'Cutting Parameters AI',
  'Parts Identification AI',
  'Repair Estimate AI',
  'Machine Selection AI',
  'Equipment Health Report AI',
];

const serviceStandards = [
  'One SAGEMRO service standard instead of loose marketplace matching',
  'Equipment records, service history, photos, and reports kept together',
  'AI output stays preliminary; final diagnosis and quotes require confirmation',
  'New-machine opportunities are routed to Euchio for project follow-up',
];

export function AboutModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="About SAGEMRO Service OS" size="md">
      <div className="space-y-6">
        <div className="text-center py-2">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-3">
            <Bot size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-medium text-[var(--color-text-primary)] mb-1">
            SAGEMRO Service OS
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            AI-powered diagnostics, official SAGEMRO service requests, equipment records, spare parts, maintenance plans, and Euchio new-machine conversion for laser and sheet metal equipment.
          </p>
        </div>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            What We Are Building
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Brain, title: 'AI Intake', desc: 'Structured tools convert symptoms, parameters, and selection needs into actionable records.' },
              { icon: Wrench, title: 'Official Service', desc: 'SAGEMRO receives requests and arranges the right internal engineer or certified service representative.' },
              { icon: HeartPulse, title: 'Lifecycle Value', desc: 'Every service can become parts, maintenance, health reports, or a Euchio upgrade opportunity.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
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

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            Service Flow
          </h3>
          <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {serviceFlow.map((item, index) => (
                <div key={item} className="flex items-center gap-2 text-[12px] text-[var(--color-text-primary)]">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-[10px] flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            AI Business Tools
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {aiModules.map((item) => (
              <div key={item} className="flex items-center gap-2 p-2 bg-[var(--color-surface-elevated)] rounded-lg">
                <Cog size={14} className="text-[var(--color-primary)] flex-shrink-0" />
                <span className="text-[12px] text-[var(--color-text-primary)]">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            Service Standards
          </h3>
          <div className="space-y-2">
            {serviceStandards.map((item) => (
              <div key={item} className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                <CheckCircle2 size={14} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: ShieldCheck, label: 'Safety-first AI boundaries' },
            { icon: ClipboardCheck, label: 'Structured service records' },
            { icon: FileText, label: 'Service reports and follow-up' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="p-3 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-xl flex items-center gap-2">
              <Icon size={16} className="text-[var(--color-primary)] flex-shrink-0" />
              <span className="text-[12px] text-[var(--color-text-primary)]">{label}</span>
            </div>
          ))}
        </section>

        <div className="pt-4 border-t border-[var(--color-border)] text-center space-y-2">
          <p className="text-sm font-medium text-[var(--color-primary)]">
            AI is the intake. SAGEMRO is the service standard. Data is the operating system.
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
