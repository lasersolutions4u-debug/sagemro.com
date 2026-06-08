export function Footer({ onOpenLegal, compact = false }) {
  if (compact) {
    return (
      <footer className="flex items-center justify-center gap-3 text-[11px] text-[var(--color-text-muted)]">
        <span>SAGEMRO by Jinan Euchio Machinery Co., Ltd.</span>
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
        SAGEMRO by Jinan Euchio Machinery Co., Ltd.
      </p>
    </footer>
  );
}
