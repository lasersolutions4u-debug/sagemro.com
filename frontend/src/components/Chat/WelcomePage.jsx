import { Bot, Headphones, Globe2, Users } from 'lucide-react';

const quickQuestions = [
  'How to fix laser cutting dross?',
  'How to adjust cutting surface lines?',
  'How to compensate for bending springback?',
  'How often should the cutting head be maintained?',
];

const valueProps = [
  {
    icon: Headphones,
    title: 'Free Consultation',
    desc: 'AI technical advisor available 24/7',
  },
  {
    icon: Globe2,
    title: 'All Brands Supported',
    desc: 'Any equipment brand and model',
  },
  {
    icon: Users,
    title: 'Expert Network',
    desc: 'Matched professional engineers for on-site service',
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
          Free AI Equipment Diagnostics
        </h1>
        <p className="text-[14px] sm:text-[15px] text-[var(--color-text-secondary)] mb-5 sm:mb-6 leading-relaxed">
          Upload fault photos · Instant AI analysis · Matched professional engineers
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
