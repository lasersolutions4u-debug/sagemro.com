import { getCurrentUiText } from '../../i18n/uiText';

export function Footer({ onOpenLegal, compact = false }) {
  const t = getCurrentUiText().footer;

  if (compact) {
    return (
      <footer className="flex items-center justify-center gap-3 text-[11px] text-[var(--color-text-muted)]">
        <span>{t.company}</span>
        <span className="text-[var(--color-border)]">|</span>
        <button onClick={() => onOpenLegal?.('agreement')} className="hover:text-[var(--color-primary)] transition-colors">{t.terms}</button>
        <button onClick={() => onOpenLegal?.('privacy')} className="hover:text-[var(--color-primary)] transition-colors">{t.privacy}</button>
        <button onClick={() => onOpenLegal?.('ai')} className="hover:text-[var(--color-primary)] transition-colors">{t.aiNotice}</button>
      </footer>
    );
  }

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-sidebar)] px-4 py-3 text-center space-y-1">
      <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--color-text-muted)]">
        <button onClick={() => onOpenLegal?.('agreement')} className="hover:text-[var(--color-primary)] transition-colors">{t.termsFull}</button>
        <span className="text-[var(--color-border)]">|</span>
        <button onClick={() => onOpenLegal?.('privacy')} className="hover:text-[var(--color-primary)] transition-colors">{t.privacyFull}</button>
        <span className="text-[var(--color-border)]">|</span>
        <button onClick={() => onOpenLegal?.('ai')} className="hover:text-[var(--color-primary)] transition-colors">{t.aiNoticeFull}</button>
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)]">
        {t.company}
      </p>
    </footer>
  );
}
