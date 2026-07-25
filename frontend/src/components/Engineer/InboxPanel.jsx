import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Plus, Send } from 'lucide-react';
import {
  createInboxConversation,
  getInbox,
  getInboxContacts,
  getInboxConversation,
  markInboxConversationRead,
  sendInboxMessage,
} from '../../services/api';
import { isCnLocale } from '../../utils/locale';

const FILTERS = ['all', 'work_order', 'direct', 'system'];
const COPY = {
  en: {
    title: 'Collaboration inbox', filters: { all: 'All', work_order: 'Work orders', direct: 'Direct', system: 'System' },
    newMessage: 'New message', direct: 'Direct message', workOrder: 'Work order', system: 'System notification',
    empty: 'No messages yet.', select: 'Select a conversation or notification.', loading: 'Loading…',
    write: 'Write a message', send: 'Send', close: 'Close', contacts: 'Choose a contact', noContacts: 'No contacts are available.',
    systemReadOnly: 'System notifications cannot be replied to.', linkedWorkOrder: 'Open work order', error: 'Unable to load inbox.',
  },
  cn: {
    title: '协作收件箱', filters: { all: '全部', work_order: '工单会话', direct: '私信', system: '系统通知' },
    newMessage: '新建私信', direct: '私信', workOrder: '工单会话', system: '系统通知',
    empty: '暂无消息。', select: '选择一个会话或通知。', loading: '加载中…',
    write: '输入消息', send: '发送', close: '关闭', contacts: '选择联系人', noContacts: '暂无可联系的人员。',
    systemReadOnly: '系统通知不可回复。', linkedWorkOrder: '打开工单', error: '收件箱加载失败。',
  },
};

function contactLabel(contact) {
  return contact.role_label || contact.role || contact.type;
}

export function InboxPanel({ isOpen, onClose, onOpenWorkOrder }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const [filter, setFilter] = useState('all');
  const [inbox, setInbox] = useState({ conversations: [], notifications: [], unread: { total: 0 } });
  const [selected, setSelected] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadInbox = useCallback(async (nextFilter = filter) => {
    setLoading(true);
    try {
      setInbox(await getInbox(nextFilter));
      setError('');
    } catch (err) {
      setError(err.message || copy.error);
    } finally {
      setLoading(false);
    }
  }, [copy.error, filter]);

  useEffect(() => {
    if (isOpen) loadInbox(filter);
  }, [filter, isOpen, loadInbox]);

  const selectConversation = async (item) => {
    setSelected(item);
    setConversation(null);
    if (item.kind === 'system') return;
    try {
      const detail = await getInboxConversation(item.id);
      setConversation(detail);
      await markInboxConversationRead(item.id);
      loadInbox();
    } catch (err) {
      setError(err.message || copy.error);
    }
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setContacts(null);
    try {
      setContacts((await getInboxContacts()).contacts || []);
    } catch (err) {
      setError(err.message || copy.error);
      setContacts([]);
    }
  };

  const startConversation = async (contact) => {
    try {
      const data = await createInboxConversation(contact.id, contact.type);
      setPickerOpen(false);
      setFilter('direct');
      await loadInbox('direct');
      await selectConversation(data.conversation);
    } catch (err) {
      setError(err.message || copy.error);
    }
  };

  const send = async (event) => {
    event.preventDefault();
    if (!draft.trim() || !conversation) return;
    try {
      await sendInboxMessage(conversation.conversation.id, draft.trim());
      setDraft('');
      setConversation(await getInboxConversation(conversation.conversation.id));
      loadInbox();
    } catch (err) {
      setError(err.message || copy.error);
    }
  };

  if (!isOpen) return null;
  const rows = [...inbox.conversations, ...inbox.notifications];
  const selectedSystem = selected?.kind === 'system';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-2 sm:p-5">
      <section className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2"><MessageCircle size={20} className="text-[var(--color-primary)]" /><h2 className="font-semibold">{copy.title}</h2>{inbox.unread?.total > 0 && <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs text-white">{inbox.unread.total}</span>}</div>
          <div className="flex gap-2"><button onClick={openPicker} className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"><Plus size={16} />{copy.newMessage}</button><button onClick={onClose} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">{copy.close}</button></div>
        </header>
        {error && <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[150px_290px_1fr]">
          <aside className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] p-2 lg:block lg:border-b-0 lg:border-r">
            {FILTERS.map((name) => <button key={name} onClick={() => setFilter(name)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm lg:mb-1 lg:block lg:w-full ${filter === name ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}>{copy.filters[name]}</button>)}
          </aside>
          <div className="min-h-0 overflow-y-auto border-b border-[var(--color-border)] lg:border-b-0 lg:border-r">
            {loading && <p className="p-4 text-sm text-[var(--color-text-muted)]">{copy.loading}</p>}
            {!loading && !rows.length && <p className="p-4 text-sm text-[var(--color-text-muted)]">{copy.empty}</p>}
            {rows.map((item) => <button key={`${item.kind}-${item.id}`} onClick={() => selectConversation(item)} className={`block w-full border-b border-[var(--color-border)] p-3 text-left hover:bg-[var(--color-surface-elevated)] ${selected?.id === item.id ? 'bg-[var(--color-surface-elevated)]' : ''}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{item.kind === 'system' ? item.title : item.subject || (item.kind === 'direct' ? copy.direct : copy.workOrder)}</span>{item.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" />}</div><p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{item.body || item.last_message_at}</p></button>)}
          </div>
          <div className="flex min-h-0 flex-col p-4">
            {selectedSystem ? <div><h3 className="font-semibold">{selected.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{selected.body}</p><p className="mt-4 text-xs text-[var(--color-text-muted)]">{copy.systemReadOnly}</p></div> : conversation ? <><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{conversation.conversation.subject || (conversation.conversation.kind === 'direct' ? copy.direct : copy.workOrder)}</h3>{conversation.conversation.work_order_id && onOpenWorkOrder && <button onClick={() => onOpenWorkOrder(conversation.conversation.work_order_id)} className="text-sm text-[var(--color-primary)]">{copy.linkedWorkOrder}</button>}</div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">{conversation.messages.map((message) => <div key={message.id} className="rounded-xl bg-[var(--color-surface-elevated)] p-3 text-sm"><div className="mb-1 text-xs text-[var(--color-text-muted)]">{message.sender_name}</div><p className="whitespace-pre-wrap">{message.content}</p></div>)}</div><form onSubmit={send} className="flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={copy.write} className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm" /><button className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm text-white"><Send size={15} />{copy.send}</button></form></> : <p className="m-auto text-sm text-[var(--color-text-muted)]">{copy.select}</p>}
          </div>
        </div>
        {pickerOpen && <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-5 shadow-xl"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{copy.contacts}</h3><button onClick={() => setPickerOpen(false)}>×</button></div>{contacts === null ? <p className="text-sm">{copy.loading}</p> : contacts.length ? contacts.map((contact) => <button key={`${contact.type}-${contact.id}`} onClick={() => startConversation(contact)} className="block w-full border-t border-[var(--color-border)] py-3 text-left"><div className="text-sm font-medium">{contact.name}</div><div className="text-xs text-[var(--color-text-muted)]">{contactLabel(contact)}</div></button>) : <p className="text-sm text-[var(--color-text-muted)]">{copy.noContacts}</p>}</div></div>}
      </section>
    </div>
  );
}
