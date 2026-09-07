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
  serviceRequestContext,
  onPrepareServiceRequest,
  onOpenServiceRequest,
  preparingRequest = false,
  prepareRequestError,
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
    ? '专为激光和成型设备打造的智能服务助手'
    : 'AI assistant specialized for laser and metal forming equipment.';
  const homeLabel = isCn ? '返回首页' : 'Back to start';
  const aiNotice = isCn
    ? '内容由 AI 生成，仅供参考。最终诊断、报价和现场安全需经 SAGEMRO 服务流程确认。'
    : 'AI-generated content is for reference only. Final diagnosis, pricing, and safety decisions follow the SAGEMRO service process.';
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

      {onPrepareServiceRequest && (hasMessages || serviceRequestContext) && (
        <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3" aria-label={isCn ? '整理服务请求' : 'Prepare a service request'}>
          {serviceRequestContext && <p className="mb-2 text-sm font-medium">{isCn ? '当前需求：' : 'Request context: '}{serviceRequestContext}</p>}
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{isCn ? '先描述设备和需求，AI 会协助梳理。点击下方按钮后整理您在聊天中提供的信息，再核对现有服务表单并提交。聊天图片请在表单中重新上传。' : 'Describe your equipment and needs. AI helps clarify the request. Use the button below to organize your chat details, then review and submit the existing service form. Please attach chat images again in the form.'}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onPrepareServiceRequest} disabled={preparingRequest || isStreaming || !messages.some((message) => message.role === 'user' && message.content?.trim())} className="min-h-11 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50">{preparingRequest ? (isCn ? '正在整理…' : 'Preparing…') : (isCn ? '整理并填写服务单' : 'Prepare service form')}</button>
            <button type="button" onClick={onOpenServiceRequest} disabled={preparingRequest} className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 text-sm">{isCn ? '直接手动填写' : 'Fill manually instead'}</button>
          </div>
          {prepareRequestError && <p role="alert" className="mt-2 text-sm text-red-600">{prepareRequestError}</p>}
        </section>
      )}

      <InputArea
        onSend={onSendMessage}
        onStop={onStopGeneration}
        disabled={preparingRequest}
        isStreaming={isStreaming}
      />
      <div className="hidden sm:block border-t border-[var(--color-border)] bg-white/80 px-4 py-2">
        <Footer onOpenLegal={onOpenLegal} compact />
      </div>
    </div>
  );
}
