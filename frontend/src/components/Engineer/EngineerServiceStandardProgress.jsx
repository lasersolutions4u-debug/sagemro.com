const STEP_COPY = {
  task_alignment: { en: 'Task alignment', cn: '任务对齐' },
  risk_control: { en: 'Risk control', cn: '风险控制' },
  one_visit_readiness: { en: 'One-visit readiness', cn: '一次到位准备' },
  evidence_execution: { en: 'Evidence-led work', cn: '留证执行' },
  recovery_verification: { en: 'Recovery check', cn: '恢复验证' },
  transparent_handover: { en: 'Clear handover', cn: '透明交付' },
};

const PROCESS_STEPS = Object.keys(STEP_COPY);

function isNonBlocking(item) {
  return item.state === 'confirmed'
    || item.state === 'legacy_not_recorded'
    || (item.state === 'not_applicable' && Boolean(item.notApplicableReason));
}

function progressState(step, index, currentStepIndex) {
  const requiredItems = (step.items || []).filter((item) => item.required);
  if (requiredItems.length > 0 && requiredItems.every(isNonBlocking)) return 'complete';
  if (index < currentStepIndex) return 'complete';
  if (index === currentStepIndex) return 'current';
  return 'upcoming';
}

export function EngineerServiceStandardProgress({
  isCn,
  steps = [],
  currentStepIndex = 0,
  startBlockingCount = 0,
  onToggleAll,
}) {
  const locale = isCn ? 'cn' : 'en';
  const copy = isCn
    ? {
      eyebrow: 'SAGEMRO 服务标准',
      title: '六步精密服务轨迹',
      detail: '查看全部标准项',
      current: '当前阶段',
      complete: '已完成',
      upcoming: '待进行',
      startBlockedOne: '1 个必需项未完成，暂不能开始服务',
      startBlockedMany: (count) => `${count} 个必需项未完成，暂不能开始服务`,
    }
    : {
      eyebrow: 'SAGEMRO service standard',
      title: 'Six-step precision service track',
      detail: 'Review all standard items',
      current: 'Current stage',
      complete: 'Complete',
      upcoming: 'Upcoming',
      startBlockedOne: '1 required item blocks service start',
      startBlockedMany: (count) => `${count} required items block service start`,
    };
  const suppliedSteps = new Map(steps.map((step) => [step.key, step]));
  const processSteps = PROCESS_STEPS.map((key, index) => ({
    key,
    index,
    items: [],
    ...suppliedSteps.get(key),
  }));

  return (
    <section className="rounded-2xl border border-[#e5e8ed] bg-white px-4 py-5 sm:px-6" aria-labelledby="service-standard-progress-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-600">{copy.eyebrow}</p>
          <h2 id="service-standard-progress-title" className="mt-1 text-lg font-bold text-[#18202b]">{copy.title}</h2>
        </div>
        {onToggleAll && (
          <button
            type="button"
            onClick={onToggleAll}
            className="rounded-lg border border-[#d9dde4] px-3 py-2 text-xs font-bold text-[#394455] transition-colors hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            {copy.detail}
          </button>
        )}
      </div>

      {startBlockingCount > 0 && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {startBlockingCount === 1
            ? copy.startBlockedOne
            : copy.startBlockedMany(startBlockingCount)}
        </p>
      )}

      <div className="mt-5 overflow-x-auto pb-2">
        <ol className="grid min-w-[700px] grid-cols-6" aria-label={copy.title}>
          {processSteps.map((step, index) => {
            const state = progressState(step, index, currentStepIndex);
            const isCurrent = state === 'current';
            const stateLabel = copy[state];
            return (
              <li
                key={step.key}
                className="relative pr-3 last:pr-0"
                aria-current={isCurrent ? 'step' : undefined}
              >
                {index < processSteps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-8 right-0 top-4 h-px ${state === 'complete' ? 'bg-orange-400' : 'bg-[#d9dde4]'}`}
                  />
                )}
                <div className="relative flex items-start gap-2">
                  <span
                    className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-black tabular-nums ${
                      state === 'complete'
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : isCurrent
                          ? 'border-orange-500 bg-white text-orange-700 ring-4 ring-orange-50'
                          : 'border-[#cfd5de] bg-white text-[#7c8798]'
                    }`}
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className={`text-xs font-bold leading-4 ${isCurrent ? 'text-orange-700' : 'text-[#394455]'}`}>
                      {STEP_COPY[step.key]?.[locale] || step.key}
                    </p>
                    <span className="mt-1 block text-[11px] font-medium text-[#7c8798]">{stateLabel}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
