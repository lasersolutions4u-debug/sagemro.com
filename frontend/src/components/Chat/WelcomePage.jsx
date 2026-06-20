import {
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';

function isChinaSite() {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.cn');
}

const copy = {
  en: {
    eyebrow: 'SAGEMRO Service OS',
    headline: 'Turn equipment problems into service-ready action.',
    intro: 'SAGEMRO helps laser cutting and sheet metal teams move from scattered symptoms to a clear next step: diagnosis, parts, maintenance, service, or a new-machine decision.',
    cardTitle: 'Describe the situation once. We organize the service path.',
    cardText: 'Start with the alarm, machine model, material, thickness, cut quality, or maintenance need. SAGEMRO AI structures the details in chat, then SAGEMRO official service confirms diagnosis, quote, and on-site safety requirements when needed.',
    trustPoints: [
      'Built for laser cutting and sheet metal equipment service',
      'Turns natural site descriptions into structured service context',
      'Keeps AI speed connected to SAGEMRO official confirmation',
    ],
    capabilities: [
      'Fault diagnosis',
      'Cutting parameters',
      'Parts and consumables',
      'Repair estimate prep',
      'Machine selection',
      'Maintenance planning',
    ],
  },
  zh: {
    eyebrow: 'SAGEMRO Service OS',
    headline: '把设备问题，快速整理成可推进的服务线索。',
    intro: 'SAGEMRO 面向激光切割与钣金加工设备，把零散的现场描述转化为清晰的下一步：故障判断、工艺参数、备件耗材、维修准备、保养计划或新机选型。',
    cardTitle: '你只需说明现场情况，SAGEMRO 负责整理关键问题。',
    cardText: '从报警代码、设备型号、材料厚度、切割质量到维护需求，SAGEMRO AI 会在对话中提炼重点、补齐关键信息；涉及诊断、报价和现场安全时，由 SAGEMRO 官方服务确认。',
    trustPoints: [
      '专注激光切割与钣金设备服务场景',
      '把自然描述整理成可跟进的服务信息',
      'AI 提速，官方服务负责确认关键结论',
    ],
    capabilities: [
      '故障初判',
      '切割参数',
      '备件耗材',
      '维修预估准备',
      '新机选型',
      '保养规划',
    ],
  },
};

export function WelcomePage() {
  const t = isChinaSite() ? copy.zh : copy.en;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-4xl">
        <BrandMark className="mx-auto mb-6 h-16 w-16 shadow-lg shadow-amber-500/20" />

        <div className="text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            <ShieldCheck size={13} className="text-[var(--color-primary)]" />
            {t.eyebrow}
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[var(--color-text-primary)] sm:text-[42px]">
            {t.headline}
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
            {t.intro}
          </p>
        </div>

        <div className="mx-auto mt-7 max-w-3xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 text-left shadow-sm sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/12 text-[var(--color-primary)]">
              <ClipboardCheck size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t.cardTitle}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)] sm:text-sm">
                {t.cardText}
              </p>
            </div>
          </div>
          <div className="grid gap-2 text-xs leading-relaxed text-[var(--color-text-secondary)] sm:grid-cols-3">
            {t.trustPoints.map((item) => (
              <div key={item} className="flex gap-2 rounded-2xl bg-[var(--color-surface)] px-3 py-2.5">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {t.capabilities.map((label) => (
              <span key={label} className="rounded-full border border-[var(--color-border)] bg-[var(--color-chat-bg)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-primary)]">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
