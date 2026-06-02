import { useState, useEffect, useRef } from 'react';
import { Menu, Info, Gift } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { WelcomePage } from './WelcomePage';
import { InputArea } from './InputArea';
import { LeadForm } from './LeadForm';
import { Footer } from '../common/Footer';

export function ChatArea({
  messages,
  isStreaming,
  onSendMessage,
  onStopGeneration,
  onNewChat,
  currentTitle,
  onToggleSidebar,
  onOpenLegal,
  conversationId,
}) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [leadFormOpen, setLeadFormOpen] = useState(false);

  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-[var(--color-chat-bg)]">
      {/* 顶部栏 */}
      <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 border-b border-[var(--color-border)] bg-[var(--color-chat-bg)]">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-[var(--color-hover)] transition-colors"
        >
          <Menu size={20} className="text-[var(--color-text-secondary)]" />
        </button>
        <h1 className="flex-1 text-[15px] sm:text-[17px] font-medium text-[var(--color-text-primary)] truncate">
          {currentTitle || 'New Chat'}
        </h1>
      </header>

      {/* AI 免责提示栏 */}
      <div className="px-3 sm:px-5 py-1.5 bg-amber-50 dark:bg-amber-900/15 border-b border-amber-200/50 dark:border-amber-800/30 flex items-center gap-2">
        <Info size={13} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-tight">
          AI output is for reference only and does not constitute a repair commitment. On-site service is subject to engineer confirmation.
          {onOpenLegal && (
            <button
              onClick={() => onOpenLegal('ai')}
              className="ml-1 underline hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
            >
              Details
            </button>
          )}
        </p>
      </div>

      {/* 消息区域 */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        {hasMessages ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <WelcomePage onSendMessage={onSendMessage} />
        )}
      </div>

      {/* 输入区域 */}
      <InputArea
        onSend={onSendMessage}
        onStop={onStopGeneration}
        disabled={false}
        isStreaming={isStreaming}
      />
      {/* 页脚：桌面端显示 */}
      <div className="hidden sm:block">
        <Footer onOpenLegal={onOpenLegal} />
      </div>

      {/* 获取设备方案浮动按钮 */}
      {hasMessages && (
        <button
          onClick={() => setLeadFormOpen(true)}
          className="fixed bottom-24 right-4 sm:right-6 z-50 flex items-center gap-1.5 px-3.5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-full shadow-lg text-sm transition-colors active:scale-95"
        >
          <Gift size={16} />
          <span className="hidden sm:inline">Get a Quote</span>
          <span className="sm:hidden">Quote</span>
        </button>
      )}

      <LeadForm
        isOpen={leadFormOpen}
        onClose={() => setLeadFormOpen(false)}
        conversationId={conversationId}
      />
    </div>
  );
}
