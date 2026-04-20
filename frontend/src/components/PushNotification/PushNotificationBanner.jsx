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
      className="fixed top-4 right-4 z-[9999] max-w-sm bg-[#2a2a3c] border border-[#3a3a4c] rounded-xl shadow-2xl
                 flex items-start gap-3 p-4 cursor-pointer hover:bg-[#323248] transition-colors"
      onClick={() => {
        if (notification.data?.work_order_id) {
          onDismiss();
          window.location.href = `/my-tickets/${notification.data.work_order_id}`;
        }
      }}
    >
      <div className="w-10 h-10 rounded-full bg-[#f59e0b]/20 flex items-center justify-center flex-shrink-0">
        <Bell size={20} className="text-[#f59e0b]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#f3f4f6] mb-0.5">
          {notification.title}
        </div>
        <div className="text-xs text-[#9a9aaf]">
          {notification.body}
        </div>
        <div className="text-xs text-[#f59e0b] mt-1">
          点击查看工单 →
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="text-[#6b6375] hover:text-[#9a9aaf] flex-shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
