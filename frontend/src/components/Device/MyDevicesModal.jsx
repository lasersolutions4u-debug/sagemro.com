import { useCallback, useState, useEffect } from 'react';
import { X, Package, Sparkles } from 'lucide-react';
import { getDevices, deleteDevice } from '../../services/api';
import { toastError, confirmDialog } from '../../utils/feedback';
import { DeviceCard } from './DeviceCard';
import { DeviceDetailPanel } from './DeviceDetailPanel';
import { isCnLocale } from '../../utils/locale';

export function MyDevicesModal({ isOpen, onClose, currentUser, userType }) {
  const isCn = isCnLocale();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [error, setError] = useState(null);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDevices();
      setDevices(data.devices || []);
    } catch (err) {
      setError(isCn ? '设备加载失败' : 'Failed to load devices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isCn]);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadDevices();
    }
  }, [isOpen, currentUser, loadDevices]);

  async function handleDelete(deviceId) {
    if (!(await confirmDialog(
      isCn ? '确认删除这台设备？' : 'Are you sure you want to delete this device?',
      { danger: true, confirmText: isCn ? '删除' : 'Delete' }
    ))) return;
    try {
      await deleteDevice(deviceId);
      setDevices(devices.filter(d => d.id !== deviceId));
      if (selectedDevice?.id === deviceId) {
        setSelectedDevice(null);
      }
    } catch (err) {
      toastError(isCn ? '删除失败' : 'Delete failed');
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
            <h2 className="text-[16px] font-medium text-[var(--color-text-primary)]">{isCn ? '我的设备' : 'My Devices'}</h2>
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
              <p className="text-[14px] text-[var(--color-text-primary)] opacity-80">
                {isCn ? '设备信息会自动整理' : 'Your device info is automatically organized'}
              </p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-1.5 leading-relaxed max-w-[320px] mx-auto">
                {isCn
                  ? '当你在与 SAGEMRO 的对话中提到设备品牌、型号或其他细节时，系统会自动识别并整理到这里，不需要反复手动填写。'
                  : 'When you mention device brands, models, or other details in your conversation with SAGEMRO, it will automatically recognize and organize them here. No manual entry needed.'}
              </p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-3 opacity-50">
                {isCn
                  ? '你的设备数据仅用于 SAGEMRO 诊断、服务记录、备件建议和维保跟进，不会公开展示。'
                  : 'Your device data is only used for SAGEMRO diagnostics, service records, parts recommendations, and maintenance follow-up. It will not be publicly displayed.'}
              </p>
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
