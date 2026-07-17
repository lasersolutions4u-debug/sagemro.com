import { useEffect, useState } from 'react';
import { Package, Plus, X } from 'lucide-react';
import { getDevices, deleteDevice } from '../../services/api';
import { toastError, confirmDialog } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';
import { DeviceCard } from './DeviceCard';
import { DeviceDetailPanel } from './DeviceDetailPanel';
import { DeviceForm } from './DeviceForm';
import { findMatchingDevice } from './deviceProfile';

export function MyDevicesModal({
  isOpen,
  onClose,
  currentUser,
  deviceSuggestion,
  onSuggestionHandled,
}) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const isCn = isCnLocale();
  const copy = isCn ? {
    title: '我的设备',
    add: '添加设备',
    emptyTitle: '还没有设备档案',
    emptyText: '你可以手动添加设备。对话中识别到品牌、型号等信息时，系统会先请你确认，确认后才会保存。',
    privacy: '设备档案仅用于服务记录、配件确认和维护跟进，不会公开展示。',
    loadFailed: '设备加载失败',
    deleteConfirm: '确认删除这台设备吗？',
    delete: '删除',
    deleteFailed: '删除失败',
  } : {
    title: 'My Equipment',
    add: 'Add equipment',
    emptyTitle: 'No equipment profiles yet',
    emptyText: 'Add equipment manually. When a conversation contains identifiable equipment details, SAGEMRO will ask you to confirm them before saving.',
    privacy: 'Equipment profiles are used for service records, parts checks, and maintenance follow-up. They are not displayed publicly.',
    loadFailed: 'Failed to load equipment',
    deleteConfirm: 'Delete this equipment profile?',
    delete: 'Delete',
    deleteFailed: 'Delete failed',
  };

  useEffect(() => {
    if (!isOpen || !currentUser) {
      setShowForm(false);
      setSelectedDevice(null);
      return undefined;
    }

    let cancelled = false;
    async function loadDevices() {
      try {
        setLoading(true);
        setError(null);
        const data = await getDevices();
        if (!cancelled) setDevices(data.devices || []);
      } catch (err) {
        if (!cancelled) setError(copy.loadFailed);
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDevices();
    return () => {
      cancelled = true;
    };
  }, [copy.loadFailed, isOpen, currentUser]);

  useEffect(() => {
    if (!isOpen || !deviceSuggestion || loading) return;
    const existing = findMatchingDevice(devices, deviceSuggestion);
    if (existing) {
      setSelectedDevice(existing);
      setShowForm(false);
      onSuggestionHandled?.();
      return;
    }
    setSelectedDevice(null);
    setShowForm(true);
  }, [deviceSuggestion, devices, isOpen, loading, onSuggestionHandled]);

  async function handleDelete(deviceId) {
    if (!(await confirmDialog(copy.deleteConfirm, { danger: true, confirmText: copy.delete }))) return;
    try {
      await deleteDevice(deviceId);
      setDevices((current) => current.filter((device) => device.id !== deviceId));
      if (selectedDevice?.id === deviceId) setSelectedDevice(null);
    } catch {
      toastError(copy.deleteFailed);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-3">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]">
                <Package size={18} className="text-white" />
              </div>
              <h2 className="text-[16px] font-medium text-[var(--color-text-primary)]">{copy.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedDevice(null);
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                <Plus size={15} />
                {copy.add}
              </button>
              <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--color-hover)]">
                <X size={18} className="text-[var(--color-text-secondary)]" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              </div>
            )}

            {error && <div className="py-8 text-center text-[14px] text-red-500">{error}</div>}

            {!loading && !error && devices.length === 0 && (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
                  <Package size={24} className="text-[var(--color-primary)] opacity-70" />
                </div>
                <p className="text-[14px] text-[var(--color-text-primary)] opacity-80">{copy.emptyTitle}</p>
                <p className="mx-auto mt-1.5 max-w-[360px] text-[12px] leading-relaxed text-[var(--color-text-muted)]">{copy.emptyText}</p>
                <button onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white">
                  <Plus size={16} />
                  {copy.add}
                </button>
                <p className="mt-3 text-[12px] text-[var(--color-text-muted)] opacity-50">{copy.privacy}</p>
              </div>
            )}

            {!loading && !error && devices.length > 0 && !selectedDevice && (
              <div className="space-y-3">
                {devices.map((device) => (
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
                onDelete={() => handleDelete(selectedDevice.id)}
              />
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <DeviceForm
          initialValues={deviceSuggestion}
          onClose={() => {
            setShowForm(false);
            onSuggestionHandled?.();
          }}
          onSuccess={(device) => {
            setDevices((current) => [device, ...current.filter((item) => item.id !== device.id)]);
            setSelectedDevice(device);
            setShowForm(false);
            onSuggestionHandled?.();
          }}
        />
      )}
    </>
  );
}
