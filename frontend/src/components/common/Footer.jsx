import { isCnLocale } from '../../utils/locale';

const ICP_RECORD_NUMBER = '鲁ICP备2026032904号-1';

export function Footer({ onOpenLegal, compact = false }) {
  const isCn = isCnLocale();
  const companyLine = isCn
    ? 'SAGEMRO 由济南钰峭机械有限公司运营'
    : 'SAGEMRO operated by Jinan Euchio Machinery Co., Ltd.';
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
        <span>{companyLine}</span>
        {icpLink}
        <span className="text-[var(--color-border)]">|</span>
        <button onClick={() => onOpenLegal?.('agreement')} className="hover:text-[var(--color-primary)] transition-colors">用户协议</button>
        <button onClick={() => onOpenLegal?.('privacy')} className="hover:text-[var(--color-primary)] transition-colors">隐私政策</button>
        <button onClick={() => onOpenLegal?.('ai')} className="hover:text-[var(--color-primary)] transition-colors">AI 说明</button>
      </footer>
    );
  }

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-sidebar)] px-4 py-3 text-center space-y-1">
      <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--color-text-muted)]">
        <button onClick={() => onOpenLegal?.('agreement')} className="hover:text-[var(--color-primary)] transition-colors">用户协议</button>
        <span className="text-[var(--color-border)]">|</span>
        <button onClick={() => onOpenLegal?.('privacy')} className="hover:text-[var(--color-primary)] transition-colors">隐私政策</button>
        <span className="text-[var(--color-border)]">|</span>
        <button onClick={() => onOpenLegal?.('ai')} className="hover:text-[var(--color-primary)] transition-colors">AI 服务说明</button>
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)]">
        {companyLine}
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
