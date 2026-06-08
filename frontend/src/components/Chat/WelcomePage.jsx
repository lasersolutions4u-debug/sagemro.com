import {
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';

const aiCapabilities = [
  '故障诊断',
  '切割参数',
  '备件识别',
  '维修预估',
  '新机选型',
  '健康报告',
];

const trustPoints = [
  '报警、照片、备件、维保和新机项目，都可以从一次对话开始',
  '把现场零散信息沉淀成客户、工程师和 SAGEMRO 都能继续推进的服务线索',
  'AI 提升响应速度，诊断、报价与现场安全要求由 SAGEMRO 官方服务确认',
];

export function WelcomePage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-4xl">
        <BrandMark className="mx-auto mb-6 h-16 w-16 shadow-lg shadow-amber-500/20" />

        <div className="text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            <ShieldCheck size={13} className="text-[var(--color-primary)]" />
            SAGEMRO Service OS
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[var(--color-text-primary)] sm:text-[42px]">
            设备不能等，下一步要清楚。
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
            报警、停机、切割质量异常或备件需求，不该在反复转述中被耽误。SAGEMRO 帮你把现场情况带向故障判断、备件支持、维保安排、官方服务或新机决策。
          </p>
        </div>

        <div className="mx-auto mt-7 max-w-3xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 text-left shadow-sm sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/12 text-[var(--color-primary)]">
              <ClipboardCheck size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                从一句描述开始，得到一个可推进的服务方向。
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)] sm:text-sm">
                你只需要像和工程师沟通一样说明情况。SAGEMRO 在后台梳理关键细节，再在聊天中请你确认，减少反复沟通和遗漏。
              </p>
            </div>
          </div>
          <div className="grid gap-2 text-xs leading-relaxed text-[var(--color-text-secondary)] sm:grid-cols-3">
            {trustPoints.map((item) => (
              <div key={item} className="flex gap-2 rounded-2xl bg-[var(--color-surface)] px-3 py-2.5">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {aiCapabilities.map((label) => (
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
