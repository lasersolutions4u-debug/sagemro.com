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
    <div className="border-t border-[#e5e4e7] dark:border-[#3a3a4c] bg-white dark:bg-[#181825] p-5">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end gap-4">
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
              className="w-full px-5 py-4 pr-14 bg-[#f4f3f4] dark:bg-[#2a2a3c] border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[#1677ff] text-[#08060d] dark:text-[#f3f4f6] placeholder-[#6b6375] disabled:opacity-50 text-[16px]"
              style={{ minHeight: '56px', maxHeight: '200px' }}
            />
          </div>

          {/* 发送/停止按钮 */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="w-12 h-12 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors flex-shrink-0"
              title="停止生成"
            >
              <StopCircle size={20} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || disabled}
              className="w-12 h-12 flex items-center justify-center bg-[#1677ff] hover:bg-[#4096ff] disabled:bg-[#6b6375] disabled:opacity-50 text-white rounded-xl transition-colors flex-shrink-0"
            >
              <Send size={20} />
            </button>
          )}
        </div>

        <p className="mt-2 text-xs text-center text-[#6b6375]">
          Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </div>
  );
}
