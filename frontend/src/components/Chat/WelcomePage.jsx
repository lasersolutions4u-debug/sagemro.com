import {
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { welcomePageCopy } from '../../data/welcomePageCopy.js';
import { isCnLocale } from '../../utils/locale';

export function WelcomePage() {
  const t = isCnLocale() ? welcomePageCopy.zh : welcomePageCopy.en;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-4xl">
        <BrandMark variant="logo" className="mx-auto mb-5 h-16 w-16 object-contain drop-shadow-[0_18px_36px_rgba(245,158,11,0.18)]" />

        <div className="text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            <ShieldCheck size={13} className="text-[var(--color-primary)]" />
            {t.eyebrow}
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[var(--color-text-primary)] sm:text-[42px]">
            {t.headline}
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
            {t.intro}
          </p>
        </div>

      </div>
    </div>
  );
}
