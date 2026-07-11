import {
  Bell,
  BookOpen,
  ClipboardList,
  FileText,
  History,
  LogIn,
  LogOut,
  Package,
  Plus,
  Settings,
  User,
  Wrench,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { isCnLocale } from '../../utils/locale';

export function Sidebar({
  onNewChat,
  onOpenHistory,
  onOpenIndustryTools,
  onOpenWorkOrder,
  onOpenMyWorkOrders,
  onOpenSettings,
  onOpenLogin,
  onLogout,
  onOpenEngineerDashboard,
  onOpenMyDevices,
  onOpenNotifications,
  unreadCount,
  currentUser,
  userType,
  isOpen,
  onClose,
}) {
  const isCn = isCnLocale();
  const isEngineer = userType === 'engineer';
  const accountAction = isEngineer ? onOpenEngineerDashboard : onOpenSettings;
  const baseTools = [
    { icon: Plus, label: isCn ? '新对话' : 'New Chat', onClick: onNewChat, testid: 'new-chat-button', primary: true },
    { icon: History, label: isCn ? '历史' : 'History', onClick: onOpenHistory, testid: 'tool-history' },
    { icon: Wrench, label: isCn ? '工具' : 'Tools', onClick: onOpenIndustryTools, testid: 'tool-industry-tools' },
    { icon: BookOpen, label: isCn ? '洞察' : 'Insights', href: '/insights', testid: 'tool-insights' },
  ];
  const customerTools = currentUser
    ? [
        { icon: FileText, label: isCn ? '服务' : 'Request Service', onClick: onOpenWorkOrder, testid: 'tool-create-work-order' },
        { icon: ClipboardList, label: isCn ? '工单' : 'My Services', onClick: onOpenMyWorkOrders, testid: 'tool-my-work-orders' },
        { icon: Package, label: isCn ? '设备' : 'My Equipment', onClick: onOpenMyDevices, testid: 'tool-my-devices' },
        { icon: Bell, label: isCn ? '通知' : 'Notifications', onClick: onOpenNotifications, testid: 'tool-notifications', badge: unreadCount },
      ]
    : [];
  const engineerTools = currentUser
    ? [
        { icon: ClipboardList, label: isCn ? '任务' : 'Assigned Services', onClick: onOpenMyWorkOrders, testid: 'tool-my-work-orders' },
        { icon: Bell, label: isCn ? '通知' : 'Notifications', onClick: onOpenNotifications, testid: 'tool-notifications', badge: unreadCount },
      ]
    : [];
  const tools = [...baseTools, ...(isEngineer ? engineerTools : customerTools)];

  const rail = (
    <aside className="flex h-full w-[72px] flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-sidebar)] px-2 py-3">
      <BrandMark className="mb-3 h-10 w-10 shadow-sm" />
      <div className="flex w-full flex-1 flex-col items-center gap-2">
        {tools.map((tool) => (
          <RailButton key={tool.label} tool={tool} onClick={() => { tool.onClick?.(); onClose?.(); }} />
        ))}
      </div>
      <div className="flex w-full flex-col items-center gap-2 border-t border-[var(--color-border)] pt-3">
        {currentUser ? (
          <>
            <RailButton
              tool={{ icon: User, label: currentUser.name || (isCn ? '账号' : 'Account'), onClick: accountAction, testid: 'user-avatar-button' }}
              onClick={() => { accountAction?.(); onClose?.(); }}
            />
            <RailButton
              tool={{ icon: LogOut, label: isCn ? '退出' : 'Log Out', onClick: onLogout, testid: 'logout-button' }}
              onClick={onLogout}
            />
          </>
        ) : (
          <RailButton
            tool={{ icon: LogIn, label: isCn ? '登录' : 'Sign In / Register', onClick: onOpenLogin, testid: 'sidebar-login-button' }}
            onClick={() => { onOpenLogin?.(); onClose?.(); }}
          />
        )}
      </div>
    </aside>
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <div className="hidden lg:block">{rail}</div>
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {rail}
      </div>
    </>
  );
}
function RailButton({ tool, onClick }) {
  const Icon = tool.icon || Settings;
  if (tool.href) {
    return (
      <a
        href={tool.href}
        title={tool.label}
        data-testid={tool.testid || `tool-${tool.label}`}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--color-sidebar-muted)] transition hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)]"
      >
        <Icon size={20} />
        <span className="sr-only">{tool.label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      title={tool.label}
      data-testid={tool.testid || `tool-${tool.label}`}
      onClick={onClick}
      className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition ${
        tool.primary
          ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
          : 'text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)]'
      }`}
    >
      <Icon size={20} />
      <span className="sr-only">{tool.label}</span>
      {tool.badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
          {tool.badge > 99 ? '99+' : tool.badge}
        </span>
      )}
    </button>
  );
}
