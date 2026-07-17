import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createDevice } from '../../services/api';
import { isCnLocale } from '../../utils/locale';

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
  const copy = isCn ? {
    confirmTitle: '确认设备信息',
    addTitle: '添加设备',
    typeRequired: '请选择设备类型',
    name: '设备名称（选填）',
    namePlaceholder: '例如：1 号车间激光切割机',
    type: '设备类型',
    otherType: '或输入其他设备类型',
    brand: '品牌（选填）',
    brandPlaceholder: '例如：大族、通快、百超',
    model: '型号（选填）',
    modelPlaceholder: '例如：G3015H',
    power: '功率或规格（选填）',
    powerPlaceholder: '例如：6000W',
    cancel: '取消',
    saving: '保存中...',
    save: '保存设备',
    failed: '设备保存失败',
    types: ['激光切割机', '折弯机', '冲床', '剪板机', '焊接设备', '等离子切割机', '水切割机', '卷板机', '其他'],
  } : {
    confirmTitle: 'Confirm equipment information',
    addTitle: 'Add equipment',
    typeRequired: 'Please select an equipment type',
    name: 'Equipment name (optional)',
    namePlaceholder: 'e.g. Workshop 1 laser cutter',
    type: 'Equipment type',
    otherType: 'Or enter another equipment type',
    brand: 'Brand (optional)',
    brandPlaceholder: "e.g. Han's Laser, TRUMPF, Bystronic",
    model: 'Model (optional)',
    modelPlaceholder: 'e.g. G3015H',
    power: 'Power or specification (optional)',
    powerPlaceholder: 'e.g. 6000W',
    cancel: 'Cancel',
    saving: 'Saving...',
    save: 'Save equipment',
    failed: 'Failed to save equipment',
    types: ['Laser cutting machine', 'Press brake', 'Punch press', 'Shearing machine', 'Welding machine', 'Plasma cutter', 'Waterjet cutter', 'Plate rolling machine', 'Other'],
  };

  useEffect(() => {
    setForm({ ...EMPTY_FORM, ...(initialValues || {}) });
    setError('');
  }, [initialValues]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.type) {
      setError(copy.typeRequired);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await createDevice(form);
      onSuccess(result.device);
    } catch (err) {
      setError(err.message || copy.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-3">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto rounded-2xl bg-[var(--color-surface)] p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-[15px] font-medium text-[var(--color-text-primary)]">
            {title || (initialValues ? copy.confirmTitle : copy.addTitle)}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--color-hover)]">
            <X size={18} className="text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] text-[var(--color-text-secondary)]">{copy.name}</label>
            <input
              type="text"
              name="device-name"
              data-testid="device-name-input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder={copy.namePlaceholder}
              className="w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] text-[var(--color-text-secondary)]">
              {copy.type} <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {copy.types.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, type })}
                  className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                    form.type === type
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <input
              type="text"
              name="device-type"
              data-testid="device-type-input"
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
              placeholder={copy.otherType}
              className="mt-2 w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {[
            ['brand', copy.brand, copy.brandPlaceholder],
            ['model', copy.model, copy.modelPlaceholder],
            ['power', copy.power, copy.powerPlaceholder],
          ].map(([field, label, placeholder]) => (
            <div key={field}>
              <label className="mb-1.5 block text-[12px] text-[var(--color-text-secondary)]">{label}</label>
              <input
                type="text"
                name={`device-${field}`}
                data-testid={`device-${field}-input`}
                value={form[field]}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                placeholder={placeholder}
                className="w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          ))}

          {error && <div className="rounded-lg bg-red-400/10 px-3 py-2 text-[13px] text-red-400">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-[var(--color-surface-elevated)] py-2.5 text-[14px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]">
              {copy.cancel}
            </button>
            <button type="submit" data-testid="device-form-submit" disabled={loading} className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-[14px] font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
              {loading ? copy.saving : (submitLabel || copy.save)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
