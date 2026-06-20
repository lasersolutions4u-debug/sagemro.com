import { Modal } from '../common/Modal';
import { BrandMark } from './BrandMark';
import {
  CheckCircle2,
  ClipboardCheck,
  Cog,
  Database,
  FileText,
  HeartPulse,
  MessageCircle,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

const serviceMoments = [
  { icon: MessageCircle, title: 'Start With A Conversation', desc: 'Describe the alarm, part, cut quality issue, maintenance need, or machine project in plain language.' },
  { icon: ClipboardCheck, title: 'Get Service-Ready Clarity', desc: 'SAGEMRO AI asks for missing details and organizes the case for confirmation.' },
  { icon: Wrench, title: 'Move To Official Action', desc: 'When diagnosis, quotation, parts, scheduling, or site safety matters, SAGEMRO official service takes over.' },
];

const conversationCapabilities = [
  'Fault diagnosis',
  'Cutting parameters',
  'Parts identification',
  'Repair estimate',
  'Machine selection',
  'Equipment health report',
];

const serviceStandards = [
  'One SAGEMRO service standard across AI guidance, service review, engineer work, and follow-up records',
  'Equipment records, chat context, service history, and reports stay connected for future support',
  'AI guidance speeds up preparation; final diagnosis, quote, and safety requirements are confirmed by SAGEMRO',
  'Parts, maintenance, lifecycle advice, and Euchio new-machine projects can grow naturally from the same service record',
];

export function AboutModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="About SAGEMRO Service OS" size="md">
      <div className="space-y-6">
        <div className="text-center py-2">
          <BrandMark className="mx-auto mb-3 h-16 w-16 shadow-lg shadow-amber-500/20" />
          <h2 className="text-xl font-medium text-[var(--color-text-primary)] mb-1">
            SAGEMRO Service OS
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            An AI-powered service front door for laser cutting and sheet metal equipment. You explain the situation once; SAGEMRO turns it into a clear path for diagnosis, parts, maintenance, service, or a new-machine project.
          </p>
        </div>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            How It Works
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {serviceMoments.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 p-3 bg-[var(--color-surface-elevated)] rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-[var(--color-text-primary)] mb-1">
                    {title}
                  </div>
                  <div className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            One Chat, Six Service Outcomes
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {conversationCapabilities.map((item) => (
              <div key={item} className="flex items-center gap-2 p-2 bg-[var(--color-surface-elevated)] rounded-lg">
                <Cog size={14} className="text-[var(--color-primary)] flex-shrink-0" />
                <span className="text-[12px] text-[var(--color-text-primary)]">{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
            These are handled inside the conversation. SAGEMRO recognizes the scenario, asks the right follow-up questions, and lets you confirm the structured information in chat.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            Service Standard
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
            { icon: Database, label: 'Connected equipment records' },
            { icon: FileText, label: 'Service reports and follow-up' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="p-3 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-xl flex items-center gap-2">
              <Icon size={16} className="text-[var(--color-primary)] flex-shrink-0" />
              <span className="text-[12px] text-[var(--color-text-primary)]">{label}</span>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
              <HeartPulse size={16} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Built For Long-Term Equipment Value
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                Each conversation can become a reusable service record: faster future troubleshooting, clearer parts decisions, better maintenance planning, and more confident equipment upgrade decisions.
              </p>
            </div>
          </div>
        </section>

        <div className="pt-4 border-t border-[var(--color-border)] text-center space-y-2">
          <p className="text-sm font-medium text-[var(--color-primary)]">
            You describe the machine. SAGEMRO turns it into a reliable next step.
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            © 2026 SAGEMRO. All rights reserved.
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            A product of Jinan Euchio Machinery Co., Ltd.
          </p>
        </div>
      </div>
    </Modal>
  );
}
