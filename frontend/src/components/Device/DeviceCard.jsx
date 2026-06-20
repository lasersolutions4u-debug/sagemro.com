import { Package, ChevronRight, Wrench } from 'lucide-react';
import { isCnLocale } from '../../utils/locale';

const statusLabelsCn = {
  Normal: '正常',
  Running: '运行中',
  Maintenance: '维护中',
};

export function DeviceCard({ device, onClick, onDelete }) {
  const isCn = isCnLocale();
  const statusColors = {
    'Normal': 'bg-green-500',
    'Running': 'bg-yellow-500',
    'Maintenance': 'bg-orange-500'
  };

  const statusColor = statusColors[device.status] || 'bg-gray-500';

  return (
    <div
      onClick={onClick}
      className="bg-[var(--color-surface-elevated)] rounded-xl p-4 cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/15 flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-[var(--color-primary)]" />
          </div>
          <div>
            <h3 className="text-[14px] font-medium text-[var(--color-text-primary)]">
              {device.name || device.type}
            </h3>
            <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
              {device.type}
              {device.brand ? ` | ${device.brand}` : ''}
              {device.power ? ` | ${device.power}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-[12px] text-[var(--color-text-secondary)]">
            {isCn ? statusLabelsCn[device.status] || device.status : device.status}
          </span>
          <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
          <Wrench size={12} />
          <span>{device.total_orders || 0} {isCn ? '次服务' : 'services'}</span>
        </div>
        {device.last_order_date && (
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
            <span>{isCn ? '最近一次：' : 'Latest: '}{device.last_order_date}</span>
          </div>
        )}
        {device.completed_orders !== undefined && (
          <div className="text-[12px] text-green-500 opacity-80">
            {isCn ? `已完成 ${device.completed_orders} 次` : `${device.completed_orders} completed`}
          </div>
        )}
      </div>
    </div>
  );
}
