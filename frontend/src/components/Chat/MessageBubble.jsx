import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, Copy, Check } from 'lucide-react';
import { formatTime } from '../../utils/helpers';

export function MessageBubble({ message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* 头像 */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-[var(--color-user-bubble)]' : 'bg-[var(--color-surface-elevated)]'
        }`}
      >
        {isUser ? (
          <User size={18} className="text-white" />
        ) : (
          <Bot size={18} className="text-[var(--color-text-secondary)]" />
        )}
      </div>

      {/* 消息内容 */}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-5 py-3.5 ${
            isUser
              ? 'bg-[var(--color-user-bubble)] text-[var(--color-user-bubble-text)] rounded-2xl shadow-sm'
              : 'bg-[var(--color-ai-bubble)] text-[var(--color-ai-text)] rounded-2xl shadow-md'
          }`}
        >
          <div className="prose prose-base max-w-none dark:prose-invert text-[15px] leading-relaxed font-light tracking-tight">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>

        {/* 底部信息 */}
        <div className={`flex items-center gap-2 mt-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[12px] text-[var(--color-text-muted)]">{formatTime(message.created_at)}</span>
          {!isUser && message.content && (
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] transition-colors"
              title="复制"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
