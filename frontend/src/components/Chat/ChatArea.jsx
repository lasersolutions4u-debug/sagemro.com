import { useEffect, useRef } from 'react';
import { Menu, Info } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { WelcomePage } from './WelcomePage';
import { InputArea } from './InputArea';
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
}) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

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
          {currentTitle || '新对话'}
        </h1>
      </header>

      {/* AI 免责提示栏 */}
      <div className="px-3 sm:px-5 py-1.5 bg-amber-50 dark:bg-amber-900/15 border-b border-amber-200/50 dark:border-amber-800/30 flex items-center gap-2">
        <Info size={13} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-tight">
          AI 输出仅供参考，不构成维修承诺。线下服务以合伙人确认为准。
          {onOpenLegal && (
            <button
              onClick={() => onOpenLegal('ai')}
              className="ml-1 underline hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
            >
              详情
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
    </div>
  );
}
