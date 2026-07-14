export function NotFoundPage({ isCn = false }) {
  const copy = isCn
    ? {
        title: '页面不存在',
        body: '你访问的页面不存在，或者链接已经失效。',
        back: '返回 SAGEMRO',
      }
    : {
        title: 'Page not found',
        body: 'The page you requested does not exist or the link has expired.',
        back: 'Back to SAGEMRO',
      };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--color-bg)] px-5 text-[var(--color-text-primary)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-xl">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">404</div>
        <h1 className="mt-3 text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{copy.body}</p>
        <a href="/" className="mt-6 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white">{copy.back}</a>
      </div>
    </main>
  );
}
