import { Trash2, Pencil, Check, X } from 'lucide-react';
import { formatDate } from '../../utils/helpers';
import { toastError, confirmDialog } from '../../utils/feedback';
import { useState, useRef, useEffect } from 'react';
import { isCnLocale } from '../../utils/locale';

const COPY = {
  cn: {
    groups: {
      Today: '今天',
      Yesterday: '昨天',
      'Last 7 Days': '最近 7 天',
      Earlier: '更早',
    },
    empty: '你的服务对话会显示在这里',
    defaultTitle: '服务对话',
    renameFailed: '重命名失败',
    deleteConfirm: '删除这条对话？',
    delete: '删除',
    rename: '重命名',
    save: '保存',
    cancel: '取消',
  },
  en: {
    groups: {
      Today: 'Today',
      Yesterday: 'Yesterday',
      'Last 7 Days': 'Last 7 Days',
      Earlier: 'Earlier',
    },
    empty: 'Your service conversations will appear here',
    defaultTitle: 'Service Chat',
    renameFailed: 'Rename failed',
    deleteConfirm: 'Delete this conversation?',
    delete: 'Delete',
    rename: 'Rename',
    save: 'Save',
    cancel: 'Cancel',
  },
};

export function ChatHistory({ conversations, currentId, onSelect, onDelete, onRename }) {
  const copy = isCnLocale() ? COPY.cn : COPY.en;
  // 按日期分组
  const grouped = conversations.reduce((acc, conv) => {
    const date = formatDate(conv.updated_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(conv);
    return acc;
  }, {});

  const dateOrder = ['Today', 'Yesterday', 'Last 7 Days', 'Earlier'];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-2">
      {dateOrder.map((date) => {
        const items = grouped[date];
        if (!items || items.length === 0) return null;

        return (
          <div key={date} className="mb-2">
            <div className="px-4 py-2 text-[12px] text-[var(--color-sidebar-muted)] font-medium uppercase tracking-wide">
              {copy.groups[date] || date}
            </div>
            {items.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === currentId}
                onSelect={() => onSelect(conv)}
                onDelete={() => onDelete(conv.id)}
                onRename={onRename ? (title) => onRename(conv.id, title) : null}
                copy={copy}
              />
            ))}
          </div>
        );
      })}

      {conversations.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
          {copy.empty}
        </div>
      )}
    </div>
  );
}

function ConversationItem({ conversation, isActive, onSelect, onDelete, onRename, copy }) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversation.title || copy.defaultTitle);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startRename = (e) => {
    e.stopPropagation();
    setDraftTitle(conversation.title || copy.defaultTitle);
    setIsEditing(true);
  };

  const cancelRename = (e) => {
    if (e) e.stopPropagation();
    setIsEditing(false);
    setDraftTitle(conversation.title || copy.defaultTitle);
  };

  const commitRename = async (e) => {
    if (e) e.stopPropagation();
    const next = draftTitle.trim();
    if (!next || next === (conversation.title || copy.defaultTitle)) {
      cancelRename();
      return;
    }
    try {
      if (onRename) await onRename(next);
      setIsEditing(false);
    } catch (err) {
      toastError(`${copy.renameFailed}: ${err.message || err}`);
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
            {conversation.title || copy.defaultTitle}
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
              title={copy.rename}
              className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-sidebar-text)]"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (await confirmDialog(copy.deleteConfirm, { danger: true, confirmText: copy.delete })) {
                onDelete();
              }
            }}
            title={copy.delete}
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
            title={copy.save}
            className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-green-400"
          >
            <Check size={14} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancelRename}
            title={copy.cancel}
            className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
