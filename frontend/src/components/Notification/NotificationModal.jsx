import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Bell, CheckCheck, FileText, DollarSign, Star, Wrench, ClipboardCheck } from 'lucide-react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/api';
import { isCnLocale } from '../../utils/locale';

const typeIcons = {
  new_ticket: FileText,
  ticket_accepted: ClipboardCheck,
  pricing_submitted: DollarSign,
  pricing_confirmed: DollarSign,
  ticket_resolved: Wrench,
  rating_received: Star,
};

const typeColors = {
  new_ticket: 'text-blue-500',
  ticket_accepted: 'text-green-500',
  pricing_submitted: 'text-orange-500',
  pricing_confirmed: 'text-green-500',
  ticket_resolved: 'text-purple-500',
  rating_received: 'text-yellow-500',
};

const COPY = {
  cn: {
    title: '通知',
    markAllRead: '全部标记为已读',
    loading: '加载中...',
    empty: '暂无通知',
    justNow: '刚刚',
    minuteAgo: '分钟前',
    hourAgo: '小时前',
    dayAgo: '天前',
  },
  en: {
    title: 'Notifications',
    markAllRead: 'Mark all as read',
    loading: 'Loading...',
    empty: 'No notifications',
    justNow: 'Just now',
    minuteAgo: 'm ago',
    hourAgo: 'h ago',
    dayAgo: 'd ago',
  },
};

function formatTime(dateStr, isCn) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'Z');
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const copy = isCn ? COPY.cn : COPY.en;
  if (diffMin < 1) return copy.justNow;
  if (diffMin < 60) return isCn ? `${diffMin}${copy.minuteAgo}` : `${diffMin}${copy.minuteAgo}`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return isCn ? `${diffHour}${copy.hourAgo}` : `${diffHour}${copy.hourAgo}`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return isCn ? `${diffDay}${copy.dayAgo}` : `${diffDay}${copy.dayAgo}`;
  return date.toLocaleDateString(isCn ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric' });
}

export function NotificationModal({ isOpen, onClose, onUnreadCountChange, onOpenWorkOrderDetail }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications(50, 0);
      setNotifications(data.notifications || []);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  const handleClickNotification = async (notif) => {
    // Mark as read
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setNotifications(prev =>
          prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n)
        );
        onUnreadCountChange?.(-1);
      } catch (e) {
        console.error('Failed to mark read:', e);
      }
    }

    // Navigate to work order if available
    const data = notif.data ? (typeof notif.data === 'string' ? JSON.parse(notif.data) : notif.data) : null;
    if (data?.work_order_id && onOpenWorkOrderDetail) {
      onOpenWorkOrderDetail(data.work_order_id);
      onClose();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      const unreadCount = notifications.filter(n => !n.is_read).length;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      onUnreadCountChange?.(-unreadCount);
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.title} size="md">
      <div className="flex flex-col gap-2">
        {/* 全部已读按钮 */}
        {hasUnread && (
          <div className="flex justify-end mb-1">
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-[12px] text-[var(--color-primary)] hover:underline"
            >
              <CheckCheck size={14} />
              {copy.markAllRead}
            </button>
          </div>
        )}

        {/* 通知列表 */}
        {loading ? (
          <div className="py-12 text-center text-[var(--color-text-secondary)] text-[14px]">
            {copy.loading}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell size={36} className="mx-auto text-[var(--color-text-secondary)] opacity-30 mb-3" />
            <div className="text-[14px] text-[var(--color-text-secondary)]">{copy.empty}</div>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-1">
            {notifications.map((notif) => {
              const Icon = typeIcons[notif.type] || Bell;
              const colorClass = typeColors[notif.type] || 'text-[var(--color-text-secondary)]';

              return (
                <button
                  key={notif.id}
                  onClick={() => handleClickNotification(notif)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors hover:bg-[var(--color-hover)] ${
                    !notif.is_read ? 'bg-[var(--color-primary)]/5' : ''
                  }`}
                >
                  {/* 图标 */}
                  <div className={`mt-0.5 flex-shrink-0 ${colorClass}`}>
                    <Icon size={18} />
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                        {notif.title}
                      </span>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">
                      {notif.body}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-secondary)] opacity-60 mt-1">
                      {formatTime(notif.created_at, isCn)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
