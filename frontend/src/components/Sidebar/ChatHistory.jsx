import { Trash2, Pencil, Check, X } from 'lucide-react';
import { formatDate } from '../../utils/helpers';
import { toastError, confirmDialog } from '../../utils/feedback';
import { useState, useRef, useEffect } from 'react';

export function ChatHistory({ conversations, currentId, onSelect, onDelete, onRename }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredConversations = normalizedQuery
    ? conversations.filter((conv) => `${conv.title || ''} ${conv.last_message || ''}`.toLowerCase().includes(normalizedQuery))
    : conversations;

  const grouped = filteredConversations.reduce((acc, conv) => {
    const date = formatDate(conv.updated_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(conv);
    return acc;
  }, {});

  const dateOrder = ['Today', 'Yesterday', 'Last 7 Days', 'Earlier'];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3">
        <div className="text-sm font-semibold text-[var(--color-text-primary)]">Conversation History</div>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Find previous machine issues, service notes, and AI summaries.</p>
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search conversations"
        className="mb-3 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-2">
        {dateOrder.map((date) => {
          const items = grouped[date];
          if (!items || items.length === 0) return null;

          return (
            <div key={date} className="mb-2">
              <div className="px-4 py-2 text-[12px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
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

        {filteredConversations.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
            {conversations.length === 0 ? 'Your service conversations will appear here' : 'No conversations match your search'}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationItem({ conversation, isActive, onSelect, onDelete, onRename }) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversation.title || 'Service Chat');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startRename = (e) => {
    e.stopPropagation();
    setDraftTitle(conversation.title || 'Service Chat');
    setIsEditing(true);
  };

  const cancelRename = (e) => {
    if (e) e.stopPropagation();
    setIsEditing(false);
    setDraftTitle(conversation.title || 'Service Chat');
  };

  const commitRename = async (e) => {
    if (e) e.stopPropagation();
    const next = draftTitle.trim();
    if (!next || next === (conversation.title || 'Service Chat')) {
      cancelRename();
      return;
    }
    try {
      if (onRename) await onRename(next);
      setIsEditing(false);
    } catch (err) {
      toastError(`Rename failed: ${err.message || err}`);
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
            className="flex-1 border-b border-[var(--color-primary)] bg-transparent text-[15px] text-[var(--color-text-primary)] outline-none"
          />
        ) : (
          <span className="flex-1 truncate text-[15px] text-[var(--color-text-primary)]">
            {conversation.title || 'Service Chat'}
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
              title="Rename"
              className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-sidebar-text)]"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (await confirmDialog('Delete this conversation?', { danger: true, confirmText: 'Delete' })) {
                try {
                  await onDelete();
                } catch (err) {
                  toastError(err.message || String(err));
                }
              }
            }}
            title="Delete"
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
            title="Save"
            className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-green-400"
          >
            <Check size={14} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancelRename}
            title="Cancel"
            className="p-1 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
