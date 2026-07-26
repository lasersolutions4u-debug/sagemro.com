import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  PackageSearch,
  ReceiptText,
  Wrench,
} from 'lucide-react';

const METRIC_COPY = {
  en: {
    title: 'Service overview',
    personalNote: 'Your personal workload and next actions.',
    teamNote: 'The regional team workload and dispatch queue.',
    personal: 'My metrics',
    team: 'Team metrics',
    labels: {
      needsAction: 'Needs action',
      todayTasks: "Today's tasks",
      pendingConfirmation: 'Pending confirmation',
      unassignedQueue: 'Unassigned queue',
      inService: 'In service',
      quotePending: 'Quote pending',
      scheduledDates: 'Scheduled dates',
      reportsDue: 'Reports due',
      partsNeeds: 'Parts needs',
    },
  },
  cn: {
    title: '服务概览',
    personalNote: '你的个人工作量和下一步任务。',
    teamNote: '区域团队工作量与待派工队列。',
    personal: '我的指标',
    team: '团队指标',
    labels: {
      needsAction: '待处理',
      todayTasks: '今日任务',
      pendingConfirmation: '待确认',
      unassignedQueue: '待派工队列',
      inService: '服务中',
      quotePending: '待报价',
      scheduledDates: '已排期日期',
      reportsDue: '待交报告',
      partsNeeds: '物料需求',
    },
  },
};

const METRICS = [
  ['needsAction', Clock3, '#c2413b'],
  ['todayTasks', CalendarDays, '#245f93'],
  ['pendingConfirmation', ClipboardCheck, '#a86600'],
  ['inService', Wrench, '#27865c'],
  ['quotePending', ReceiptText, '#6653a5'],
  ['scheduledDates', CheckCircle2, '#16728c'],
  ['reportsDue', FileCheck2, '#9b5a25'],
  ['partsNeeds', PackageSearch, '#526173'],
];

export function EngineerMetricOverview({ metrics, scope, onScopeChange, isRegionalLead, isCn, loading }) {
  const copy = isCn ? METRIC_COPY.cn : METRIC_COPY.en;
  return (
    <section className="rounded-2xl border border-[#e5e8ed] bg-white p-4 shadow-[0_2px_0_rgba(24,32,43,0.02)] sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#18202b]">{copy.title}</h2>
          <p className="mt-1 text-[13px] leading-5 text-[#697386]">{scope === 'team' ? copy.teamNote : copy.personalNote}</p>
        </div>
        {isRegionalLead && (
          <div className="inline-flex w-fit gap-1 rounded-[10px] border border-[#e5e8ed] bg-[#f7f8fa] p-1" aria-label={copy.title}>
            {[
              ['personal', copy.personal],
              ['team', copy.team],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onScopeChange(value)}
                aria-pressed={scope === value}
                className={`rounded-[7px] px-3 py-2 text-xs font-bold transition ${scope === value ? 'bg-[#18202b] text-white shadow-sm' : 'text-[#697386] hover:text-[#18202b]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {METRICS.map(([key, Icon, color]) => (
          <article key={key} className="relative min-h-[92px] overflow-hidden rounded-xl border border-[#e5e8ed] bg-white px-4 py-3">
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: color }} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold leading-4 tracking-wide text-[#697386]">{key === 'pendingConfirmation' && scope === 'team' ? copy.labels.unassignedQueue : copy.labels[key]}</span>
              <span className="grid size-7 place-items-center rounded-lg" style={{ color, backgroundColor: `${color}12` }}><Icon size={14} /></span>
            </div>
            <div className="mt-3 text-[30px] font-extrabold leading-none tracking-tight text-[#18202b]">{loading ? '—' : metrics[key] ?? 0}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
