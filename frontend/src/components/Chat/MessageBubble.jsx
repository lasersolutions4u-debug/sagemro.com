import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Copy, Check, X } from 'lucide-react';
import { formatTime, normalizeMarkdownTable } from '../../utils/helpers';
import { isCnLocale } from '../../utils/locale';

export function MessageBubble({ message }) {
  const [copied, setCopied] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);
  const isCn = isCnLocale();
  const isUser = message.role === 'user';
  const hasImages = message.images && message.images.length > 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
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
            {/* 图片展示 */}
            {hasImages && (
              <div className={`grid gap-1.5 mb-2 ${message.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {message.images.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={isCn ? `上传图片 ${i + 1}` : `Uploaded image ${i + 1}`}
                    className="rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setPreviewImg(url)}
                    loading="lazy"
                  />
                ))}
              </div>
            )}

            {/* 文字内容 */}
            {message.content && (
              <div className="prose prose-base max-w-none dark:prose-invert text-[15px] leading-relaxed font-light tracking-tight">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeMarkdownTable(message.content)}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* 底部信息 */}
          <div className={`flex items-center gap-2 mt-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[12px] text-[var(--color-text-muted)]">{formatTime(message.created_at)}</span>
            {!isUser && message.content && (
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] transition-colors"
                title={isCn ? '复制' : 'Copy'}
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 全屏图片预览 */}
      {previewImg && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setPreviewImg(null)}
        >
          <button
            onClick={() => setPreviewImg(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={previewImg}
            alt={isCn ? '图片预览' : 'Preview'}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
