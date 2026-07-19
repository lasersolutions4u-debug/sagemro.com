import {
  BookOpen,
  Calculator,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { isCnLocale } from '../../utils/locale';

const copy = {
  en: {
    eyebrow: 'SAGEMRO Service OS',
    headline: 'AI for sheet metal equipment service and troubleshooting.',
    intro: 'Describe any alarm, cutting issue, bending problem, or machine symptom. SAGEMRO AI turns what you see into organized context.',
    resourceTitle: 'Useful public resources',
    resources: [
      { icon: Calculator, label: 'Calculators', desc: 'Weight, material budget, laser cost, and bending tonnage', href: '/tools' },
      { icon: BookOpen, label: 'Insights', desc: 'Practical notes for equipment and process decisions', href: '/insights' },
    ],
  },
  zh: {
    eyebrow: 'SAGEMRO 智能服务系统',
    headline: '钣金设备故障，先用 AI 看看。',
    intro: '报了什么警、切割出了什么问题、折弯不对了——描述你现场遇到的情况，SAGEMRO AI 帮你理清楚。',
    resourceTitle: '公开资源',
    resources: [
      { icon: Calculator, label: '计算工具', desc: '重量、材料预算、激光切割成本和折弯吨位', href: '/tools' },
      { icon: BookOpen, label: '行业观察', desc: '设备与工艺决策相关的实用说明', href: '/insights' },
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

        <div className="mx-auto mt-7 max-w-sm rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-sm sm:p-5">
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
  );
}
