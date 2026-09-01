import { ServiceRequestFlow } from './ServiceRequestFlow';

export function ServiceRequestPage({
  onSubmit,
  onBack,
  onSuccess,
  initialDraft,
  market,
  mode,
  conversationId,
  isAuthenticated,
  onRequireAuth,
}) {
  const returnToWorkspace = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window === 'undefined') return;
    if (window.history.length > 1) window.history.back();
    else window.location.assign('/');
  };

  return (
    <main className="min-h-dvh bg-[var(--color-background)] px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-7">
        <ServiceRequestFlow
          onSubmit={onSubmit}
          onCancel={returnToWorkspace}
          onSuccess={onSuccess}
          initialDraft={initialDraft}
          market={market}
          mode={mode}
          conversationId={conversationId}
          isAuthenticated={isAuthenticated}
          onRequireAuth={onRequireAuth}
        />
      </div>
      <p className="mx-auto mt-4 max-w-4xl text-center text-xs text-[var(--color-text-muted)]">
        support@sagemro.com
      </p>
    </main>
  );
}
