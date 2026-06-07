import { Bot, ClipboardCheck, Globe2, Wrench } from 'lucide-react';
import { AIToolsPanel } from '../AI/AIToolsPanel';

const quickQuestions = [
  'How to fix laser cutting dross?',
  'How to adjust cutting surface lines?',
  'Which spare parts should I keep for a fiber laser?',
  'What laser power should I choose for 20mm carbon steel?',
];

const valueProps = [
  {
    icon: Wrench,
    title: 'Official Service Team',
    desc: 'SAGEMRO receives, diagnoses, and coordinates service under one standard',
  },
  {
    icon: Globe2,
    title: 'Laser & Sheet Metal Focus',
    desc: 'Built for laser cutters, press brakes, welding, automation, and spare parts',
  },
  {
    icon: ClipboardCheck,
    title: 'Service Records',
    desc: 'Every request becomes equipment history, repair records, and follow-up actions',
  },
];

export function WelcomePage({ onSendMessage }) {
  return (
    <div className="flex flex-col items-center justify-start min-h-full px-4 sm:px-6 py-6 sm:py-8">
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
          AI-powered diagnostics, official SAGEMRO service requests, spare parts, maintenance plans, and Euchio new-machine selection in one operating system.
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
        <div className="mt-6 mb-3 text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
          Quick AI Prompts
        </div>
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
