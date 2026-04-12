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
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* 头像 */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-[#1677ff]' : 'bg-[#f4f3f4] dark:bg-[#2a2a3c]'
        }`}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-[#6b6375]" />
        )}
      </div>

      {/* 消息内容 */}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-[#1677ff] text-white rounded-br-md'
              : 'bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#e0e0e0] rounded-bl-md shadow-sm'
          }`}
        >
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>

        {/* 底部信息 */}
        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-[#6b6375]">{formatTime(message.created_at)}</span>
          {!isUser && message.content && (
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-[#f4f3f4] dark:hover:bg-[#2a2a3c] text-[#6b6375] transition-colors"
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
