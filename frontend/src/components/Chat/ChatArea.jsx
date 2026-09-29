import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, Info, Home } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { WelcomePage } from './WelcomePage';
import { InputArea } from './InputArea';
import { Footer } from '../common/Footer';
import { isCnLocale } from '../../utils/locale';

function isNearChatBottom(element) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 48;
}

export function ChatArea({
  messages,
  conversationId,
  isStreaming,
  onSendMessage,
  onStopGeneration,
  onNewChat,
  currentTitle,
  onToggleSidebar,
  onOpenLegal,
}) {
  const messagesContainerRef = useRef(null);
  const pinnedToBottomRef = useRef(true);
  const viewedConversationRef = useRef(conversationId);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const hasMessages = messages.length > 0;

  const scrollChatToBottom = useCallback((behavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    pinnedToBottomRef.current = true;
    setShowNewMessages(false);
  }, []);

  useEffect(() => {
    if (viewedConversationRef.current === conversationId) return;
    viewedConversationRef.current = conversationId;
    pinnedToBottomRef.current = true;
    setShowNewMessages(false);
  }, [conversationId]);

  useEffect(() => {
    if (!hasMessages) {
      setShowNewMessages(false);
      return undefined;
    }
    if (pinnedToBottomRef.current) {
      const frame = requestAnimationFrame(() => {
        if (pinnedToBottomRef.current) scrollChatToBottom('auto');
      });
      return () => cancelAnimationFrame(frame);
    }
    setShowNewMessages(true);
    return undefined;
  }, [hasMessages, messages, scrollChatToBottom]);

  const handleChatScroll = () => {
    const nearBottom = isNearChatBottom(messagesContainerRef.current);
    pinnedToBottomRef.current = nearBottom;
    if (nearBottom) setShowNewMessages(false);
  };

  const isCn = isCnLocale();
  const serviceName = isCn ? 'SAGEMRO AI 设备服务平台' : 'SAGEMRO AI Equipment Service';
  const pageTitle = hasMessages
    ? (currentTitle || (isCn ? '服务对话' : 'Service conversation'))
    : serviceName;
  const subtitle = isCn
    ? '专为激光和成型设备打造的智能服务助手'
    : 'AI assistant specialized for laser and metal forming equipment.';
  const homeLabel = isCn ? '返回首页' : 'Back to start';
  const aiNotice = isCn
    ? '内容由 AI 生成，仅供参考。最终诊断、报价和现场安全需经 SAGEMRO 服务流程确认。'
    : 'AI-generated content is for reference only. Final diagnosis, pricing, and safety decisions follow the SAGEMRO service process.';
  const detailsLabel = isCn ? '详情' : 'Details';
  const newMessagesLabel = isCn ? '有新消息' : 'New messages';

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
      <div className="relative flex-1 min-h-0">
        <div
          ref={messagesContainerRef}
          onScroll={handleChatScroll}
          className="h-full overflow-y-auto px-4 py-6"
        >
          {hasMessages ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          ) : (
            <WelcomePage />
          )}
        </div>
        {showNewMessages && (
          <button
            type="button"
            onClick={() => scrollChatToBottom()}
            className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] shadow-sm"
          >
            <ChevronDown size={14} />
            {newMessagesLabel}
          </button>
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
