import { Plus } from 'lucide-react';
import { ChatHistory } from './ChatHistory';
import { ToolBar } from './ToolBar';
import { BrandMark } from '../common/BrandMark';

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
            <BrandMark className="h-9 w-9 shadow-sm" />
            <span className="text-[15px] font-medium text-[var(--color-sidebar-text)]">SAGEMRO</span>
          </div>

          {/* 新建服务接待 */}
          <button
            data-testid="new-chat-button"
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl transition-colors font-medium text-[13px] shadow-sm"
          >
            <Plus size={18} />
            <span>Start Service Chat</span>
          </button>
        </div>

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
