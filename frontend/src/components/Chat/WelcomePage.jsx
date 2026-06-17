import {
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';

const aiCapabilities = [
  'Fault intake',
  'Parts request',
  'Maintenance review',
  'Service readiness',
  'Machine selection',
  'Follow-up records',
];

const trustPoints = [
  'Bring alarms, photos, parts, maintenance, and machine projects into one service conversation',
  'Move from scattered symptoms to a case your team and SAGEMRO can act on',
  'Get AI speed with official SAGEMRO confirmation for diagnosis, quote, and site safety',
];

export function WelcomePage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-4xl">
        <BrandMark className="mx-auto mb-6 h-16 w-16 shadow-lg shadow-amber-500/20" />

        <div className="text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            <ShieldCheck size={13} className="text-[var(--color-primary)]" />
            SAGEMRO Service OS
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[var(--color-text-primary)] sm:text-[42px]">
            When equipment stops, the next step should be clear.
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
            Tell SAGEMRO what is happening on site. From the first message, we help shape the issue into a reliable path toward diagnosis, parts, maintenance, service, or a new-machine decision.
          </p>
        </div>

        <div className="mx-auto mt-7 max-w-3xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 text-left shadow-sm sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/12 text-[var(--color-primary)]">
              <ClipboardCheck size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Start with a message. Leave with a service direction.
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)] sm:text-sm">
                You speak naturally. SAGEMRO keeps the details organized in the background and brings the key points back for your confirmation in chat.
              </p>
            </div>
          </div>
          <div className="grid gap-2 text-xs leading-relaxed text-[var(--color-text-secondary)] sm:grid-cols-3">
            {trustPoints.map((item) => (
              <div key={item} className="flex gap-2 rounded-2xl bg-[var(--color-surface)] px-3 py-2.5">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {aiCapabilities.map((label) => (
              <span key={label} className="rounded-full border border-[var(--color-border)] bg-[var(--color-chat-bg)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-primary)]">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
