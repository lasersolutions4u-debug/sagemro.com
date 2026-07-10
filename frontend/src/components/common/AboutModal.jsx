import { Modal } from '../common/Modal';
import { BrandMark } from './BrandMark';
import {
  CheckCircle2,
  ClipboardCheck,
  Cog,
  Database,
  FileText,
  HeartPulse,
  MessageCircle,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { isCnLocale } from '../../utils/locale';

const copy = {
  en: {
    title: 'About SAGEMRO Service OS',
    serviceName: 'SAGEMRO Service OS',
    intro: 'An AI-assisted workspace that helps customers and engineers organize machine symptoms, safety concerns, missing facts, and practical next-step options for laser cutting and sheet metal equipment.',
    howItWorks: 'How It Works',
    moments: [
      { icon: MessageCircle, title: 'Start With The Field Facts', desc: 'Describe the alarm, cut quality issue, maintenance concern, part question, or equipment decision in plain language.' },
      { icon: ClipboardCheck, title: 'Clarify What Is Known', desc: 'SAGEMRO AI may ask relevant follow-up questions and organize the case into a summary you can check.' },
      { icon: Wrench, title: 'Choose A Reviewed Next Step', desc: 'When diagnosis, quotation, parts, scheduling, or site safety matters, qualified review confirms what should happen next.' },
    ],
    outcomesTitle: 'What The Chat Can Help Clarify',
    capabilities: [
      'Observed symptoms',
      'Risk signals',
      'Missing information',
      'Process parameters',
      'Parts compatibility questions',
      'Service or purchasing options',
    ],
    outcomesText: 'The conversation should help you understand the situation before you commit to service, parts, equipment, or a purchasing path.',
    standardTitle: 'Service Standard',
    standards: [
      'AI should organize facts and explain uncertainty; it should not replace qualified on-site judgment',
      'Equipment records, service context, service history, and reports stay connected for future support',
      'Final diagnosis, quotation, purchase decisions, and safety requirements require qualified confirmation',
      'Parts, maintenance, peripherals, automation upgrades, and press brake tooling questions can be documented without turning every chat into a sales request',
    ],
    featureCards: [
      { icon: ShieldCheck, label: 'Safety-first AI boundaries' },
      { icon: Database, label: 'Connected equipment records' },
      { icon: FileText, label: 'Service reports and follow-up' },
    ],
    longTermTitle: 'Built For Long-Term Equipment Value',
    longTermText: 'Each conversation can become a reusable technical record: faster future troubleshooting, clearer parts decisions, better maintenance planning, and more transparent equipment decisions.',
    closing: 'You describe the machine. SAGEMRO helps make the next decision clearer.',
    operatorLine: 'Operated by Jinan Euchio Machinery Co., Ltd.',
  },
  zh: {
    title: '关于 SAGEMRO 智能服务系统',
    serviceName: 'SAGEMRO 智能服务系统',
    intro: 'SAGEMRO 帮助客户与工程师整理设备现象、风险和可选下一步，适用于激光切割与钣金加工设备相关的咨询、排查和决策准备。',
    howItWorks: '如何工作',
    moments: [
      { icon: MessageCircle, title: '从现场事实开始', desc: '用自然语言描述报警、切割质量、维保疑问、备件问题或设备决策，不需要先填复杂表单。' },
      { icon: ClipboardCheck, title: '把已知信息整理清楚', desc: 'SAGEMRO AI 会根据需要追问相关细节，并把情况整理成便于你确认的摘要。' },
      { icon: Wrench, title: '再选择需要确认的下一步', desc: '涉及诊断、报价、备件、排期或现场安全时，再由合格人员进一步确认。' },
    ],
    outcomesTitle: '对话可以帮助澄清什么',
    capabilities: [
      '现场现象',
      '风险信号',
      '缺失信息',
      '工艺参数',
      '备件兼容疑问',
      '服务或采购选项',
    ],
    outcomesText: '对话的目标是让你在决定服务、备件、设备或采购路径之前，先把情况理解清楚。',
    standardTitle: '服务标准',
    standards: [
      'AI 应帮助整理事实并说明不确定性，不能替代合格人员的现场判断',
      '设备档案、服务上下文、服务历史和报告持续关联，便于后续支持',
      '最终诊断、报价、采购决策和现场安全要求需要合格人员确认',
      '备件、维保、激光周边、自动化改造和折弯模具问题可以被记录清楚，但不应把每次对话都变成销售请求',
    ],
    featureCards: [
      { icon: ShieldCheck, label: '安全优先的 AI 边界' },
      { icon: Database, label: '持续关联的设备档案' },
      { icon: FileText, label: '服务报告与后续跟进' },
    ],
    longTermTitle: '为设备长期价值而设计',
    longTermText: '每一次对话都可以整理为可复用的技术记录：让后续排故更快、备件判断更清晰、维保计划更主动，设备决策也更透明。',
    closing: '你描述设备情况，SAGEMRO 帮你把下一步判断得更清楚。',
    operatorLine: '由济南钰峭机械有限公司运营',
  },
};

export function AboutModal({ isOpen, onClose }) {
  const t = isCnLocale() ? copy.zh : copy.en;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.title} size="lg">
      <div className="space-y-6">
        <div className="text-center py-2">
          <BrandMark variant="logo" className="mx-auto mb-3 h-24 w-24 object-contain drop-shadow-[0_18px_36px_rgba(245,158,11,0.24)]" />
          <h2 className="text-xl font-medium text-[var(--color-text-primary)] mb-1">
            {t.serviceName}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {t.intro}
          </p>
        </div>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            {t.howItWorks}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {t.moments.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 p-3 bg-[var(--color-surface-elevated)] rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-[var(--color-text-primary)] mb-1">
                    {title}
                  </div>
                  <div className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            {t.outcomesTitle}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {t.capabilities.map((item) => (
              <div key={item} className="flex items-center gap-2 p-2 bg-[var(--color-surface-elevated)] rounded-lg">
                <Cog size={14} className="text-[var(--color-primary)] flex-shrink-0" />
                <span className="text-[12px] text-[var(--color-text-primary)]">{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
            {t.outcomesText}
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            {t.standardTitle}
          </h3>
          <div className="space-y-2">
            {t.standards.map((item) => (
              <div key={item} className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                <CheckCircle2 size={14} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {t.featureCards.map(({ icon: Icon, label }) => (
            <div key={label} className="p-3 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-xl flex items-center gap-2">
              <Icon size={16} className="text-[var(--color-primary)] flex-shrink-0" />
              <span className="text-[12px] text-[var(--color-text-primary)]">{label}</span>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
              <HeartPulse size={16} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                {t.longTermTitle}
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                {t.longTermText}
              </p>
            </div>
          </div>
        </section>

        <div className="pt-4 border-t border-[var(--color-border)] text-center space-y-2">
          <p className="text-sm font-medium text-[var(--color-primary)]">
            {t.closing}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            © 2026 SAGEMRO. All rights reserved.
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {t.operatorLine}
          </p>
        </div>
      </div>
    </Modal>
  );
}
