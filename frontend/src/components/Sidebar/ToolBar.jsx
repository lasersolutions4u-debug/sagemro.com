import { FileText, ClipboardList, Settings, Info, LogIn, LogOut, Briefcase } from 'lucide-react';

export function ToolBar({
  onOpenWorkOrder,
  onOpenMyWorkOrders,
  onOpenSettings,
  onOpenAbout,
  onOpenLogin,
  onLogout,
  onOpenEngineerDashboard,
  currentUser,
  userType,
}) {
  const tools = [
    { icon: FileText, label: '提交工单', onClick: onOpenWorkOrder },
    { icon: ClipboardList, label: '我的工单', onClick: onOpenMyWorkOrders },
    { icon: Settings, label: '设置', onClick: onOpenSettings },
    { icon: Info, label: '关于小智', onClick: onOpenAbout },
  ];

  // 工程师额外工具
  const engineerTools = userType === 'engineer' ? [
    { icon: Briefcase, label: '工程师工作台', onClick: onOpenEngineerDashboard },
  ] : [];

  return (
    <div className="border-t border-[#333333] pt-3 mt-auto">
      {/* 工程师工作台入口 */}
      {engineerTools.map((tool) => (
        <button
          key={tool.label}
          onClick={tool.onClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#f59e0b] hover:bg-[#252525] rounded-lg mx-1 transition-colors font-medium"
        >
          <tool.icon size={17} />
          <span>{tool.label}</span>
        </button>
      ))}

      {tools.map((tool) => (
        <button
          key={tool.label}
          onClick={tool.onClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#d4d4d4] hover:bg-[#252525] hover:text-[#f5f5f5] rounded-lg mx-1 transition-colors"
        >
          <tool.icon size={17} />
          <span>{tool.label}</span>
        </button>
      ))}

      {/* 登录/用户区域 */}
      <div className="border-t border-[#333333] mt-3 pt-3">
        {currentUser ? (
          <>
            <div className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#d4d4d4]">
              <div className="w-6 h-6 rounded-full bg-[#f59e0b] flex items-center justify-center">
                <span className="text-white text-xs font-medium">
                  {currentUser.name?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="flex-1 truncate">{currentUser.name}</span>
              {userType === 'engineer' && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[#f59e0b]/20 text-[#f59e0b] rounded">工程师</span>
              )}
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#d4d4d4] hover:bg-[#252525] hover:text-[#f5f5f5] rounded-lg mx-1 transition-colors"
            >
              <LogOut size={17} />
              <span>退出登录</span>
            </button>
          </>
        ) : (
          <button
            onClick={onOpenLogin}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#d4d4d4] hover:bg-[#252525] hover:text-[#f5f5f5] rounded-lg mx-1 transition-colors"
          >
            <LogIn size={17} />
            <span>登录/注册</span>
          </button>
        )}
      </div>
    </div>
  );
}
