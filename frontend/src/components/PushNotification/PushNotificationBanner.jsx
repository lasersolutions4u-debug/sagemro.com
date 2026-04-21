import { useEffect } from 'react';
import { X, Bell } from 'lucide-react';

export function PushNotificationBanner({ notification, onDismiss }) {
  useEffect(() => {
    if (!notification?.data?.work_order_id) return;

    const handler = (e) => {
      const { workOrderId } = e.detail;
      onDismiss();
      window.location.href = `/my-tickets/${workOrderId}`;
    };

    window.addEventListener('navigate-to-work-order', handler);
    return () => window.removeEventListener('navigate-to-work-order', handler);
  }, [notification, onDismiss]);

  if (!notification) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] max-w-sm bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl shadow-2xl
                 flex items-start gap-3 p-4 cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
      onClick={() => {
        if (notification.data?.work_order_id) {
          onDismiss();
          window.location.href = `/my-tickets/${notification.data.work_order_id}`;
        }
      }}
    >
      <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
        <Bell size={20} className="text-[var(--color-primary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--color-text-primary)] mb-0.5">
          {notification.title}
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">
          {notification.body}
        </div>
        <div className="text-xs text-[var(--color-primary)] mt-1">
          点击查看工单 →
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex-shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
