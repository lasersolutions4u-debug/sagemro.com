import { FileText, ClipboardList, Settings, Info, LogIn, LogOut, Briefcase, Package, Bell } from 'lucide-react';

export function ToolBar({
  onOpenWorkOrder,
  onOpenMyWorkOrders,
  onOpenSettings,
  onOpenAbout,
  onOpenLogin,
  onLogout,
  onOpenEngineerDashboard,
  onOpenMyDevices,
  onOpenNotifications,
  unreadCount,
  currentUser,
  userType,
}) {
  // 仅登录客户可见的工具
  const customerTools = [
    { icon: FileText, label: '新建工单', onClick: onOpenWorkOrder },
    { icon: ClipboardList, label: '我的工单', onClick: onOpenMyWorkOrders },
    { icon: Package, label: '我的设备', onClick: onOpenMyDevices },
  ];

  // 所有人都能看到的工具
  const commonTools = [
    { icon: Info, label: '关于小智', onClick: onOpenAbout },
  ];

  // 合伙人额外工具
  const engineerTools = userType === 'engineer' ? [
    { icon: Briefcase, label: '合伙人管理台', onClick: onOpenEngineerDashboard },
  ] : [];

  // 筛选工具：客户看 customerTools，合伙人看前两个
  const visibleTools = userType === 'engineer'
    ? customerTools.slice(0, 2) // 合伙人只显示：新建工单、我的工单
    : customerTools;

  return (
    <div className="border-t border-[#3a3a4c] pt-3 mt-auto">
      {/* 会员工具入口（需登录） */}
      {currentUser && visibleTools.map((tool) => (
        <button
          key={tool.label}
          onClick={tool.onClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
        >
          <tool.icon size={17} />
          <span>{tool.label}</span>
        </button>
      ))}

      {/* 消息通知（登录用户可见） */}
      {currentUser && (
        <button
          onClick={onOpenNotifications}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
        >
          <div className="relative">
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-medium rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span>消息通知</span>
          {unreadCount > 0 && (
            <span className="ml-auto text-[11px] text-red-400 font-medium">{unreadCount}</span>
          )}
        </button>
      )}

      {/* 通用工具入口（所有人可见） */}
      {commonTools.map((tool) => (
        <button
          key={tool.label}
          onClick={tool.onClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
        >
          <tool.icon size={17} />
          <span>{tool.label}</span>
        </button>
      ))}

      {/* 合伙人管理台入口（在"我的工单"下面） */}
      {engineerTools.map((tool) => (
        <button
          key={tool.label}
          onClick={tool.onClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-primary)] hover:bg-[var(--color-sidebar-surface)] rounded-lg mx-1 transition-colors font-medium"
        >
          <tool.icon size={17} />
          <span>{tool.label}</span>
        </button>
      ))}

      {/* 登录/用户区域 */}
      <div className="border-t border-[#3a3a4c] mt-3 pt-3">
        {currentUser ? (
          <>
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center gap-1 px-2 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-medium">
                  {currentUser.name?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="truncate">{currentUser.name}</span>
              {userType === 'engineer' && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded">合伙人</span>
              )}
            </button>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
            >
              <LogOut size={17} />
              <span>退出登录</span>
            </button>
          </>
        ) : (
          <button
            onClick={onOpenLogin}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
          >
            <LogIn size={17} />
            <span>登录/注册</span>
          </button>
        )}
      </div>
    </div>
  );
}
