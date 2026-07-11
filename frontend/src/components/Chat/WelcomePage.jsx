import {
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { isCnLocale } from '../../utils/locale';

const copy = {
  en: {
    eyebrow: 'SAGEMRO Service OS',
    headline: 'Describe the machine issue. Get the facts organized before the next decision.',
    intro: 'SAGEMRO AI helps organize symptoms, risks, and next-step options before any service or purchasing decision. Start with the alarm, material, machine model, production impact, or the question you are trying to answer.',
    cardTitle: 'Clear facts first. Better decisions next.',
    cardText: 'Share what is happening in your own words. SAGEMRO AI may ask relevant follow-up questions, highlight safety concerns, and turn scattered details into a clearer technical summary you can review.',
    trustPoints: [
      'Recommendations should explain assumptions, tradeoffs, and available evidence',
      'Practical context for alarms, downtime, cutting quality, parts questions, maintenance, and process planning',
      'Final diagnosis, quote, purchase, and site safety decisions still require qualified review',
    ],
    examplesTitle: 'Common starting points',
    examples: [
      'BM111 alarm during height calibration',
      'Heavy burrs on stainless steel edge',
      'Laser source power drops after warm-up',
      'Press brake angle drifts across the bend',
    ],
    capabilities: [
      'Symptom summary',
      'Risk signals',
      'Missing details',
      'Parameter context',
      'Parts questions',
      'Next options',
    ],
  },
  zh: {
    eyebrow: 'SAGEMRO 智能服务系统',
    headline: '先描述设备问题，再判断下一步。',
    intro: 'SAGEMRO AI 帮你整理设备现象、风险和可选下一步，再决定是否需要人工服务、备件或进一步评估。你可以从报警、材料、设备型号、生产影响，或者一个具体疑问开始。',
    cardTitle: '先把事实说清楚，再判断下一步。',
    cardText: '你可以用自己的话描述现场情况。SAGEMRO AI 会根据需要追问相关细节、提示安全风险，并把零散信息整理成便于你确认的技术摘要。',
    trustPoints: [
      '涉及推荐时，应说明判断假设、取舍依据和可查证信息',
      '适用于报警、停机、切割质量、备件疑问、维保和工艺判断等场景',
      '最终诊断、报价、采购和现场安全要求仍需合格人员确认',
    ],
    examplesTitle: '常见提问方式',
    examples: [
      'BM111 调高校准时报错',
      '不锈钢切割边缘毛刺很重',
      '激光器预热后功率下降',
      '折弯角度沿长度方向漂移',
    ],
    capabilities: [
      '现象摘要',
      '风险提示',
      '缺失信息',
      '参数背景',
      '备件疑问',
      '可选下一步',
    ],
  },
};

export function WelcomePage() {
  const t = isCnLocale() ? copy.zh : copy.en;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-4xl">
        <BrandMark variant="logo" className="mx-auto mb-5 h-16 w-16 object-contain drop-shadow-[0_18px_36px_rgba(245,158,11,0.18)]" />

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
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <div className="mb-2 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {t.examplesTitle}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {t.examples.map((item) => (
                <div key={item} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-chat-bg)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
