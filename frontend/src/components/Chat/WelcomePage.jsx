import { Bot, Receipt, Sparkles, ClipboardCheck } from 'lucide-react';

const quickQuestions = [
  '激光切割挂渣怎么解决？',
  '切割断面有纹路怎么调？',
  '折弯回弹怎么补偿？',
  '切割头多久保养一次？',
];

const valueProps = [
  {
    icon: Receipt,
    title: '报价透明',
    desc: '平台核价 · AI 对照地区均价审核',
  },
  {
    icon: Sparkles,
    title: '精准匹配',
    desc: '按设备品牌、专长、评分自动推荐',
  },
  {
    icon: ClipboardCheck,
    title: '全程记录',
    desc: '工单对话与服务过程平台长期留存',
  },
];

export function WelcomePage({ onSendMessage }) {
  return (
    <div className="flex flex-col items-center justify-start sm:justify-center min-h-full px-4 sm:px-6 py-6 sm:py-8">
      <div className="text-center max-w-2xl w-full">
        {/* Logo */}
        <div className="w-[64px] h-[64px] sm:w-[80px] sm:h-[80px] rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-4 sm:mb-6">
          <Bot size={32} className="text-white sm:hidden" />
          <Bot size={40} className="text-white hidden sm:block" />
        </div>

        {/* Title */}
        <h1 className="text-[22px] sm:text-[28px] font-medium text-[var(--color-text-primary)] mb-1.5 sm:mb-2">
          你好，我是小智
        </h1>
        <p className="text-[14px] sm:text-[15px] text-[var(--color-text-secondary)] mb-5 sm:mb-6 leading-relaxed">
          钣金加工行业智能服务平台
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
