import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createDevice } from '../../services/api';
import { isCnLocale } from '../../utils/locale';

const typeLabelsCn = {
  'Laser Cutter': '激光切割机',
  'Press Brake': '折弯机',
  'Punch Press': '冲床',
  'Shearing Machine': '剪板机',
  'Welding Machine': '焊接设备',
  'Plasma Cutter': '等离子切割机',
  'Waterjet Cutter': '水切割机',
  'Plate Rolling Machine': '卷板机',
  'Riveting Machine': '铆接设备',
  'Spray Coating Equipment': '喷涂设备',
  Other: '其他',
};

const EMPTY_FORM = {
  name: '',
  type: '',
  brand: '',
  model: '',
  power: '',
};

export function DeviceForm({ onClose, onSuccess, initialValues = null, title, submitLabel }) {
  const isCn = isCnLocale();
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(initialValues || {}) });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const commonTypes = [
    'Laser Cutter', 'Press Brake', 'Punch Press', 'Shearing Machine',
    'Welding Machine', 'Plasma Cutter', 'Waterjet Cutter',
    'Plate Rolling Machine', 'Riveting Machine', 'Spray Coating Equipment', 'Other'
  ];

  useEffect(() => {
    setForm({ ...EMPTY_FORM, ...(initialValues || {}) });
    setError('');
  }, [initialValues]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.type) {
      setError(isCn ? '请选择设备类型' : 'Please select a device type');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await createDevice(form);
      onSuccess(result.device);
    } catch (err) {
      setError(err.message || (isCn ? '设备保存失败' : 'Failed to save equipment'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-3">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto rounded-2xl bg-[var(--color-surface)] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-medium text-[var(--color-text-primary)]">
            {title || (initialValues
              ? (isCn ? '确认设备信息' : 'Confirm equipment information')
              : (isCn ? '添加设备' : 'Add equipment'))}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--color-hover)] rounded-lg">
            <X size={18} className="text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-[var(--color-primary)]/5 px-3 py-2.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {isCn ? '注册设备信息后，提交服务请求时可自动带入，无需重复填写规格。' : 'Register equipment to speed up future service requests. Saved machines let you skip re-entering specs each time.'}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 设备名称 */}
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] opacity-60 mb-1.5">
              {isCn ? '设备名称（选填）' : 'Device Name (Optional)'}
            </label>
            <input
              type="text"
              name="device-name"
              data-testid="device-name-input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder={isCn ? '例如：一号车间激光切割机' : 'e.g. Workshop #1 Laser Cutter'}
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* 设备类型 */}
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] opacity-60 mb-1.5">
              {isCn ? '设备类型' : 'Device Type'} <span className="text-red-400">*</span>
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
                  {isCn ? typeLabelsCn[t] || t : t}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={form.type}
              name="device-type"
              data-testid="device-type-input"
              onChange={e => setForm({ ...form, type: e.target.value })}
              placeholder={isCn ? '也可以手动输入其他设备类型' : 'Or enter another type'}
              className="w-full mt-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* 品牌 */}
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] opacity-60 mb-1.5">
              {isCn ? '品牌（选填）' : 'Brand (Optional)'}
            </label>
            <input
              type="text"
              value={form.brand}
              onChange={e => setForm({ ...form, brand: e.target.value })}
              placeholder={isCn ? '例如：大族、通快、百超' : "e.g. Han's Laser, Trumpf, Bystronic"}
              name="device-brand"
              data-testid="device-brand-input"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* 型号 */}
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] opacity-60 mb-1.5">
              {isCn ? '型号（选填）' : 'Model (Optional)'}
            </label>
            <input
              type="text"
              value={form.model}
              onChange={e => setForm({ ...form, model: e.target.value })}
              placeholder="e.g. G3015H"
              name="device-model"
              data-testid="device-model-input"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* 功率 */}
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] opacity-60 mb-1.5">
              {isCn ? '功率（选填）' : 'Power (Optional)'}
            </label>
            <input
              type="text"
              value={form.power}
              onChange={e => setForm({ ...form, power: e.target.value })}
              placeholder="e.g. 3000W"
              name="device-power"
              data-testid="device-power-input"
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
              {isCn ? '取消' : 'Cancel'}
            </button>
            <button
              type="submit"
              data-testid="device-form-submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-[14px] font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
            >
              {loading
                ? (isCn ? '保存中...' : 'Saving...')
                : (submitLabel || (isCn ? '保存设备' : 'Save equipment'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
