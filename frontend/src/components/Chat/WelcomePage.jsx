import {
  BookOpen,
  Calculator,
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { isCnLocale } from '../../utils/locale';

const copy = {
  en: {
    eyebrow: 'SAGEMRO Equipment Service',
    headline: 'Describe the machine issue. Get the facts organized before the next decision.',
    intro: 'Describe the alarm, material, machine model, production impact, or service question. The system organizes the details so you can review the issue before requesting service, parts, or further assessment.',
    cardTitle: 'Review the facts before deciding what to do.',
    cardText: 'Write what you see on site. The system may ask for missing details, flag safety concerns, and prepare a summary for you to check.',
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
    resourceTitle: 'Useful public resources',
    resources: [
      { icon: Calculator, label: 'Calculators', desc: 'Weight, material budget, laser cost, and bending tonnage', href: '/tools' },
      { icon: BookOpen, label: 'Insights', desc: 'Practical notes for equipment and process decisions', href: '/insights' },
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
    eyebrow: 'SAGEMRO 设备服务平台',
    headline: '先描述设备问题，再判断下一步。',
    intro: '请说明报警、材料、设备型号、生产影响或具体问题。系统会整理相关信息，便于你判断是否需要维修、备件或进一步检查。',
    cardTitle: '先确认现场情况，再决定怎么处理。',
    cardText: '按现场实际情况填写即可。系统会补充询问缺失信息、提示安全注意事项，并生成一份供你确认的问题摘要。',
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
    resourceTitle: '公开资源',
    resources: [
      { icon: Calculator, label: '计算工具', desc: '重量、材料预算、激光切割成本和折弯吨位', href: '/tools' },
      { icon: BookOpen, label: '行业观察', desc: '设备与工艺决策相关的实用说明', href: '/insights' },
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
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <div className="mb-2 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {t.resourceTitle}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {t.resources.map(({ icon: Icon, label, desc, href }) => (
                <a key={label} href={href} className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-chat-bg)] px-3 py-2.5 text-left transition hover:border-[var(--color-primary)]">
                  <Icon size={16} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                  <span>
                    <span className="block text-xs font-semibold text-[var(--color-text-primary)]">{label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-text-secondary)]">{desc}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
