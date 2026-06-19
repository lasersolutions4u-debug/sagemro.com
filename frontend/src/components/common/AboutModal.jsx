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
import { getCurrentUiText } from '../../i18n/uiText';

const serviceMomentIcons = [MessageCircle, ClipboardCheck, Wrench];
const pillarIcons = [ShieldCheck, Database, FileText];

export function AboutModal({ isOpen, onClose }) {
  const text = getCurrentUiText();
  const t = text.about;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.title} size="md">
      <div className="space-y-6">
        <div className="text-center py-2">
          <BrandMark className="mx-auto mb-3 h-16 w-16 shadow-lg shadow-amber-500/20" />
          <h2 className="text-xl font-medium text-[var(--color-text-primary)] mb-1">
            SAGEMRO Service OS
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {t.intro}
          </p>
        </div>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            {t.how}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {t.moments.map(([title, desc], index) => {
              const Icon = serviceMomentIcons[index] || MessageCircle;
              return (
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
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            {t.outcomes}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {text.welcome.capabilities.map((item) => (
              <div key={item} className="flex items-center gap-2 p-2 bg-[var(--color-surface-elevated)] rounded-lg">
                <Cog size={14} className="text-[var(--color-primary)] flex-shrink-0" />
                <span className="text-[12px] text-[var(--color-text-primary)]">{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
            {t.outcomesDesc}
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            {t.standard}
          </h3>
          <div className="space-y-2">
            {t.standards.map((item) => (
              <div key={item} className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                <CheckCircle2 size={14} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {t.pillars.map((label, index) => {
            const Icon = pillarIcons[index] || ShieldCheck;
            return (
            <div key={label} className="p-3 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-xl flex items-center gap-2">
              <Icon size={16} className="text-[var(--color-primary)] flex-shrink-0" />
              <span className="text-[12px] text-[var(--color-text-primary)]">{label}</span>
            </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
              <HeartPulse size={16} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                {t.valueTitle}
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                {t.valueBody}
              </p>
            </div>
          </div>
        </section>

        <div className="pt-4 border-t border-[var(--color-border)] text-center space-y-2">
          <p className="text-sm font-medium text-[var(--color-primary)]">
            {t.tagline}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t.rights}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {t.product}
          </p>
        </div>
      </div>
    </Modal>
  );
}
