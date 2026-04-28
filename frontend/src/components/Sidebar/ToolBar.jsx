import { FileText, ClipboardList, Info, LogIn, LogOut, Package, Bell, MoreHorizontal, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

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
  const [showMore, setShowMore] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const check = () => setCollapsed(window.innerHeight < 750);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const isEngineer = userType === 'engineer';

  const primaryTools = isEngineer
    ? [
        { icon: ClipboardList, label: '我的工单', onClick: onOpenMyWorkOrders },
      ]
    : [
        { icon: FileText, label: '新建工单', onClick: onOpenWorkOrder },
        { icon: ClipboardList, label: '我的工单', onClick: onOpenMyWorkOrders },
      ];

  const extraTools = isEngineer
    ? [
        { icon: Bell, label: '消息通知', badge: unreadCount, onClick: () => { onOpenNotifications?.(); setShowMore(false); } },
      ]
    : [
        { icon: Package, label: '我的设备', onClick: () => { onOpenMyDevices?.(); setShowMore(false); } },
        { icon: Bell, label: '消息通知', badge: unreadCount, onClick: () => { onOpenNotifications?.(); setShowMore(false); } },
      ];

  const showCollapsed = currentUser && collapsed && extraTools.length >= 2;

  const avatarAction = isEngineer ? onOpenEngineerDashboard : onOpenSettings;

  const toolBtn = (tool) => (
    <button
      key={tool.label}
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
      <button
        onClick={onOpenAbout}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
      >
        <Info size={17} />
        <span>关于小智</span>
      </button>

      {currentUser && primaryTools.map((tool) => toolBtn(tool))}

      {currentUser && !showCollapsed && extraTools.map((tool) => toolBtn(tool))}

      {showCollapsed && (
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setShowMore(!showMore)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)] rounded-lg mx-1 transition-colors"
          >
            {showMore ? <X size={17} /> : <MoreHorizontal size={17} />}
            <span>更多</span>
            {unreadCount > 0 && (
              <span className="ml-auto w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-medium rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showMore && (
            <div className="absolute bottom-full left-0 right-0 mb-1 mx-1 bg-[var(--color-sidebar-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-50">
              {extraTools.map((tool) => (
                <button
                  key={tool.label}
                  onClick={tool.onClick}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar)] hover:text-[var(--color-sidebar-text)] transition-colors"
                >
                  <tool.icon size={17} />
                  <span>{tool.label}</span>
                  {tool.badge > 0 && (
                    <span className="ml-auto text-[10px] text-red-400 font-medium">{tool.badge}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User area */}
      <div className="border-t border-[var(--color-border)] mt-3 pt-3">
        {currentUser ? (
          <>
            <button
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
                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded">工程师</span>
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
