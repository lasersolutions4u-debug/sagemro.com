import { Bot } from 'lucide-react';

const quickQuestions = [
  '激光切割机切出来毛刺多怎么办？',
  '折弯机角度有偏差怎么调整？',
  '冲床模具间隙怎么调整？',
  'MIG焊机送丝不稳怎么解决？',
];

export function WelcomePage({ onSendMessage }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <div className="text-center max-w-lg">
        {/* Logo */}
        <div className="w-[80px] h-[80px] rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-6">
          <Bot size={40} className="text-white" />
        </div>

        {/* 标题 */}
        <h1 className="text-[28px] font-medium text-[var(--color-text-primary)] mb-2">
          你好，我是小智
        </h1>
        <p className="text-[15px] text-[var(--color-text-secondary)] mb-8 leading-relaxed">
          钣金加工行业智能服务平台
        </p>

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
