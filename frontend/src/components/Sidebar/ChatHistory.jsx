import { Trash2, Pencil } from 'lucide-react';
import { formatDate } from '../../utils/helpers';
import { useState } from 'react';

export function ChatHistory({ conversations, currentId, onSelect, onDelete }) {
  // 按日期分组
  const grouped = conversations.reduce((acc, conv) => {
    const date = formatDate(conv.updated_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(conv);
    return acc;
  }, {});

  const dateOrder = ['今天', '昨天', '近7天', '更早'];

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {dateOrder.map((date) => {
        const items = grouped[date];
        if (!items || items.length === 0) return null;

        return (
          <div key={date} className="mb-2">
            <div className="px-4 py-2 text-[12px] text-[var(--color-sidebar-muted)] font-medium uppercase tracking-wide">
              {date}
            </div>
            {items.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === currentId}
                onSelect={() => onSelect(conv)}
                onDelete={() => onDelete(conv.id)}
              />
            ))}
          </div>
        );
      })}

      {conversations.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
          暂无对话记录
        </div>
      )}
    </div>
  );
}

function ConversationItem({ conversation, isActive, onSelect, onDelete }) {
  const [showActions, setShowActions] = useState(false);

    return (
    <div
      className={`group relative px-4 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-[var(--color-ai-bubble)]'
          : 'hover:bg-[var(--color-hover)]'
      }`}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-text-muted)]'}`} />
        <span className="flex-1 text-[15px] text-[var(--color-sidebar-text)] truncate">
          {conversation.title || '新对话'}
        </span>
      </div>
      {conversation.last_message && (
        <p className="mt-0.5 pl-[18px] text-[13px] text-[var(--color-text-muted)] truncate">
          {conversation.last_message}
        </p>
      )}

      {/* 操作按钮 */}
      {showActions && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: 实现重命名
            }}
            className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-sidebar-text)]"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('确定删除这个对话吗？')) {
                onDelete();
              }
            }}
            className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
