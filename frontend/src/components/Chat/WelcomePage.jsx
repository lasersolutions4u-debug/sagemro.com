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
        <h1 className="text-[28px] font-medium text-[#08060d] dark:text-[#f3f4f6] mb-2">
          你好，我是小智
        </h1>
        <p className="text-[15px] text-[#6b6375] mb-8 leading-relaxed">
          激光切割与焊接设备技术顾问<br />
          有什么可以帮你的？
        </p>

        {/* 快捷提问 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickQuestions.map((question, i) => (
            <button
              key={i}
              onClick={() => onSendMessage(question)}
              className="px-4 py-3 text-[14px] text-left bg-[#f4f3f4] dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#e0e0e0] rounded-xl hover:bg-[#e5e4e7] dark:hover:bg-[#3a3a4c] transition-colors leading-relaxed"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
