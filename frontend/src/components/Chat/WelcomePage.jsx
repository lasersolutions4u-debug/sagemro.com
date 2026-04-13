import { Bot } from 'lucide-react';

const quickQuestions = [
  '激光切割机切出来毛刺多怎么办？',
  '光纤激光器和CO2激光器怎么选？',
  '切割头需要多久保养一次？',
  '激光焊接的参数怎么调？',
];

export function WelcomePage({ onSendMessage }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <div className="text-center max-w-lg">
        {/* Logo */}
        <div className="w-[80px] h-[80px] rounded-2xl bg-[#f59e0b] flex items-center justify-center mx-auto mb-6">
          <Bot size={40} className="text-white" />
        </div>

        {/* 标题 */}
        <h1 className="text-[28px] font-medium text-[var(--color-text-primary)] mb-2">
          你好，我是小智
        </h1>
        <p className="text-[15px] text-[var(--color-text-secondary)] mb-8 leading-relaxed">
          钣金加工行业智能服务平台
        </p>

        {/* 介绍文案 */}
        <div className="text-left bg-[var(--color-surface-elevated)] rounded-xl p-5 mb-8 text-left">
          <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed mb-4">
            小智是智维钣金平台的 AI 助手，服务于钣金加工行业的后服务市场。它面向的不是单一设备品类，而是钣金加工全链条——激光切割机、折弯机、焊接设备、自动化产线及其周边耗材与备件——为设备使用方和售后工程师提供 7×24 小时的智能技术支持。
          </p>
          <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed mb-4">
            小智的核心价值是让每一个设备用户都能在需要帮助的时刻，立刻获得专业、可靠的技术服务。无论是凌晨赶工时的一个报警代码，还是周末产线上的一次参数异常，用户不必再等待、不必再辗转——小智作为用户与工程师之间的智能枢纽，确保问题在第一时间被专业地响应。
          </p>
          <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
            同时，小智承担着服务管理的职能：跟踪工单流转、评估服务质量，推动团队持续改进，让售后服务从依赖个人能力的不确定状态，走向稳定、可衡量、可持续提升的良性循环。
          </p>
        </div>

        {/* 快捷提问 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickQuestions.map((question, i) => (
            <button
              key={i}
              onClick={() => onSendMessage(question)}
              className="px-4 py-3 text-[14px] text-left bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] rounded-xl hover:bg-[var(--color-hover)] transition-colors leading-relaxed"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
