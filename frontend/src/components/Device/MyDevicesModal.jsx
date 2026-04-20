import { useState, useEffect } from 'react';
import { X, Package, Plus, ChevronRight, Star, Calendar, Wrench } from 'lucide-react';
import { getDevices, deleteDevice } from '../../services/api';
import { DeviceCard } from './DeviceCard';
import { DeviceDetailPanel } from './DeviceDetailPanel';
import { DeviceForm } from './DeviceForm';

export function MyDevicesModal({ isOpen, onClose, currentUser }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadDevices();
    }
  }, [isOpen, currentUser]);

  async function loadDevices() {
    try {
      setLoading(true);
      setError(null);
      const data = await getDevices();
      setDevices(data.devices || []);
    } catch (err) {
      setError('加载设备失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(deviceId) {
    if (!confirm('确定删除这个设备吗？')) return;
    try {
      await deleteDevice(deviceId);
      setDevices(devices.filter(d => d.id !== deviceId));
      if (selectedDevice?.id === deviceId) {
        setSelectedDevice(null);
      }
    } catch (err) {
      alert('删除失败');
    }
  }

  function handleDeviceAdded(newDevice) {
    setDevices([newDevice, ...devices]);
    setShowForm(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--color-sidebar)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
           style={{ maxWidth: '600px' }}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-[#3a3a4c]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1677ff] flex items-center justify-center">
              <Package size={18} className="text-white" />
            </div>
            <h2 className="text-[16px] font-medium text-[var(--color-sidebar-text)]">我的设备</h2>
          </div>
          <div className="flex items-center gap-2">
            {currentUser?.userType === 'customer' && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#1677ff] hover:bg-[#1668cc] text-white rounded-lg text-[13px] transition-colors"
              >
                <Plus size={14} />
                添加设备
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-[#3a3a4c] rounded-lg transition-colors">
              <X size={18} className="text-[var(--color-sidebar-text)]" />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-[#1677ff] border-t-transparent rounded-full" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-[#ff6b6b] text-[14px]">{error}</div>
          )}

          {!loading && !error && devices.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#3a3a4c] flex items-center justify-center">
                <Package size={24} className="text-[var(--color-sidebar-text)] opacity-50" />
              </div>
              <p className="text-[14px] text-[var(--color-sidebar-text)] opacity-60">暂无设备</p>
              <p className="text-[12px] text-[var(--color-sidebar-text)] opacity-40 mt-1">添加设备后，小智可以为您提供更精准的服务</p>
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

          {showForm && (
            <DeviceForm
              onClose={() => setShowForm(false)}
              onSuccess={handleDeviceAdded}
            />
          )}
        </div>
      </div>
    </div>
  );
}