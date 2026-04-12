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
    <div className="border-t border-[#f59e0b] dark:border-[#f59e0b] bg-white dark:bg-white px-3 sm:px-6 py-3 sm:py-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end gap-2 sm:gap-4">
          {/* 输入框 */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              disabled={disabled}
              rows={1}
              className="w-full px-4 sm:px-5 py-3 sm:py-4 pr-12 sm:pr-14 bg-[#f4f3f4] dark:bg-[#f4f3f4] border-2 border-[#f59e0b] dark:border-[#f59e0b] rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[#f59e0b] text-[#08060d] dark:text-[#08060d] placeholder-[#999999] disabled:opacity-50 text-[15px]"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
          </div>

          {/* 发送/停止按钮 */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors flex-shrink-0"
              title="停止生成"
            >
              <StopCircle size={20} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || disabled}
              className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-[#cccccc] disabled:opacity-50 text-white rounded-xl transition-colors flex-shrink-0 shadow-sm"
            >
              <Send size={20} />
            </button>
          )}
        </div>

        <p className="mt-2 text-[11px] text-center text-[#999999] hidden sm:block">
          Enter 发送消息 · Shift + Enter 换行
        </p>
      </div>
    </div>
  );
}
