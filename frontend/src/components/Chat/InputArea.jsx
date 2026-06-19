import { useState, useRef, useEffect } from 'react';
import { Send, StopCircle, ImagePlus, X, Loader2 } from 'lucide-react';
import { uploadChatImage } from '../../services/api';
import { getCurrentUiText } from '../../i18n/uiText';

const MAX_IMAGES = 4;

export function InputArea({ onSend, onStop, disabled, isStreaming }) {
  const t = getCurrentUiText().chat;
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState([]); // { file, previewUrl, uploading, url, error }
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const previewUrlsRef = useRef(new Set());

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  // 清理 previewUrl 防止内存泄漏
  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, []);

  const handleFileSelect = async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;

    const slotsLeft = MAX_IMAGES - pendingImages.length;
    const toAdd = files.slice(0, slotsLeft);

    const newImages = toAdd.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      uploading: true,
      url: null,
      error: null,
    }));
    newImages.forEach(img => previewUrlsRef.current.add(img.previewUrl));

    setPendingImages(prev => [...prev, ...newImages]);
    e.target.value = '';

    // 逐个上传
    for (let i = 0; i < newImages.length; i++) {
      const idx = pendingImages.length + i;
      try {
        const result = await uploadChatImage(newImages[i].file);
        setPendingImages(prev => prev.map((img, j) =>
          j === idx ? { ...img, uploading: false, url: result.image_url } : img
        ));
      } catch (err) {
        setPendingImages(prev => prev.map((img, j) =>
          j === idx ? { ...img, uploading: false, error: err.message } : img
        ));
      }
    }
  };

  const removeImage = (index) => {
    setPendingImages(prev => {
      const img = prev[index];
      if (img.previewUrl) {
        URL.revokeObjectURL(img.previewUrl);
        previewUrlsRef.current.delete(img.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSend = () => {
    const text = input.trim();
    const uploadedImages = pendingImages.filter(img => img.url);
    if ((!text && uploadedImages.length === 0) || disabled) return;

    const images = uploadedImages.map(img => ({ url: img.url }));
    onSend(text || t.imageOnlyMessage, images);
    setInput('');
    pendingImages.forEach(img => {
      if (img.previewUrl) {
        URL.revokeObjectURL(img.previewUrl);
        previewUrlsRef.current.delete(img.previewUrl);
      }
    });
    setPendingImages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasUploading = pendingImages.some(img => img.uploading);
  const canSend = (input.trim() || pendingImages.some(img => img.url)) && !hasUploading;

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-chat-bg)] px-3 sm:px-6 py-3 sm:py-4 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto">
        {/* 图片预览条 */}
        {pendingImages.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-[var(--color-border)]">
                <img
                  src={img.previewUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {img.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 size={16} className="text-white animate-spin" />
                  </div>
                )}
                {img.error && (
                  <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center" title={img.error}>
                    <X size={16} className="text-white" />
                  </div>
                )}
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {pendingImages.length < MAX_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-text-muted)] transition-colors"
              >
                <ImagePlus size={20} className="text-[var(--color-text-muted)]" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-start gap-3">
          {/* 图片上传按钮 */}
          {pendingImages.length === 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isStreaming}
              className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-[var(--color-hover)] transition-colors flex-shrink-0 disabled:opacity-50"
              title={t.uploadImage}
            >
              <ImagePlus size={22} className="text-[var(--color-text-muted)]" />
            </button>
          )}

          {/* 输入框 */}
          <div
            className={`input-wrapper flex-1 rounded-2xl transition-colors ${disabled ? 'opacity-50' : ''}`}
            style={{ backgroundColor: 'var(--color-input-bg)' }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingImages.length > 0 ? t.imagePlaceholder : t.inputPlaceholder}
              disabled={disabled}
              rows={1}
              className="w-full px-4 py-3 bg-transparent resize-none focus:outline-none text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] disabled:opacity-50 text-[15px]"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
          </div>

          {/* 发送/停止按钮 */}
          <div className="flex items-start">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="w-12 h-12 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-2xl transition-colors flex-shrink-0 active:scale-95"
                title={t.stopGeneration}
              >
                <StopCircle size={22} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend || disabled}
                className="w-12 h-12 flex items-center justify-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-border)] disabled:opacity-50 text-white rounded-2xl transition-colors flex-shrink-0 active:scale-95"
              >
                <Send size={20} />
              </button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
