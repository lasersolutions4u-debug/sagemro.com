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
    'Laser Cutter', 'Press Brake', 'Punch Press', 'Shearing Machine',
    'Welding Machine', 'Plasma Cutter', 'Waterjet Cutter',
    'Plate Rolling Machine', 'Riveting Machine', 'Spray Coating Equipment', 'Other'
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.type) {
      setError('Please select a device type');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await createDevice(form);
      onSuccess(result.device);
    } catch (err) {
      setError(err.message || 'Failed to add');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-md p-5"
           style={{ maxWidth: '420px' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-medium text-[var(--color-text-primary)]">Add Equipment</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--color-hover)] rounded-lg">
            <X size={18} className="text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 设备名称 */}
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] opacity-60 mb-1.5">
              Device Name (Optional)
            </label>
            <input
              type="text"
              name="device-name"
              data-testid="device-name-input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Workshop #1 Laser Cutter"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* 设备类型 */}
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] opacity-60 mb-1.5">
              Device Type <span className="text-red-400">*</span>
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
              name="device-type"
              data-testid="device-type-input"
              onChange={e => setForm({ ...form, type: e.target.value })}
              placeholder="Or enter another type"
              className="w-full mt-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* 品牌 */}
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] opacity-60 mb-1.5">
              Brand (Optional)
            </label>
            <input
              type="text"
              value={form.brand}
              onChange={e => setForm({ ...form, brand: e.target.value })}
              placeholder="e.g. Han's Laser, Trumpf, Bystronic"
              name="device-brand"
              data-testid="device-brand-input"
              className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* 型号 */}
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] opacity-60 mb-1.5">
              Model (Optional)
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
              Power (Optional)
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
              Cancel
            </button>
            <button
              type="submit"
              data-testid="device-form-submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-[14px] font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}