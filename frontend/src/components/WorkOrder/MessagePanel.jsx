import { useState, useEffect, useRef, useCallback } from 'react';
import { Image, Loader2, Paperclip, Send, Video, X } from 'lucide-react';
import { getWorkOrderMessages, postWorkOrderMessage, uploadWorkOrderAttachment } from '../../services/api';
import { toastError } from '../../utils/feedback';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
];
const MAX_SIZE = 50 * 1024 * 1024;

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

export function MessagePanel({ workOrderId, userType }) {
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
        toastError(`Unsupported file type: ${file.type || file.name}`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toastError(`File too large (max 50MB): ${file.name}`);
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
        setUploadingLabel(`Uploading ${i + 1}/${pendingFiles.length}`);
        const result = await uploadWorkOrderAttachment(workOrderId, file);
        const url = result?.attachment?.r2_url;
        if (url) attachmentUrls.push(url);
      }
      await postWorkOrderMessage(workOrderId, {
        content: input.trim(),
        message_type: 'text',
        attachment_urls: attachmentUrls,
      });
      setInput('');
      setPendingFiles([]);
      load();
    } catch (e) {
      toastError('Failed to send: ' + e.message);
    } finally {
      setUploadingLabel('');
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="max-h-80 overflow-y-auto space-y-2 p-2 bg-[var(--color-surface-elevated)] rounded-xl">
        {messages.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--color-text-muted)]">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_type === userType;
            const isSystem = msg.sender_type === 'system';
            const attachmentUrls = Array.isArray(msg.attachment_urls) ? msg.attachment_urls : [];
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
                <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-[var(--color-primary)] text-white rounded-br-md'
                    : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] rounded-bl-md'
                }`}>
                  {!isMe && msg.sender_name && (
                    <div className="text-xs opacity-70 mb-0.5">{msg.sender_name}</div>
                  )}
                  {msg.content && <div className="whitespace-pre-wrap">{msg.content}</div>}
                  <MediaGrid urls={attachmentUrls} isMe={isMe} />
                  <div className={`text-xs mt-1 ${isMe ? 'text-white/50 text-right' : 'text-[var(--color-text-muted)]'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {pendingFiles.length > 0 && (
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

      <div className="flex gap-2">
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
          title="Attach image or video"
          className="px-3 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl hover:bg-[var(--color-surface-elevated)] disabled:opacity-40"
        >
          <Paperclip size={16} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <button
          onClick={handleSend}
          disabled={sending || (!input.trim() && pendingFiles.length === 0)}
          className="px-3 py-2 bg-[var(--color-primary)] disabled:opacity-40 text-white rounded-xl"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      {uploadingLabel && (
        <div className="text-xs text-[var(--color-text-muted)]">{uploadingLabel}</div>
      )}
    </div>
  );
}
