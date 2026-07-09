import { useEffect, useRef, useState } from 'react';
import { Send, StopCircle } from 'lucide-react';
import { isCnLocale } from '../../utils/locale';

export function InputArea({ onSend, onStop, disabled, isStreaming }) {
  const isCn = isCnLocale();
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || disabled) return;

    onSend(text);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim() && !disabled;
  const placeholder = isCn ? '描述设备问题' : 'Describe your service issue';

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-chat-bg)] px-3 py-3 pb-[env(safe-area-inset-bottom)] sm:px-6 sm:py-4">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start gap-2 sm:gap-3">
          <div
            className={`input-wrapper flex-1 rounded-2xl transition-colors ${disabled ? 'opacity-50' : ''}`}
            style={{ backgroundColor: 'var(--color-input-bg)' }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full resize-none bg-transparent px-4 py-3 text-[15px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
          </div>

          <div className="flex items-start">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500 text-white transition-colors hover:bg-red-600 active:scale-95"
                title={isCn ? '停止生成' : 'Stop generation'}
              >
                <StopCircle size={22} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend || disabled}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white transition-colors hover:bg-[var(--color-primary-hover)] active:scale-95 disabled:bg-[var(--color-border)] disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
