import { FileText, ClipboardList, Settings, Info, Plus } from 'lucide-react';

export function ToolBar({ onOpenWorkOrder, onOpenMyWorkOrders, onOpenSettings, onOpenAbout }) {
  const tools = [
    { icon: FileText, label: '提交工单', onClick: onOpenWorkOrder },
    { icon: ClipboardList, label: '我的工单', onClick: onOpenMyWorkOrders },
    { icon: Settings, label: '设置', onClick: onOpenSettings },
    { icon: Info, label: '关于小智', onClick: onOpenAbout },
  ];

  return (
    <div className="border-t border-[#2a2a3c] pt-3 mt-auto">
      {tools.map((tool) => (
        <button
          key={tool.label}
          onClick={tool.onClick}
          className="w-full flex items-center gap-3 px-4 py-3 text-[15px] text-[#cdd6f4] hover:bg-[#2a2a3c] rounded-lg mx-1 transition-colors"
        >
          <tool.icon size={18} />
          <span>{tool.label}</span>
        </button>
      ))}
    </div>
  );
}
