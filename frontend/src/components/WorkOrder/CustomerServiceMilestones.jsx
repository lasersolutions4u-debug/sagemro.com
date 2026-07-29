import { Check } from 'lucide-react';
import { getServicePromiseCopy } from '../../data/servicePromise';

const STATE_STYLES = {
  completed: {
    marker: 'border-green-600 bg-green-600 text-white',
    title: 'text-green-700',
  },
  current: {
    marker: 'border-orange-500 bg-orange-500 text-white',
    title: 'text-orange-700',
  },
  upcoming: {
    marker: 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]',
    title: 'text-[var(--color-text-secondary)]',
  },
  legacy_not_recorded: {
    marker: 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]',
    title: 'text-[var(--color-text-secondary)]',
  },
};

export function CustomerServiceMilestones({ isCn, milestones }) {
  const servicePromise = getServicePromiseCopy(isCn);
  const milestoneStates = new Map(
    (Array.isArray(milestones) ? milestones : []).map((milestone) => [
      milestone.key,
      milestone.state,
    ]),
  );
  const currentStep = servicePromise.steps.find(
    (step) => milestoneStates.get(step.key) === 'current',
  );
  const copy = isCn
    ? {
        eyebrow: 'SAGEMRO 精准服务闭环',
        title: '您的服务进度',
        completed: '已确认',
        current: '当前阶段',
        upcoming: '待进行',
        legacy: '早期服务记录未按步骤逐项记录',
        currentLabel: '现在进行',
        messages: '请在“消息”中查看 SAGEMRO 是否需要您补充信息。',
      }
    : {
        eyebrow: 'SAGEMRO Precision Service Loop',
        title: 'Your service progress',
        completed: 'Verified',
        current: 'Current stage',
        upcoming: 'Upcoming',
        legacy: 'Earlier service records were not itemized',
        currentLabel: 'Now in progress',
        messages: 'Check Messages for any information SAGEMRO needs from you.',
      };

  return (
    <section
      aria-labelledby="customer-service-milestones-title"
      className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
          {copy.eyebrow}
        </p>
        <h2
          id="customer-service-milestones-title"
          className="mt-1 text-base font-semibold text-[var(--color-text-primary)]"
        >
          {copy.title}
        </h2>
      </div>

      <ol className="grid gap-0 px-4 py-2 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
        {servicePromise.steps.map((step) => {
          const state = milestoneStates.get(step.key) || 'upcoming';
          const styles = STATE_STYLES[state] || STATE_STYLES.upcoming;
          const stateLabel = state === 'completed'
            ? copy.completed
            : state === 'current'
              ? copy.current
              : state === 'legacy_not_recorded'
                ? copy.legacy
                : copy.upcoming;

          return (
            <li
              key={step.key}
              aria-current={state === 'current' ? 'step' : undefined}
              className="relative flex min-w-0 gap-3 border-b border-[var(--color-border)]/70 py-3 last:border-b-0 sm:odd:pr-4 sm:even:pl-4 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${styles.marker}`}
              >
                {state === 'completed' ? <Check size={15} strokeWidth={2.5} /> : step.number}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold leading-5 ${styles.title}`}>{step.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--color-text-muted)]">{step.detail}</p>
                <p className="mt-1 text-[11px] font-medium leading-4 text-[var(--color-text-muted)]">
                  {stateLabel}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {currentStep && (
        <div className="border-t border-orange-200 bg-orange-50/70 px-4 py-3.5 sm:px-5">
          <div className="flex gap-3">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-700">
                {copy.currentLabel}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                {currentStep.title}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--color-text-secondary)]">
                {copy.messages}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
