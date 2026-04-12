import { useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { WelcomePage } from './WelcomePage';
import { InputArea } from './InputArea';

export function ChatArea({
  messages,
  isStreaming,
  onSendMessage,
  onStopGeneration,
  onNewChat,
  currentTitle,
  onToggleSidebar,
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
    <div className="flex flex-col h-full bg-[#f9fafb] dark:bg-[#181825]">
      {/* 顶部栏 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#e5e4e7] dark:border-[#3a3a4c] bg-white dark:bg-[#181825]">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-[#f4f3f4] dark:hover:bg-[#2a2a3c] transition-colors"
        >
          <Menu size={20} className="text-[#6b6375]" />
        </button>
        <h1 className="flex-1 text-lg font-medium text-[#08060d] dark:text-[#f3f4f6] truncate">
          {currentTitle || '新对话'}
        </h1>
      </header>

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
    </div>
  );
}
