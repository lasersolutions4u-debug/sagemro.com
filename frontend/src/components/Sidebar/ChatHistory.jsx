import { Trash2, Pencil, Check, X } from 'lucide-react';
import { formatDate } from '../../utils/helpers';
import { toastError, confirmDialog } from '../../utils/feedback';
import { useState, useRef, useEffect } from 'react';

export function ChatHistory({ conversations, currentId, onSelect, onDelete, onRename }) {
  // 按日期分组
  const grouped = conversations.reduce((acc, conv) => {
    const date = formatDate(conv.updated_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(conv);
    return acc;
  }, {});

  const dateOrder = ['今天', '昨天', '近7天', '更早'];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-2">
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
                onRename={onRename ? (title) => onRename(conv.id, title) : null}
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

function ConversationItem({ conversation, isActive, onSelect, onDelete, onRename }) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversation.title || '新对话');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startRename = (e) => {
    e.stopPropagation();
    setDraftTitle(conversation.title || '新对话');
    setIsEditing(true);
  };

  const cancelRename = (e) => {
    if (e) e.stopPropagation();
    setIsEditing(false);
    setDraftTitle(conversation.title || '新对话');
  };

  const commitRename = async (e) => {
    if (e) e.stopPropagation();
    const next = draftTitle.trim();
    if (!next || next === (conversation.title || '新对话')) {
      cancelRename();
      return;
    }
    try {
      if (onRename) await onRename(next);
      setIsEditing(false);
    } catch (err) {
      toastError(`重命名失败：${err.message || err}`);
      cancelRename();
    }
  };

  return (
    <div
      className={`group relative px-4 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-[var(--color-ai-bubble)]'
          : 'hover:bg-[var(--color-hover)]'
      }`}
      onClick={isEditing ? undefined : onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-text-muted)]'}`} />
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitRename();
              else if (e.key === 'Escape') cancelRename();
            }}
            onBlur={commitRename}
            maxLength={50}
            className="flex-1 bg-transparent border-b border-[var(--color-primary)] text-[15px] text-[var(--color-sidebar-text)] outline-none"
          />
        ) : (
          <span className="flex-1 text-[15px] text-[var(--color-sidebar-text)] truncate">
            {conversation.title || '新对话'}
          </span>
        )}
      </div>
      {!isEditing && conversation.last_message && (
        <p className="mt-0.5 pl-[18px] text-[13px] text-[var(--color-text-muted)] truncate">
          {conversation.last_message}
        </p>
      )}

      {/* 操作按钮 */}
      {showActions && !isEditing && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          {onRename && (
            <button
              onClick={startRename}
              title="重命名"
              className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-sidebar-text)]"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (await confirmDialog('确定删除这个对话吗？', { danger: true, confirmText: '删除' })) {
                onDelete();
              }
            }}
            title="删除"
            className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
      {isEditing && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          <button
            onMouseDown={(e) => e.preventDefault()} // 防止 blur 先触发
            onClick={commitRename}
            title="保存"
            className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-green-400"
          >
            <Check size={14} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancelRename}
            title="取消"
            className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
