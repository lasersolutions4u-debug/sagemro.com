import { Package, ChevronRight, Wrench } from 'lucide-react';

export function DeviceCard({ device, onClick, onDelete }) {
  const statusColors = {
    '正常': 'bg-green-500',
    '使用中': 'bg-yellow-500',
    '维保中': 'bg-orange-500'
  };

  const statusColor = statusColors[device.status] || 'bg-gray-500';

  return (
    <div
      onClick={onClick}
      className="bg-[#2a2a3c] rounded-xl p-4 cursor-pointer hover:bg-[#323248] transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#3a3a4c] flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-[#1677ff]" />
          </div>
          <div>
            <h3 className="text-[14px] font-medium text-[var(--color-sidebar-text)]">
              {device.name || device.type}
            </h3>
            <p className="text-[12px] text-[var(--color-sidebar-text)] opacity-60 mt-0.5">
              {device.type}
              {device.brand ? ` | ${device.brand}` : ''}
              {device.power ? ` | ${device.power}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-[12px] text-[var(--color-sidebar-text)] opacity-70">{device.status}</span>
          <ChevronRight size={16} className="text-[var(--color-sidebar-text)] opacity-40" />
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#3a3a4c]">
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-sidebar-text)] opacity-60">
          <Wrench size={12} />
          <span>{device.total_orders || 0}次维保</span>
        </div>
        {device.last_order_date && (
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-sidebar-text)] opacity-60">
            <span>最近：{device.last_order_date}</span>
          </div>
        )}
        {device.completed_orders !== undefined && (
          <div className="text-[12px] text-green-500 opacity-80">
            {device.completed_orders}次已完成
          </div>
        )}
      </div>
    </div>
  );
}