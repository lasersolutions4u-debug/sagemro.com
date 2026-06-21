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

const serviceMoments = [
  { icon: MessageCircle, title: '从一次对话开始', desc: '用自然语言描述报警、备件、切割质量、维保需求或新机项目，不需要先填复杂表单。' },
  { icon: ClipboardCheck, title: '把问题整理清楚', desc: 'SAGEMRO AI 会追问关键细节，把现场情况整理成便于确认和跟进的服务摘要。' },
  { icon: Wrench, title: '进入人工确认与服务安排', desc: '涉及诊断、报价、备件、排期或现场安全时，由 SAGEMRO 官方服务继续确认。' },
];

const conversationCapabilities = [
  '故障诊断',
  '切割参数',
  '备件识别',
  '维修预估',
  '新机选型',
  '设备健康报告',
];

const serviceStandards = [
  'AI 初步指导、服务审核、工程师执行和服务归档统一遵循 SAGEMRO 服务标准',
  '设备档案、服务上下文、服务历史和报告持续关联，便于后续支持',
  'AI 用于提升准备效率；最终诊断、报价和安全要求由 SAGEMRO 官方确认',
  '备件、维保、生命周期建议和 Euchio 新机项目可以从同一服务记录自然延展',
];

export function AboutModal({ isOpen, onClose }) {
  const isCn = isCnLocale();
  const serviceName = isCn ? 'SAGEMRO 智能服务系统' : 'SAGEMRO Service OS';
  const operatorLine = isCn
    ? '济南钰峭机械有限公司'
    : 'A product of Jinan Euchio Machinery Co., Ltd.';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isCn ? `关于 ${serviceName}` : `About ${serviceName}`} size="md">
      <div className="space-y-6">
        <div className="text-center py-2">
          <BrandMark variant="logo" className="mx-auto mb-3 h-24 w-24 object-contain drop-shadow-[0_18px_36px_rgba(245,158,11,0.24)]" />
          <h2 className="text-xl font-medium text-[var(--color-text-primary)] mb-1">
            {serviceName}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            面向激光切割与钣金加工设备的 AI 辅助官方服务入口。你只需说明现场情况，SAGEMRO 会帮助梳理问题、确认关键信息，并把它推进到诊断、备件、维保、服务或新机评估。
          </p>
        </div>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            如何工作
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {serviceMoments.map(({ icon: Icon, title, desc }) => (
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
            一次对话，理清六类服务方向
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {conversationCapabilities.map((item) => (
              <div key={item} className="flex items-center gap-2 p-2 bg-[var(--color-surface-elevated)] rounded-lg">
                <Cog size={14} className="text-[var(--color-primary)] flex-shrink-0" />
                <span className="text-[12px] text-[var(--color-text-primary)]">{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
            这些能力都在同一个聊天过程中完成。SAGEMRO 会识别场景、追问关键问题，并在聊天中请你确认关键信息。
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            服务标准
          </h3>
          <div className="space-y-2">
            {serviceStandards.map((item) => (
              <div key={item} className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                <CheckCircle2 size={14} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: ShieldCheck, label: '安全优先的 AI 边界' },
            { icon: Database, label: '持续关联的设备档案' },
            { icon: FileText, label: '服务报告与后续跟进' },
          ].map(({ icon: Icon, label }) => (
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
                为设备长期价值而设计
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                每一次对话都可以整理为可复用的服务记录：让后续排故更快、备件判断更清晰、维保计划更主动，新机升级决策也更有依据。
              </p>
            </div>
          </div>
        </section>

        <div className="pt-4 border-t border-[var(--color-border)] text-center space-y-2">
          <p className="text-sm font-medium text-[var(--color-primary)]">
            你描述设备情况，SAGEMRO 把它变成可靠的下一步。
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            © 2026 SAGEMRO. All rights reserved.
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {operatorLine}
          </p>
        </div>
      </div>
    </Modal>
  );
}
