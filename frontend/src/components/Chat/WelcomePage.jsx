import { Bot, ClipboardCheck, Globe2, Wrench } from 'lucide-react';
import { AIToolsPanel } from '../AI/AIToolsPanel';

const quickQuestions = [
  '激光切割挂渣怎么解决？',
  '切割断面有纹路怎么调？',
  '激光切割机需要备哪些易损件？',
  '20mm 碳钢应该选多大功率？',
];

const valueProps = [
  {
    icon: Wrench,
    title: '官方服务',
    desc: 'SAGEMRO 统一受理、诊断和服务跟进',
  },
  {
    icon: Globe2,
    title: '聚焦钣金设备',
    desc: '激光切割、折弯、焊接、自动化与备件',
  },
  {
    icon: ClipboardCheck,
    title: '服务档案',
    desc: '沉淀设备记录、服务报告和后续维保',
  },
];

export function WelcomePage({ onSendMessage }) {
  return (
    <div className="flex flex-col items-center justify-start sm:justify-center min-h-full px-4 sm:px-6 py-6 sm:py-8">
      <div className="text-center max-w-5xl w-full">
        {/* Logo */}
        <div className="w-[64px] h-[64px] sm:w-[80px] sm:h-[80px] rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-4 sm:mb-6">
          <Bot size={32} className="text-white sm:hidden" />
          <Bot size={40} className="text-white hidden sm:block" />
        </div>

        {/* Title */}
        <h1 className="text-[22px] sm:text-[28px] font-medium text-[var(--color-text-primary)] mb-1.5 sm:mb-2">
          SAGEMRO Service OS
        </h1>
        <p className="text-[14px] sm:text-[16px] text-[var(--color-text-secondary)] mb-5 sm:mb-6 leading-relaxed max-w-3xl mx-auto">
          AI 诊断、官方服务申请、设备档案、备件确认、维保计划和 Euchio 新机选型的一体化系统。
        </p>

        {/* Value cards — mobile: vertical list, desktop: 3-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
          {valueProps.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex sm:block items-center gap-3 px-4 py-3 sm:py-4 bg-[var(--color-surface-elevated)] rounded-xl text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0 sm:mb-2">
                <Icon size={18} className="text-[var(--color-primary)]" />
              </div>
              <div>
                <div className="text-[14px] font-medium text-[var(--color-text-primary)] sm:mb-1">
                  {title}
                </div>
                <div className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <AIToolsPanel onSendMessage={onSendMessage} />

        {/* Quick questions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          {quickQuestions.map((question, i) => (
            <button
              key={i}
              onClick={() => onSendMessage(question)}
              className="px-4 py-3 text-[13px] sm:text-[14px] text-left bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] rounded-xl hover:bg-[var(--color-hover)] transition-colors leading-relaxed"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
