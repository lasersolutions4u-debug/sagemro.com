import { Modal } from '../common/Modal';
import { Bot } from 'lucide-react';

export function AboutModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="关于小智">
      <div className="text-center py-4">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-[#f59e0b] flex items-center justify-center mx-auto mb-4">
          <Bot size={32} className="text-white" />
        </div>

        <h2 className="text-xl font-medium text-[#08060d] dark:text-[#f3f4f6] mb-2">
          SAGEMRO 小智
        </h2>
        <p className="text-sm text-[#6b6375] mb-6">
          钣金加工行业智能服务平台
        </p>

        <div className="text-left space-y-3 text-sm text-[#08060d] dark:text-[#e0e0e0]">
          <p>
            小智是智维钣金平台的 AI 助手，服务于钣金加工行业的设备维修服务。
          </p>
          <p>
            小智具备三重角色：资深技术顾问、客服部门总监、人事总监。
            专注于激光切割、折弯、焊接等设备的售后服务。
          </p>
          <p>
            涵盖设备故障排查、参数调试、保养指导、工单分派、工程师评价等全流程服务。
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-[#e5e4e7] dark:border-[#3a3a4c]">
          <p className="text-xs text-[#6b6375]">
            © 2026 SAGEMRO. All rights reserved.
          </p>
        </div>
      </div>
    </Modal>
  );
}
