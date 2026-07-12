import { FileText, ClipboardList, LogIn, LogOut, Package, Bell } from 'lucide-react';
import { isCnLocale } from '../../utils/locale';

const TOOLBAR_COPY = {
  cn: {
    loginLabel: '登录 / 注册',
    requestService: '请求服务',
    myServices: '我的服务',
    assignedServices: '已派工服务',
    notifications: '通知',
    myEquipment: '我的设备',
    engineerBadge: 'SAGEMRO 工程师',
    logout: '退出登录',
  },
  en: {
    loginLabel: 'Sign In / Register',
    requestService: 'Request Service',
    myServices: 'My Services',
    assignedServices: 'Assigned Services',
    notifications: 'Notifications',
    myEquipment: 'My Equipment',
    engineerBadge: 'SAGEMRO Engineer',
    logout: 'Log Out',
  },
};

export function ToolBar({
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
}) {
  const copy = isCnLocale() ? TOOLBAR_COPY.cn : TOOLBAR_COPY.en;
  const isEngineer = userType === 'engineer';

  const primaryTools = isEngineer
    ? [
        { icon: ClipboardList, label: copy.assignedServices, onClick: onOpenMyWorkOrders, testid: 'tool-my-work-orders' },
      ]
    : [
        { icon: FileText, label: copy.requestService, onClick: onOpenWorkOrder, testid: 'tool-create-work-order' },
        { icon: ClipboardList, label: copy.myServices, onClick: onOpenMyWorkOrders, testid: 'tool-my-work-orders' },
      ];

  const extraTools = isEngineer
    ? [
        { icon: Bell, label: copy.notifications, badge: unreadCount, testid: 'tool-notifications', onClick: onOpenNotifications },
      ]
    : [
        { icon: Bell, label: copy.notifications, badge: unreadCount, testid: 'tool-notifications', onClick: onOpenNotifications },
        { icon: Package, label: copy.myEquipment, testid: 'tool-my-devices', onClick: onOpenMyDevices },
      ];

  const avatarAction = isEngineer ? onOpenEngineerDashboard : onOpenSettings;
  const hasTools = Boolean(currentUser);

  const toolBtn = (tool) => (
    <button
      key={tool.label}
      data-testid={tool.testid || `tool-${tool.label}`}
      onClick={tool.onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
    >
      <tool.icon size={17} />
      <span>{tool.label}</span>
      {tool.badge > 0 && (
        <span className="ml-auto w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-medium rounded-full">
          {tool.badge > 99 ? '99+' : tool.badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="border-t border-[var(--color-border)] pt-3 mt-auto">
      {currentUser && primaryTools.map((tool) => toolBtn(tool))}

      {currentUser && extraTools.map((tool) => toolBtn(tool))}

      {/* User area */}
      <div className={hasTools ? 'border-t border-[var(--color-border)] mt-3 pt-3' : ''}>
        {currentUser ? (
          <>
            <button
              data-testid="user-avatar-button"
              onClick={avatarAction}
              className="w-full flex items-center gap-1 px-2 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-medium">
                  {currentUser.name?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="truncate">{currentUser.name}</span>
              {isEngineer && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded">{copy.engineerBadge}</span>
              )}
            </button>
            <button
              data-testid="logout-button"
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
            >
              <LogOut size={17} />
              <span>{copy.logout}</span>
            </button>
          </>
        ) : (
          <button
            data-testid="sidebar-login-button"
            onClick={onOpenLogin}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
          >
            <LogIn size={17} />
            <span>{copy.loginLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
