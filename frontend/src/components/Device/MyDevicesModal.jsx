import { useState, useEffect } from 'react';
import { X, Package, Sparkles } from 'lucide-react';
import { getDevices, deleteDevice } from '../../services/api';
import { toastError, confirmDialog } from '../../utils/feedback';
import { DeviceCard } from './DeviceCard';
import { DeviceDetailPanel } from './DeviceDetailPanel';
import { getCurrentUiText } from '../../i18n/uiText';

export function MyDevicesModal({ isOpen, onClose, currentUser, userType }) {
  const t = getCurrentUiText().devices;
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadDevices() {
      try {
        setLoading(true);
        setError(null);
        const data = await getDevices();
        setDevices(data.devices || []);
      } catch (err) {
        setError(t.loadFailed);
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (isOpen && currentUser) {
      loadDevices();
    }
  }, [isOpen, currentUser, t.loadFailed]);

  async function handleDelete(deviceId) {
    if (!(await confirmDialog(t.deleteConfirm, { danger: true, confirmText: t.deleteConfirmText }))) return;
    try {
      await deleteDevice(deviceId);
      setDevices(devices.filter(d => d.id !== deviceId));
      if (selectedDevice?.id === deviceId) {
        setSelectedDevice(null);
      }
    } catch (err) {
      toastError(t.deleteFailed);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
           style={{ maxWidth: '600px' }}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
              <Package size={18} className="text-white" />
            </div>
            <h2 className="text-[16px] font-medium text-[var(--color-text-primary)]">{t.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--color-hover)] rounded-lg transition-colors">
            <X size={18} className="text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500 text-[14px]">{error}</div>
          )}

          {!loading && !error && devices.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                <Sparkles size={24} className="text-[var(--color-primary)] opacity-70" />
              </div>
              <p className="text-[14px] text-[var(--color-text-primary)] opacity-80">{t.emptyTitle}</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-1.5 leading-relaxed max-w-[320px] mx-auto">
                {t.emptyBody}
              </p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-3 opacity-50">{t.privacy}</p>
            </div>
          )}

          {!loading && !error && devices.length > 0 && !selectedDevice && (
            <div className="space-y-3">
              {devices.map(device => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onClick={() => setSelectedDevice(device)}
                  onDelete={() => handleDelete(device.id)}
                />
              ))}
            </div>
          )}

          {selectedDevice && (
            <DeviceDetailPanel
              deviceId={selectedDevice.id}
              onBack={() => setSelectedDevice(null)}
              onDelete={() => {
                handleDelete(selectedDevice.id);
                setSelectedDevice(null);
              }}
            />
          )}

        </div>
      </div>
    </div>
  );
}
