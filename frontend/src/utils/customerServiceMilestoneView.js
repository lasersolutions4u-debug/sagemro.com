import { getServicePromiseCopy } from '../data/servicePromise.js';

const PUBLIC_STATES = new Set([
  'completed',
  'current',
  'upcoming',
  'legacy_not_recorded',
]);

export function buildCustomerServiceMilestoneView(isCn, milestones) {
  const servicePromise = getServicePromiseCopy(isCn);
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
  const milestoneStates = new Map();

  for (const milestone of Array.isArray(milestones) ? milestones : []) {
    if (
      servicePromise.steps.some((step) => step.key === milestone?.key)
      && PUBLIC_STATES.has(milestone?.state)
    ) {
      milestoneStates.set(milestone.key, milestone.state);
    }
  }

  const steps = servicePromise.steps.map((step) => {
    const state = milestoneStates.get(step.key) || 'upcoming';
    const stateLabel = state === 'completed'
      ? copy.completed
      : state === 'current'
        ? copy.current
        : state === 'legacy_not_recorded'
          ? copy.legacy
          : copy.upcoming;
    return { ...step, state, stateLabel };
  });

  return {
    copy,
    steps,
    currentStep: steps.find((step) => step.state === 'current') || null,
  };
}
