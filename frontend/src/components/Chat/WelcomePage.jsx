import {
  Calculator,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { isCnLocale } from '../../utils/locale';

const copy = {
  en: {
    eyebrow: 'SAGEMRO Service OS',
    headline: 'Equipment trouble? Chat now. Get answers instantly.',
    intro: 'Cutting issue, bending problem, or welding alarm? Describe what you are seeing on site, and let SAGEMRO AI analyze it and offer suggestions.',
    resourceTitle: 'Useful shop-floor tools',
    resources: [
      { icon: Calculator, label: 'Bend Simulator', desc: 'Preview bend sequence, tooling fit, and process risks', href: '/tools/bend-simulator' },
      { icon: Calculator, label: 'Material Weight', desc: 'Estimate sheet, tube, angle, channel, and profile weight', href: '/tools/metal-weight-calculator' },
      { icon: Calculator, label: 'Laser Cutting Cost', desc: 'Estimate cutting time, machine cost, gas, and setup', href: '/tools/laser-cutting-cost-calculator' },
      { icon: Calculator, label: 'Steel Price Budget', desc: 'Plan material budget from weight and reference price', href: '/tools/steel-price-watch' },
    ],
  },
  zh: {
    eyebrow: 'SAGEMRO 智能服务系统',
    headline: '机器的问题，难不倒有心的人',
    intro: '描述激光切割、折弯、焊接现场，让 SageMRO AI 助你快速拨开故障迷雾，做设备最明智的主人。',
    resourceTitle: '公开工具',
    resources: [
      { icon: Calculator, label: '折弯模拟器', desc: '预览折弯顺序、模具匹配和工艺风险', href: '/tools/bend-simulator' },
      { icon: Calculator, label: '材料重量计算器', desc: '估算板材、管材、角钢、槽钢和型材重量', href: '/tools/metal-weight-calculator' },
      { icon: Calculator, label: '激光切割成本估算', desc: '估算切割时间、设备成本、气体和调机费用', href: '/tools/laser-cutting-cost-calculator' },
      { icon: Calculator, label: '钢材价格预算', desc: '按理论重量和参考价格规划材料预算', href: '/tools/steel-price-watch' },
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

        <div className="mx-auto mt-7 max-w-4xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-sm sm:p-5">
          <div className="mb-2 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            {t.resourceTitle}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
