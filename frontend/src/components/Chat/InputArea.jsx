import { useState, useRef, useEffect } from 'react';
import { Send, StopCircle } from 'lucide-react';

export function InputArea({ onSend, onStop, disabled, isStreaming }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-chat-bg)] px-3 sm:px-6 py-3 sm:py-4 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start gap-3">
          {/* 输入框 - 外层容器实现圆角和边框 */}
          <div
            className={`input-wrapper flex-1 rounded-2xl transition-colors ${disabled ? 'opacity-50' : ''}`}
            style={{
              backgroundColor: 'var(--color-input-bg)',
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              disabled={disabled}
              rows={1}
              className="w-full px-4 py-3 bg-transparent resize-none focus:outline-none text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] disabled:opacity-50 text-[15px]"
              style={{
                minHeight: '48px',
                maxHeight: '200px',
              }}
            />
          </div>

          {/* 发送/停止按钮 - 与输入框顶部对齐 */}
          <div className="flex items-start">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="w-12 h-12 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-2xl transition-colors flex-shrink-0 active:scale-95"
                title="停止生成"
              >
                <StopCircle size={22} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || disabled}
                className="w-12 h-12 flex items-center justify-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-border)] disabled:opacity-50 text-white rounded-2xl transition-colors flex-shrink-0 active:scale-95"
              >
                <Send size={20} />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 text-[11px] text-center text-[var(--color-text-muted)] hidden sm:block">
          Enter 发送消息 · Shift + Enter 换行
        </p>
      </div>
    </div>
  );
}
