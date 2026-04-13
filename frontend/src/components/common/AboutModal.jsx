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

        <div className="text-left space-y-4 text-sm text-[#08060d] dark:text-[#e4e4e7] leading-relaxed">
          <p>
            小智是智维钣金平台的 AI 助手，服务于钣金加工行业的后服务市场。它面向的不是单一设备品类，而是钣金加工全链条——激光切割机、折弯机、焊接设备、自动化产线及其周边耗材与备件——为设备使用方和售后工程师提供 7×24 小时的智能技术支持。
          </p>
          <p>
            小智的核心价值是让每一个设备用户都能在需要帮助的时刻，立刻获得专业、可靠的技术服务。无论是凌晨赶工时的一个报警代码，还是周末产线上的一次参数异常，用户不必再等待、不必再辗转——小智作为用户与工程师之间的智能枢纽，确保问题在第一时间被专业地响应。
          </p>
          <p>
            同时，小智承担着服务管理的职能：跟踪工单流转、评估服务质量，推动团队持续改进，让售后服务从依赖个人能力的不确定状态，走向稳定、可衡量、可持续提升的良性循环。
          </p>
          <p className="font-medium text-[#f59e0b]">
            让天下没有难做的售后服务。
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
