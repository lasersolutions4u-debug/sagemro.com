import { Plus, Bot, User, LogOut } from 'lucide-react';
import { ChatHistory } from './ChatHistory';
import { ToolBar } from './ToolBar';

export function Sidebar({
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
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
  isOpen,
  onClose,
}) {
  return (
    <>
      {/* 移动端遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[300px] bg-[var(--color-sidebar)] flex flex-col transform transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 顶部 */}
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-sm">
              <Bot size={22} className="text-white" />
            </div>
            <span className="text-[15px] font-medium text-[var(--color-sidebar-text)]">小智</span>
          </div>

          {/* 新建对话按钮 */}
          <button
            data-testid="new-chat-button"
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl transition-colors font-medium text-[13px] shadow-sm"
          >
            <Plus size={18} />
            <span>新建对话</span>
          </button>
        </div>

        {/* 分隔线1: 新建对话 与 对话历史之间 */}
        <div className="border-t border-[var(--color-border)] mx-4" />

        {/* 聊天历史 */}
        <ChatHistory
          conversations={conversations}
          currentId={currentConversationId}
          onSelect={onSelectConversation}
          onDelete={onDeleteConversation}
          onRename={onRenameConversation}
        />

        {/* 底部工具 */}
        <div className="p-2">
          <ToolBar
            onOpenWorkOrder={onOpenWorkOrder}
            onOpenMyWorkOrders={onOpenMyWorkOrders}
            onOpenSettings={onOpenSettings}
            onOpenAbout={onOpenAbout}
            onOpenLogin={onOpenLogin}
            onLogout={onLogout}
            onOpenEngineerDashboard={onOpenEngineerDashboard}
            onOpenMyDevices={onOpenMyDevices}
            onOpenNotifications={onOpenNotifications}
            unreadCount={unreadCount}
            currentUser={currentUser}
            userType={userType}
          />
        </div>
      </aside>
    </>
  );
}
