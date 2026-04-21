import { Bot, Receipt, Sparkles, ClipboardCheck } from 'lucide-react';

const quickQuestions = [
  '光纤激光切割机切6mm碳钢，断面有纹路怎么调整参数？',
  '折弯机折出来角度不稳定，回弹怎么补偿？',
  'MIG焊接不锈钢，焊缝出现气孔怎么排查？',
  '我们想提高产线自动化程度，从哪些设备入手比较合适？',
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
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <div className="text-center max-w-2xl w-full">
        {/* Logo */}
        <div className="w-[80px] h-[80px] rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-6">
          <Bot size={40} className="text-white" />
        </div>

        {/* 标题 */}
        <h1 className="text-[28px] font-medium text-[var(--color-text-primary)] mb-2">
          你好，我是小智
        </h1>
        <p className="text-[15px] text-[var(--color-text-secondary)] mb-6 leading-relaxed">
          钣金加工行业智能服务平台
        </p>

        {/* 平台价值卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {valueProps.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="px-4 py-4 bg-[var(--color-surface-elevated)] rounded-xl text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center mb-2">
                <Icon size={18} className="text-[var(--color-primary)]" />
              </div>
              <div className="text-[14px] font-medium text-[var(--color-text-primary)] mb-1">
                {title}
              </div>
              <div className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                {desc}
              </div>
            </div>
          ))}
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
