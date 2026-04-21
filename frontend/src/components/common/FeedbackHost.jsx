import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const TOAST_ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const TOAST_COLOR = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-[var(--color-primary)]',
  warning: 'text-amber-500',
};

function ToastItem({ toast, onDismiss }) {
  const Icon = TOAST_ICON[toast.type] || Info;
  const color = TOAST_COLOR[toast.type] || TOAST_COLOR.info;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg bg-[var(--color-surface)] border border-[var(--color-border)] max-w-[min(420px,calc(100vw-32px))] pointer-events-auto"
    >
      <Icon size={20} className={`${color} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap break-words">
        {toast.message}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 -mr-1 -mt-1 rounded hover:bg-[var(--color-hover)] transition-colors flex-shrink-0"
        aria-label="关闭"
      >
        <X size={14} className="text-[var(--color-text-secondary)]" />
      </button>
    </motion.div>
  );
}

function ConfirmDialog({ dialog, onResolve }) {
  const { id, title, message, confirmText, cancelText, danger } = dialog;
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => onResolve(id, false)}
        className="fixed inset-0 bg-black/50 z-[60]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } }}
        transition={{ duration: 0.2 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-sm bg-[var(--color-surface)] rounded-2xl shadow-2xl z-[61] overflow-hidden"
      >
        <div className="p-5">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
            {title}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap break-words">
            {message}
          </p>
        </div>
        <div className="flex items-center gap-2 px-5 pb-5">
          <button
            onClick={() => onResolve(id, false)}
            className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={() => onResolve(id, true)}
            autoFocus
            className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors text-sm ${
              danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-[var(--color-primary)] hover:opacity-90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </>
  );
}

export function FeedbackHost() {
  const [toasts, setToasts] = useState([]);
  const [confirms, setConfirms] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const resolveConfirm = useCallback((id, result) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sagemro:confirm-result', {
        detail: { id, result },
      }));
    }
    setConfirms((prev) => prev.filter((c) => c.id !== id));
  }, []);

  useEffect(() => {
    const onToast = (e) => {
      const t = e.detail;
      if (!t || !t.id) return;
      setToasts((prev) => [...prev, t]);
      if (t.duration > 0) {
        setTimeout(() => dismissToast(t.id), t.duration);
      }
    };
    const onConfirm = (e) => {
      const c = e.detail;
      if (!c || !c.id) return;
      setConfirms((prev) => [...prev, c]);
    };
    window.addEventListener('sagemro:toast', onToast);
    window.addEventListener('sagemro:confirm', onConfirm);
    return () => {
      window.removeEventListener('sagemro:toast', onToast);
      window.removeEventListener('sagemro:confirm', onConfirm);
    };
  }, [dismissToast]);

  // ESC 关闭当前最上层 confirm（视作取消）
  useEffect(() => {
    if (confirms.length === 0) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        const top = confirms[confirms.length - 1];
        resolveConfirm(top.id, false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirms, resolveConfirm]);

  return (
    <>
      {/* Toast 容器：右下角堆叠 */}
      <div className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>

      {/* 只渲染栈顶 confirm */}
      <AnimatePresence>
        {confirms.length > 0 && (
          <ConfirmDialog
            key={confirms[confirms.length - 1].id}
            dialog={confirms[confirms.length - 1]}
            onResolve={resolveConfirm}
          />
        )}
      </AnimatePresence>
    </>
  );
}
