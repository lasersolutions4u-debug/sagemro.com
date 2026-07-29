const STEP_KEYS = [
  'task_alignment',
  'risk_control',
  'one_visit_readiness',
  'evidence_execution',
  'recovery_verification',
  'transparent_handover',
];

const COPY = {
  zh: {
    promise: '每一次服务，都有准备、有依据、有验证、有交付。',
    values: [
      { key: 'risk', title: '更早发现风险', detail: 'AI 整理事实，专业人员确认边界。' },
      { key: 'ready', title: '更充分地准备', detail: '减少信息缺失和不必要的重复上门。' },
      { key: 'evidence', title: '每一步有证据', detail: '诊断、处理和验证过程可追溯。' },
      { key: 'asset', title: '让服务形成资产', detail: '报告进入持续关联的设备服务档案。' },
    ],
    steps: [
      ['任务对齐', '到场前，把问题说清楚'],
      ['风险锁定', '动手前，把风险控住'],
      ['一次备齐', '出发前，把资源准备充分'],
      ['循证执行', '服务中，每一步都有依据'],
      ['恢复验证', '交付前，用结果证明恢复'],
      ['透明交付', '完工后，让服务形成闭环'],
    ],
  },
  en: {
    promise: 'Every service is prepared, evidence-based, verified, and clearly delivered.',
    values: [
      { key: 'risk', title: 'See risk earlier', detail: 'AI organizes facts; qualified people confirm the boundary.' },
      { key: 'ready', title: 'Prepare more completely', detail: 'Reduce missing information and avoidable repeat visits.' },
      { key: 'evidence', title: 'Keep evidence at every step', detail: 'Diagnosis, actions, and verification remain traceable.' },
      { key: 'asset', title: 'Turn service into an asset', detail: 'Reports stay connected to the equipment service record.' },
    ],
    steps: [
      ['Task Alignment', 'Clarify the issue before arrival'],
      ['Risk Control', 'Control risk before action'],
      ['One-Visit Readiness', 'Prepare resources before departure'],
      ['Evidence-Based Execution', 'Keep evidence for every action'],
      ['Recovery Verification', 'Prove the result before handover'],
      ['Transparent Handover', 'Close the loop with a clear record'],
    ],
  },
};

export function getServicePromiseCopy(isCn) {
  const copy = isCn ? COPY.zh : COPY.en;

  return {
    ...copy,
    values: copy.values.map((value) => ({ ...value })),
    steps: copy.steps.map(([title, detail], index) => ({
      key: STEP_KEYS[index],
      number: index + 1,
      title,
      detail,
    })),
  };
}
