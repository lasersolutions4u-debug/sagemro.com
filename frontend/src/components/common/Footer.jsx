export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-sidebar)] px-4 py-3 text-center space-y-1">
      <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--color-text-muted)]">
        <a href="#" className="hover:text-[var(--color-primary)] transition-colors">用户服务协议</a>
        <span className="text-[var(--color-border)]">|</span>
        <a href="#" className="hover:text-[var(--color-primary)] transition-colors">隐私政策</a>
        <span className="text-[var(--color-border)]">|</span>
        <a href="#" className="hover:text-[var(--color-primary)] transition-colors">AI服务须知</a>
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)]">
        SageMRO 隶属于济南钰峭机械有限公司 (Jinan Euchio Machinery Co., Ltd.)
      </p>
    </footer>
  );
}
