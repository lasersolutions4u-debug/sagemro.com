import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { getWorkOrderMessages, postWorkOrderMessage } from '../../services/api';
import { toastError } from '../../utils/feedback';

export function MessagePanel({ workOrderId, userType, userId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => {
    getWorkOrderMessages(workOrderId).then(d => {
      setMessages(d.list || []);
    }).catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [workOrderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await postWorkOrderMessage(workOrderId, {
        sender_type: userType,
        sender_id: userId,
        content: input.trim(),
        message_type: 'text',
      });
      setInput('');
      load();
    } catch (e) {
      toastError('发送失败: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="max-h-64 overflow-y-auto space-y-2 p-2 bg-[var(--color-surface-elevated)] rounded-xl">
        {messages.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--color-text-muted)]">暂无消息，开始对话吧</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_type === userType;
            const isSystem = msg.sender_type === 'system';
            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)] px-3 py-1 rounded-full">
                    {msg.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-[var(--color-primary)] text-white rounded-br-md'
                    : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] rounded-bl-md'
                }`}>
                  {!isMe && msg.sender_name && (
                    <div className="text-xs opacity-70 mb-0.5">{msg.sender_name}</div>
                  )}
                  <div>{msg.content}</div>
                  <div className={`text-xs mt-1 ${isMe ? 'text-white/50 text-right' : 'text-[var(--color-text-muted)]'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
          className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="px-3 py-2 bg-[var(--color-primary)] disabled:opacity-40 text-white rounded-xl"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
