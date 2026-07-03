import {
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { isCnLocale } from '../../utils/locale';

const copy = {
  en: {
    eyebrow: 'SAGEMRO Service OS',
    headline: 'Turn machine issues into a clear service path with AI-assisted support.',
    intro: 'SAGEMRO is an independent equipment service brand for laser cutting and sheet metal equipment. Describe what is happening on site, and SAGEMRO helps organize the details that matter for diagnosis, parts confirmation, maintenance planning, service coordination, or new-machine evaluation.',
    cardTitle: 'Start with what happened on site. SAGEMRO organizes the rest.',
    cardText: 'Share the alarm, symptom, machine, material, and production impact in your own words. SAGEMRO follows up in chat, asks for missing details, and helps turn scattered information into a service-ready case.',
    trustPoints: [
      'Independent third-party support for alarms, downtime, parts, maintenance, and machine-upgrade decisions',
      'Turns field context into service-ready information for review and follow-up',
      'AI helps prepare the case; diagnosis, quotation, and site safety requirements are confirmed through SAGEMRO service coordination',
    ],
    capabilities: [
      'Fault diagnosis',
      'Cutting parameters',
      'Parts identification',
      'Repair estimate',
      'Machine selection',
      'Health report',
    ],
  },
  zh: {
    eyebrow: 'SAGEMRO 智能服务系统',
    headline: '让专业 AI 协助，设备问题解决得更高效。',
    intro: 'SAGEMRO 是面向激光切割机与钣金加工设备的第三方智能服务品牌。你只需要说清现场情况，系统会帮助整理关键信息，把问题推进到故障判断、备件确认、维保安排、服务协调或新机评估。',
    cardTitle: '先把现场情况说清楚，SAGEMRO 帮你理出下一步。',
    cardText: '报警、现象、设备型号、加工材料、生产影响，都可以直接在聊天里说明。SAGEMRO 会继续追问关键缺失信息，并请你确认，把零散描述整理成后续可推进的服务依据。',
    trustPoints: [
      '第三方设备服务：报警、停机、备件、维保和新机项目，都可以从一次对话开始',
      '把现场信息整理成可审核、可跟进、可复用的服务依据',
      'AI 先协助理清问题；诊断、报价与现场安全要求再由 SAGEMRO 服务流程确认',
    ],
    capabilities: [
      '故障诊断',
      '切割参数',
      '备件识别',
      '维修预估',
      '新机选型',
      '健康报告',
    ],
  },
};

export function WelcomePage() {
  const t = isCnLocale() ? copy.zh : copy.en;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-4xl">
        <BrandMark variant="logo" className="mx-auto mb-6 h-24 w-24 object-contain drop-shadow-[0_18px_36px_rgba(245,158,11,0.24)]" />

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
