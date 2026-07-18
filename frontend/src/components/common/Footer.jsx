import { isCnLocale } from '../../utils/locale';

const ICP_RECORD_NUMBER = '鲁ICP备2026032904号-1';

export function Footer({ onOpenLegal, compact = false }) {
  const isCn = isCnLocale();
  const companyLine = '© 2026 SAGEMRO — AI-powered equipment service platform';
  const companyLineCn = '© 2026 SAGEMRO — AI 驱动的设备服务平台';
  const legalLabel = isCn ? '规则与说明' : 'Terms, Privacy & AI Notice';
  const icpLink = isCn ? (
    <>
      <span className="text-[var(--color-border)]">|</span>
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noreferrer"
        className="hover:text-[var(--color-primary)] transition-colors"
      >
        {ICP_RECORD_NUMBER}
      </a>
    </>
  ) : null;

  if (compact) {
    return (
      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
        <span>{isCn ? companyLineCn : companyLine}</span>
        {icpLink}
        <span className="text-[var(--color-border)]">|</span>
        <button onClick={() => onOpenLegal?.('agreement')} className="hover:text-[var(--color-primary)] transition-colors">{legalLabel}</button>
      </footer>
    );
  }

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-sidebar)] px-4 py-3 text-center space-y-1">
      <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--color-text-muted)]">
        <button onClick={() => onOpenLegal?.('agreement')} className="hover:text-[var(--color-primary)] transition-colors">{legalLabel}</button>
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)]">
        {isCn ? companyLineCn : companyLine}
      </p>
      {isCn && (
        <p className="text-[10px] text-[var(--color-text-muted)]">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--color-primary)] transition-colors"
          >
            {ICP_RECORD_NUMBER}
          </a>
        </p>
      )}
    </footer>
  );
}
