import { Plus, Bot } from 'lucide-react';
import { ChatHistory } from './ChatHistory';
import { ToolBar } from './ToolBar';

export function Sidebar({
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onOpenWorkOrder,
  onOpenMyWorkOrders,
  onOpenSettings,
  onOpenAbout,
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
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[300px] bg-[#1e1e2e] flex flex-col transform transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 顶部 */}
        <div className="p-4 border-b border-[#2a2a3c]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#1677ff] flex items-center justify-center">
              <Bot size={24} className="text-white" />
            </div>
            <span className="text-lg font-medium text-[#cdd6f4]">小智</span>
          </div>

          {/* 新建对话按钮 */}
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1677ff] hover:bg-[#4096ff] text-white rounded-xl transition-colors font-medium"
          >
            <Plus size={18} />
            <span>新建对话</span>
          </button>
        </div>

        {/* 聊天历史 */}
        <ChatHistory
          conversations={conversations}
          currentId={currentConversationId}
          onSelect={onSelectConversation}
          onDelete={onDeleteConversation}
        />

        {/* 底部工具 */}
        <div className="p-2">
          <ToolBar
            onOpenWorkOrder={onOpenWorkOrder}
            onOpenMyWorkOrders={onOpenMyWorkOrders}
            onOpenSettings={onOpenSettings}
            onOpenAbout={onOpenAbout}
          />
        </div>
      </aside>
    </>
  );
}
