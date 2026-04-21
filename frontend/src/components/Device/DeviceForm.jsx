import { useState } from 'react';
import { X } from 'lucide-react';
import { createDevice } from '../../services/api';

export function DeviceForm({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: '',
    type: '',
    brand: '',
    model: '',
    power: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const commonTypes = [
    '激光切割机', '折弯机', '冲床', '剪板机',
    '焊接机', '等离子切割机', '水刀切割机',
    '卷板机', '压铆机', '喷涂设备', '其他'
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.type) {
      setError('请选择设备类型');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await createDevice(form);
      onSuccess(result.device);
    } catch (err) {
      setError(err.message || '添加失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--color-sidebar)] rounded-2xl shadow-2xl w-full max-w-md p-5"
           style={{ maxWidth: '420px' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-medium text-[var(--color-sidebar-text)]">添加设备</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--color-hover)] rounded-lg">
            <X size={18} className="text-[var(--color-sidebar-text)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 设备名称 */}
          <div>
            <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">
              设备名称（选填）
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="例如：车间1号激光机"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* 设备类型 */}
          <div>
            <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">
              设备类型 <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {commonTypes.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, type: t })}
                  className={`px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                    form.type === t
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
              placeholder="或输入其他类型"
              className="w-full mt-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* 品牌 */}
          <div>
            <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">
              品牌（选填）
            </label>
            <input
              type="text"
              value={form.brand}
              onChange={e => setForm({ ...form, brand: e.target.value })}
              placeholder="例如：大族、通快、百超"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* 型号 */}
          <div>
            <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">
              型号（选填）
            </label>
            <input
              type="text"
              value={form.model}
              onChange={e => setForm({ ...form, model: e.target.value })}
              placeholder="例如：G3015H"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* 功率 */}
          <div>
            <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">
              功率（选填）
            </label>
            <input
              type="text"
              value={form.power}
              onChange={e => setForm({ ...form, power: e.target.value })}
              placeholder="例如：3000W"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {error && (
            <div className="text-[13px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] rounded-lg text-[14px] font-medium hover:bg-[var(--color-hover)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-[14px] font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
            >
              {loading ? '添加中...' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}