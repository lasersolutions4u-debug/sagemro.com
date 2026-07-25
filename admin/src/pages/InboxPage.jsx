import { useEffect, useState } from 'react';
import { createInboxDirectConversation, getInbox, getInboxContacts, getInboxConversation, markInboxConversationRead, postInboxMessage } from '../services/api';
import { runtimeConfig } from '../config/runtime';

const FILTERS = ['all', 'work_order', 'direct', 'system'];
const COPY = {
  en: { filters: { all: 'All', work_order: 'Work orders', direct: 'Direct', system: 'System' }, title: 'Operations inbox', subtitle: 'Service collaboration and system notifications', newMessage: 'New message', direct: 'Direct message', workOrder: 'Work order', empty: 'No items.', systemReadOnly: 'System notification — replies are unavailable.', select: 'Select a conversation or notification.', loading: 'Loading contacts…', write: 'Write a message', send: 'Send' },
  'zh-CN': { filters: { all: '全部', work_order: '工单会话', direct: '私信', system: '系统通知' }, title: '运营收件箱', subtitle: '服务协作与系统通知', newMessage: '新建私信', direct: '私信', workOrder: '工单会话', empty: '暂无消息。', systemReadOnly: '系统通知不可回复。', select: '选择一个会话或通知。', loading: '正在加载联系人…', write: '输入消息', send: '发送' },
};

export function InboxPage({ onUnreadChange }) {
  const copy = COPY[runtimeConfig.locale] || COPY.en;
  const [filter, setFilter] = useState('all');
  const [inbox, setInbox] = useState({ conversations: [], notifications: [], unread: { total: 0 } });
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [draft, setDraft] = useState('');
  const [contacts, setContacts] = useState(null);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [error, setError] = useState('');

  const loadInbox = async (nextFilter = filter) => {
    try {
      const data = await getInbox(nextFilter);
      setInbox(data);
      onUnreadChange?.(data.unread?.total || 0);
    } catch (err) { setError(err.message); }
  };

  useEffect(() => { loadInbox(filter); }, [filter]);

  const selectConversation = async (item) => {
    setSelectedConversation(item); setSelectedNotification(null); setError('');
    try {
      const data = await getInboxConversation(item.id);
      setConversation(data);
      await markInboxConversationRead(item.id);
      loadInbox();
    } catch (err) { setError(err.message); }
  };

  const openNewMessage = async () => {
    setNewMessageOpen(true); setError('');
    try { setContacts((await getInboxContacts()).contacts || []); } catch (err) { setError(err.message); }
  };
  const startDirect = async (contact) => {
    try {
      const data = await createInboxDirectConversation(contact.id, contact.type);
      setNewMessageOpen(false); await loadInbox('direct'); setFilter('direct');
      await selectConversation(data.conversation);
    } catch (err) { setError(err.message); }
  };
  const send = async (event) => {
    event.preventDefault();
    if (!draft.trim() || !selectedConversation) return;
    try {
      await postInboxMessage(selectedConversation.id, draft);
      setDraft(''); await loadInbox();
      setConversation(await getInboxConversation(selectedConversation.id));
    } catch (err) { setError(err.message); }
  };
  const rows = [...inbox.conversations, ...inbox.notifications];

  return <div className="space-y-4">
    <div className="flex items-center justify-between"><div><h1 className="text-xl font-semibold text-[var(--color-text)]">{copy.title}</h1><p className="text-sm text-[var(--color-text-muted)]">{copy.subtitle}</p></div><button onClick={openNewMessage} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white">{copy.newMessage}</button></div>
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid min-h-[560px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] lg:grid-cols-[240px_300px_1fr]">
      <aside className="border-b border-[var(--color-border)] p-3 lg:border-b-0 lg:border-r">{FILTERS.map((name) => <button key={name} onClick={() => setFilter(name)} className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${filter === name ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}>{copy.filters[name]}</button>)}</aside>
      <section className="border-b border-[var(--color-border)] lg:border-b-0 lg:border-r">{rows.map((item) => <button key={`${item.kind}-${item.id}`} onClick={() => item.kind === 'system' ? (setSelectedNotification(item), setSelectedConversation(null), setConversation(null)) : selectConversation(item)} className={`block w-full border-b border-[var(--color-border)] p-3 text-left hover:bg-[var(--color-surface-elevated)] ${(selectedConversation?.id === item.id || selectedNotification?.id === item.id) ? 'bg-[var(--color-surface-elevated)]' : ''}`}><div className="flex justify-between gap-2"><span className="font-medium text-[var(--color-text)]">{item.kind === 'system' ? item.title : item.subject || (item.kind === 'direct' ? copy.direct : copy.workOrder)}</span>{item.unread && <span className="mt-1 h-2 w-2 rounded-full bg-[var(--color-primary)]" />}</div><p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{item.body || item.last_message_at}</p></button>)}{!rows.length && <p className="p-4 text-sm text-[var(--color-text-muted)]">{copy.empty}</p>}</section>
      <section className="flex min-w-0 flex-col p-4">{selectedNotification ? <div><h2 className="text-lg font-semibold text-[var(--color-text)]">{selectedNotification.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{selectedNotification.body}</p><p className="mt-4 text-xs text-[var(--color-text-muted)]">{copy.systemReadOnly}</p></div> : conversation ? <><h2 className="font-semibold text-[var(--color-text)]">{conversation.conversation.subject || (selectedConversation.kind === 'direct' ? copy.direct : copy.workOrder)}</h2><div className="flex-1 space-y-3 overflow-auto py-4">{conversation.messages.map((message) => <div key={message.id} className="rounded-lg bg-[var(--color-surface-elevated)] p-3 text-sm"><div className="mb-1 text-xs text-[var(--color-text-muted)]">{message.sender_name}</div>{message.content}</div>)}</div><form onSubmit={send} className="flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm" placeholder={copy.write}/><button className="rounded-lg bg-[var(--color-primary)] px-3 text-sm text-white">{copy.send}</button></form></> : <p className="m-auto text-sm text-[var(--color-text-muted)]">{copy.select}</p>}</section>
    </div>
    {newMessageOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-5"><div className="mb-3 flex justify-between"><h2 className="font-semibold">{copy.newMessage}</h2><button onClick={() => setNewMessageOpen(false)}>×</button></div>{contacts === null ? <p className="text-sm">{copy.loading}</p> : contacts.map((contact) => <button key={`${contact.type}-${contact.id}`} onClick={() => startDirect(contact)} className="block w-full border-t border-[var(--color-border)] py-3 text-left text-sm">{contact.name}</button>)}</div></div>}
  </div>;
}
