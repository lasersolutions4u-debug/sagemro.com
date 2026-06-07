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
  '理解报警、照片、切割质量、备件、维保和新机需求',
  '把零散描述整理成可确认、可派工、可归档的服务摘要',
  '用 AI 提升响应效率，由 SAGEMRO 官方服务承接关键确认',
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
            把设备问题，变成清晰可靠的服务路径。
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
            直接告诉 SAGEMRO 现场发生了什么。AI 会读取关键信息和图片，追问必要细节，并把问题整理成可由官方服务继续跟进的清晰方案。
          </p>
        </div>

        <div className="mx-auto mt-7 max-w-3xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 text-left shadow-sm sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/12 text-[var(--color-primary)]">
              <ClipboardCheck size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                一次对话，推进六类服务结果。
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)] sm:text-sm">
                你只需要像和工程师沟通一样说明情况。SAGEMRO 会引导对话、提取关键细节，并在聊天中让你确认结构化信息。
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
