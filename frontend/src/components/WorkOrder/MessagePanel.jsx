import { useState, useEffect, useRef, useCallback } from 'react';
import { Image, Loader2, Paperclip, Send, Video, X } from 'lucide-react';
import { getWorkOrderMessages, postWorkOrderMessage, uploadWorkOrderAttachment } from '../../services/api';
import { toastError } from '../../utils/feedback';
import { redactContactInfo } from '../../utils/contactRedaction';
import { isCnLocale } from '../../utils/locale';
import {
  getLocalizedCustomerContent,
  localizeWorkOrderSystemMessage,
} from '../Engineer/engineerWorkOrderContent';

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
    empty: 'No messages yet. Start the conversation!',
    unsupported: (name) => `Unsupported file type: ${name}`,
    tooLarge: (name) => `File too large (max 50MB): ${name}`,
    uploading: (current, total) => `Uploading ${current}/${total}`,
    sendFailed: 'Failed to send',
    attach: 'Attach image or video',
    placeholder: 'Type a message...',
    original: 'Customer original',
    viewOriginal: 'View customer original',
    systemOriginal: 'Original system message',
    viewSystemOriginal: 'View original system message',
    readOnly: 'Team progress view · Only the executing engineer can reply.',
  },
  cn: {
    empty: '暂无消息，可以从这里开始沟通。',
    unsupported: (name) => `不支持的文件类型：${name}`,
    tooLarge: (name) => `文件过大（最大 50MB）：${name}`,
    uploading: (current, total) => `正在上传 ${current}/${total}`,
    sendFailed: '消息发送失败',
    attach: '添加图片或视频',
    placeholder: '输入消息...',
    original: '客户原文',
    viewOriginal: '查看客户原文',
    systemOriginal: '系统消息原文',
    viewSystemOriginal: '查看系统消息原文',
    readOnly: '团队进度查看模式 · 仅执行工程师可以回复。',
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
  const content = getLocalizedCustomerContent({
    content: redactContactInfo(message.content),
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

function SystemMessage({ message, isCn }) {
  const copy = isCn ? COPY.cn : COPY.en;
  const locale = isCn ? 'cn' : 'en';
  const localized = localizeWorkOrderSystemMessage(message, locale);
  const original = redactContactInfo(message.content || '');
  const showOriginal = Boolean(original && original !== localized);

  return (
    <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)] px-3 py-1 rounded-xl text-center">
      <div>{localized}</div>
      {showOriginal && (
        <details className="mt-1">
          <summary className="cursor-pointer font-semibold">{copy.viewSystemOriginal}</summary>
          <div className="mt-1 opacity-75"><span className="font-semibold">{copy.systemOriginal}: </span>{original}</div>
        </details>
      )}
    </div>
  );
}

export function MessagePanel({ workOrderId, userType, userId, readOnly = false }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadingLabel, setUploadingLabel] = useState('');
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const load = useCallback(() => {
    getWorkOrderMessages(workOrderId).then(d => {
      setMessages(d.list || []);
    }).catch(() => {});
  }, [workOrderId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const validFiles = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toastError(copy.unsupported(file.type || file.name));
        continue;
      }
      if (file.size > MAX_SIZE) {
        toastError(copy.tooLarge(file.name));
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
      load();
    } catch (e) {
      toastError(`${copy.sendFailed}: ${e.message}`);
    } finally {
      setUploadingLabel('');
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="max-h-[52dvh] min-h-72 overflow-y-auto space-y-2 p-2 bg-[var(--color-surface-elevated)] rounded-xl sm:max-h-80">
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
                  <SystemMessage message={msg} isCn={isCn} />
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
                    {new Date(msg.created_at).toLocaleTimeString(isCn ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
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
