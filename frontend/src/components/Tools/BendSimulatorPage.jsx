import { ArrowLeft, Calculator } from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { Footer } from '../common/Footer';

export function BendSimulatorPage({ tool, copy, onOpenLegal }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <BrandMark variant="logo" className="h-8 w-8 object-contain" />
            SAGEMRO
          </a>
          <nav className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <a href="/tools" className="hover:text-[var(--color-primary)]">{copy.navTools}</a>
            <a href="/" className="hover:text-[var(--color-primary)]">{copy.navChat}</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <a href="/tools" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
          <ArrowLeft size={16} />
          {copy.allTools}
        </a>
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6">
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
            <Calculator size={14} className="text-[var(--color-primary)]" />
            {copy.detailEyebrow}
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-[1.08] text-[var(--color-text-primary)] sm:text-[2.75rem]">{tool.seoTitle}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">{tool.guideBody}</p>
        </div>
      </main>

      <Footer onOpenLegal={onOpenLegal} />
    </div>
  );
}
