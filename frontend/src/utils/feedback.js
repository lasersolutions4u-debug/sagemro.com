/**
 * 全局 toast / confirm 反馈系统 —— 替代 window.alert / window.confirm
 *
 * 用法：
 *   import { toastSuccess, toastError, toastInfo, confirmDialog } from '@/utils/feedback';
 *
 *   toastSuccess('报价已提交');
 *   toastError('网络错误，请稍后重试');
 *
 *   if (!(await confirmDialog('确定删除这个设备吗？', { danger: true }))) return;
 *
 * 为什么用 CustomEvent 而不是 Context？
 *   - 现有代码里的 alert/confirm 大量在 async 回调里调用，脱离 React 组件上下文
 *   - CustomEvent 全局可用，不需要把 useToast() 穿透到每一层
 *   - FeedbackHost 组件在根节点挂一次，订阅事件后渲染 UI
 */

let autoId = 0;
function nextId() {
  autoId = (autoId + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now()}-${autoId}`;
}

/**
 * 弹出一条 toast 提示
 * @param {string} message
 * @param {{ type?: 'info'|'success'|'error'|'warning', duration?: number }} [opts]
 */
export function toast(message, opts = {}) {
  if (typeof window === 'undefined') return;
  const { type = 'info', duration = 3200 } = opts;
  window.dispatchEvent(new CustomEvent('sagemro:toast', {
    detail: { id: nextId(), message: String(message ?? ''), type, duration },
  }));
}

export function toastSuccess(msg, opts) { toast(msg, { ...opts, type: 'success' }); }
export function toastError(msg, opts) { toast(msg, { ...opts, type: 'error', duration: 4500 }); }
export function toastInfo(msg, opts) { toast(msg, { ...opts, type: 'info' }); }
export function toastWarning(msg, opts) { toast(msg, { ...opts, type: 'warning' }); }

/**
 * 弹出确认对话框，返回 Promise<boolean>
 * @param {string} message
 * @param {{ title?: string, confirmText?: string, cancelText?: string, danger?: boolean }} [opts]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, opts = {}) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(false); return; }
    const id = nextId();
    const handler = (e) => {
      if (e.detail?.id !== id) return;
      window.removeEventListener('sagemro:confirm-result', handler);
      resolve(!!e.detail.result);
    };
    window.addEventListener('sagemro:confirm-result', handler);
    window.dispatchEvent(new CustomEvent('sagemro:confirm', {
      detail: {
        id,
        message: String(message ?? ''),
        title: opts.title || '请确认',
        confirmText: opts.confirmText || '确定',
        cancelText: opts.cancelText || '取消',
        danger: !!opts.danger,
      },
    }));
  });
}
