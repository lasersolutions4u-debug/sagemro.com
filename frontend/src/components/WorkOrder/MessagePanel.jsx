import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Image, Loader2, Paperclip, Send, Video, X } from 'lucide-react';
import { getWorkOrderMessages, postWorkOrderMessage, uploadWorkOrderAttachment } from '../../services/api';
import { toastError } from '../../utils/feedback';
import { redactContactInfo } from '../../utils/contactRedaction';
import { isCnLocale } from '../../utils/locale';
import { formatServiceTextForLocale } from '../../utils/workOrderDisplay';
import { getLocalizedCustomerContent } from '../Engineer/engineerWorkOrderContent';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
];
const MAX_SIZE = 50 * 1024 * 1024;

const COPY = {
  en: {
    unsupportedType: 'Unsupported file type: ',
    fileTooLarge: 'File too large (max 50MB): ',
    uploading: (current, total) => `Uploading ${current}/${total}`,
    sendFailed: 'Failed to send: ',
    empty: 'No messages yet. Start the conversation!',
    attach: 'Attach image or video',
    placeholder: 'Type a message...',
    original: 'Customer original',
    viewOriginal: 'View customer original',
    readOnly: 'Team progress view · Only the executing engineer can reply.',
    newMessages: 'New messages',
  },
  cn: {
    unsupportedType: '暂不支持的文件类型：',
    fileTooLarge: '文件过大（最大 50MB）：',
    uploading: (current, total) => `上传中 ${current}/${total}`,
    sendFailed: '发送失败：',
    empty: '暂无消息，可以在这里继续沟通。',
    attach: '添加图片或视频',
    placeholder: '输入消息...',
    original: '客户原文',
    viewOriginal: '查看客户原文',
    readOnly: '团队进度查看模式 · 仅执行工程师可以回复。',
    newMessages: '有新消息',
  },
};

function isVideoUrl(url) {
  return /\.(mp4|webm)(\?.*)?$/i.test(url);
}

function attachmentType(url) {
  if (isVideoUrl(url)) return 'video';
  return 'image';
}

function MediaGrid({ urls = [], isMe }) {
  if (!urls.length) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {urls.map((url) => {
        const type = attachmentType(url);
        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className={`block overflow-hidden rounded-lg border ${isMe ? 'border-white/20 bg-black/10' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
          >
            {type === 'video' ? (
              <video src={url} controls className="h-28 w-full object-cover bg-black" />
            ) : (
              <img src={url} alt="" className="h-28 w-full object-cover" loading="lazy" />
            )}
          </a>
        );
      })}
    </div>
  );
}

function MessageText({ message, isCn }) {
  const copy = isCn ? COPY.cn : COPY.en;
  const msg = message;
  const localizedContent = redactContactInfo(formatServiceTextForLocale(msg.content, isCnLocale() ? 'zh-CN' : 'en'));
  const content = getLocalizedCustomerContent({
    content: localizedContent,
    content_en: redactContactInfo(message.content_en || message.translated_content || ''),
    content_zh: redactContactInfo(message.content_zh || message.translated_content_zh || ''),
  }, isCn ? 'cn' : 'en');

  return (
    <div>
      {content.primaryLabel && <div className="mb-1 text-[10px] font-semibold opacity-65">{content.primaryLabel}</div>}
      {content.primaryText && <div className="whitespace-pre-wrap">{content.primaryText}</div>}
      {content.originalText && (
        <details className="mt-2 rounded-lg border border-current/15 px-2 py-1.5">
          <summary className="cursor-pointer text-xs font-semibold opacity-75">{copy.viewOriginal}</summary>
          <div className="mt-2 text-[10px] font-semibold opacity-60">{content.originalLabel || copy.original}</div>
          <div className="mt-1 whitespace-pre-wrap">{content.originalText}</div>
        </details>
      )}
    </div>
  );
}

function SystemMessage({ message }) {
  const content = redactContactInfo(message.content || '');

  return (
    <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)] px-3 py-1 rounded-xl text-center">
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  );
}

function isNearMessageBottom(element) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 48;
}

function messagesMatch(current, next) {
  if (current.length !== next.length) return false;
  return current.every((message, index) => {
    const nextMessage = next[index];
    return message.id === nextMessage?.id
      && message.updated_at === nextMessage?.updated_at
      && message.content === nextMessage?.content
      && message.content_en === nextMessage?.content_en
      && message.content_zh === nextMessage?.content_zh
      && JSON.stringify(message.attachment_urls || []) === JSON.stringify(nextMessage?.attachment_urls || []);
  });
}

export function MessagePanel({ workOrderId, userType, userId, readOnly = false }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadingLabel, setUploadingLabel] = useState('');
  const [showNewMessages, setShowNewMessages] = useState(false);
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const messagesRef = useRef([]);
  const initializedRef = useRef(false);
  const pinnedToBottomRef = useRef(true);
  const shouldAutoScrollRef = useRef(false);

  const scrollMessageListToBottom = useCallback((behavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    pinnedToBottomRef.current = true;
    setShowNewMessages(false);
  }, []);

  const load = useCallback(() => {
    getWorkOrderMessages(workOrderId).then(d => {
      const nextMessages = d.list || [];
      const currentMessages = messagesRef.current;
      if (messagesMatch(currentMessages, nextMessages)) return;

      const wasInitialized = initializedRef.current;
      const hasNewLastMessage = wasInitialized
        && nextMessages.at(-1)?.id !== currentMessages.at(-1)?.id;
      const isAtBottom = isNearMessageBottom(messagesContainerRef.current);
      pinnedToBottomRef.current = isAtBottom;
      shouldAutoScrollRef.current = !wasInitialized || isAtBottom;
      if (hasNewLastMessage && !isAtBottom) setShowNewMessages(true);

      messagesRef.current = nextMessages;
      initializedRef.current = true;
      setMessages(nextMessages);
    }).catch(() => {});
  }, [workOrderId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    shouldAutoScrollRef.current = false;
    const frame = requestAnimationFrame(() => {
      if (pinnedToBottomRef.current) scrollMessageListToBottom('auto');
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, scrollMessageListToBottom]);

  const handleMessageScroll = () => {
    const nearBottom = isNearMessageBottom(messagesContainerRef.current);
    pinnedToBottomRef.current = nearBottom;
    if (nearBottom) setShowNewMessages(false);
  };

  const handleFileSelect = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const validFiles = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toastError(copy.unsupportedType + (file.type || file.name));
        continue;
      }
      if (file.size > MAX_SIZE) {
        toastError(copy.fileTooLarge + file.name);
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length) {
      setPendingFiles((current) => [...current, ...validFiles].slice(0, 8));
    }
  };

  const removePendingFile = (index) => {
    setPendingFiles((current) => current.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || sending) return;
    setSending(true);
    try {
      const attachmentUrls = [];
      for (let i = 0; i < pendingFiles.length; i += 1) {
        const file = pendingFiles[i];
        setUploadingLabel(copy.uploading(i + 1, pendingFiles.length));
        const result = await uploadWorkOrderAttachment(workOrderId, file);
        const url = result?.attachment?.r2_url;
        if (url) attachmentUrls.push(url);
      }
      await postWorkOrderMessage(workOrderId, {
        content: redactContactInfo(input.trim()),
        message_type: 'text',
        attachment_urls: attachmentUrls,
      });
      setInput('');
      setPendingFiles([]);
      pinnedToBottomRef.current = true;
      load();
    } catch (e) {
      toastError(copy.sendFailed + e.message);
    } finally {
      setUploadingLabel('');
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
      <div
        ref={messagesContainerRef}
        onScroll={handleMessageScroll}
        className="max-h-[52dvh] min-h-72 overflow-y-auto space-y-2 p-2 bg-[var(--color-surface-elevated)] rounded-xl sm:max-h-80"
      >
        {messages.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--color-text-muted)]">{copy.empty}</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_type === userType
              && (!msg.sender_id || !userId || String(msg.sender_id) === String(userId));
            const isSystem = msg.sender_type === 'system';
            const attachmentUrls = Array.isArray(msg.attachment_urls) ? msg.attachment_urls : [];
            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <SystemMessage message={msg} />
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] px-3 py-2 rounded-2xl text-sm sm:max-w-[82%] ${
                  isMe
                    ? 'bg-[var(--color-primary)] text-white rounded-br-md'
                    : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] rounded-bl-md'
                }`}>
                  {!isMe && msg.sender_name && (
                    <div className="text-xs opacity-70 mb-0.5">{msg.sender_name}</div>
                  )}
                  {msg.content && <MessageText message={msg} isCn={isCn} />}
                  <MediaGrid urls={attachmentUrls} isMe={isMe} />
                  <div className={`text-xs mt-1 ${isMe ? 'text-white/50 text-right' : 'text-[var(--color-text-muted)]'}`}>
                    {new Date(msg.created_at).toLocaleTimeString(isCn ? 'zh-CN' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: !isCn,
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {showNewMessages && (
        <button type="button" onClick={() => scrollMessageListToBottom()} className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] shadow-sm">
          <ChevronDown size={14} />
          {copy.newMessages}
        </button>
      )}
      </div>

      {!readOnly && pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
              {file.type.startsWith('video/') ? <Video size={14} /> : <Image size={14} />}
              <span className="max-w-32 truncate">{file.name}</span>
              <button type="button" onClick={() => removePendingFile(index)} className="p-0.5 hover:text-red-500">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {readOnly && <p className="text-xs text-[var(--color-text-muted)]">{copy.readOnly}</p>}

      {!readOnly && <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title={copy.attach}
          className="flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl hover:bg-[var(--color-surface-elevated)] disabled:opacity-40"
        >
          <Paperclip size={16} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={copy.placeholder}
          className="min-h-11 min-w-0 flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <button
          onClick={handleSend}
          disabled={sending || (!input.trim() && pendingFiles.length === 0)}
          className="flex h-11 w-11 shrink-0 items-center justify-center bg-[var(--color-primary)] disabled:opacity-40 text-white rounded-xl"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>}
      {uploadingLabel && (
        <div className="text-xs text-[var(--color-text-muted)]">{uploadingLabel}</div>
      )}
    </div>
  );
}
