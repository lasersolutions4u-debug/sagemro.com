import { useEffect, useRef } from 'react';
import { Menu, Info, Home } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { WelcomePage } from './WelcomePage';
import { InputArea } from './InputArea';
import { Footer } from '../common/Footer';
import { isCnLocale } from '../../utils/locale';

export function ChatArea({
  messages,
  isStreaming,
  onSendMessage,
  onStopGeneration,
  onNewChat,
  currentTitle,
  onToggleSidebar,
  onOpenLegal,
  onOpenAbout,
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
  const isCn = isCnLocale();
  const serviceName = isCn ? 'SAGEMRO AI 设备服务平台' : 'SAGEMRO AI Equipment Service';
  const pageTitle = hasMessages
    ? (currentTitle || (isCn ? '服务对话' : 'Service conversation'))
    : serviceName;
  const subtitle = isCn
    ? '描述问题，AI 三分钟整理服务简报'
    : 'Describe the problem. AI prepares your service brief.';
  const aboutLabel = isCn ? '关于 SAGEMRO' : 'About SAGEMRO';
  const homeLabel = isCn ? '返回首页' : 'Back to start';
  const aiNotice = isCn
    ? 'AI 生成初步服务简报。最终诊断、报价和现场安全需经 SAGEMRO 服务流程确认。'
    : 'AI prepares the initial brief. Final diagnosis, pricing, and safety decisions follow the SAGEMRO service process.';
  const detailsLabel = isCn ? '详情' : 'Details';

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
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] sm:text-[17px] font-medium text-[var(--color-text-primary)] truncate">
            {pageTitle}
          </h1>
          {!hasMessages && (
            <p className="hidden sm:block text-[11px] text-[var(--color-text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
        {onOpenAbout && (
          <button
            onClick={onOpenAbout}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors"
          >
            <Info size={13} />
            {aboutLabel}
          </button>
        )}
        {hasMessages && (
          <button
            onClick={onNewChat}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 text-[11px] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15 transition-colors"
          >
            <Home size={13} />
            {homeLabel}
          </button>
        )}
      </header>

      {hasMessages && (
        <div className="px-3 sm:px-5 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 flex items-center justify-center gap-2">
          <Info size={12} className="text-[var(--color-text-muted)] flex-shrink-0" />
          <p className="text-[11px] text-[var(--color-text-secondary)] leading-tight">
            {aiNotice}
            {onOpenLegal && (
              <button
                onClick={() => onOpenLegal('ai')}
                className="ml-1 underline decoration-dotted underline-offset-2 hover:text-[var(--color-primary)] transition-colors"
              >
                {detailsLabel}
              </button>
            )}
          </p>
        </div>
      )}

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
          <WelcomePage />
        )}
      </div>

      <InputArea
        onSend={onSendMessage}
        onStop={onStopGeneration}
        disabled={false}
        isStreaming={isStreaming}
      />
      <div className="hidden sm:block border-t border-[var(--color-border)] bg-white/80 px-4 py-2">
        <Footer onOpenLegal={onOpenLegal} compact />
      </div>
    </div>
  );
}
