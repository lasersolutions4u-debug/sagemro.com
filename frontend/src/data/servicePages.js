const REVIEWED_BY = 'sagemro-technical-service-team';
const PUBLISHED_AT = '2026-08-06';

const EN_PROCESS = [
  'Describe the symptom and operating context',
  'Share model, alarm, photos, and recent changes',
  'Review safe checks and decide remote or onsite escalation',
  'Record the agreed next action in the SAGEMRO service workspace',
];

const ZH_PROCESS = [
  '说明故障现象和运行工况',
  '提供设备型号、报警信息、现场照片及近期变更',
  '评估可安全执行的检查，并决定远程支持或现场升级',
  '将已确认的下一步行动记录在 SAGEMRO 服务工作区',
];

const EN_REMOTE_BOUNDARY = 'Remote support excludes energized electrical work, safety-circuit bypass, hydraulic opening under pressure, and any adjustment requiring OEM-only procedures.';
const ZH_REMOTE_BOUNDARY = '远程支持不包含带电电气作业、旁路安全回路、带压拆开液压系统，或任何仅限 OEM 程序的调整。';
const EN_ONSITE_BOUNDARY = 'Onsite availability is confirmed after equipment, location, urgency, and engineer fit are reviewed.';
const ZH_ONSITE_BOUNDARY = '现场支持的可用性须在设备、地点、紧急程度和工程师匹配情况完成评估后确认。';

const SERVICE_PAGES = {
  en: [
    {
      slug: 'laser-cutting-machine-repair',
      status: 'published',
      title: 'Laser Cutting Machine Repair & Diagnostics',
      seoTitle: 'Laser Cutting Machine Repair & Diagnostics | SAGEMRO',
      description: 'Structured repair and diagnostic support for laser cutting equipment when operating symptoms need a clear, safe next action.',
      summary: 'Share the operating context so the service team can review symptoms, available evidence, and an appropriate escalation path.',
      equipment: 'Laser cutting machines and related cutting-system equipment.',
      issues: ['Unexpected alarms or stops', 'Cut quality changes', 'Motion, gas, or process concerns'],
      process: EN_PROCESS,
      customerInputs: ['Equipment model', 'Alarm information', 'Photos of the equipment or result', 'Recent operating or setup changes'],
      remoteBoundary: EN_REMOTE_BOUNDARY,
      onsiteBoundary: EN_ONSITE_BOUNDARY,
      primaryCta: 'Request service review',
      secondaryCta: 'Prepare service information',
      reviewedBy: REVIEWED_BY,
      publishedAt: PUBLISHED_AT,
      reviewedAt: PUBLISHED_AT,
      evidenceNotes: 'Recommendations are based on the information shared and are recorded with the agreed next action.',
    },
    {
      slug: 'press-brake-repair',
      status: 'published',
      title: 'Press Brake Repair & Accuracy Support',
      seoTitle: 'Press Brake Repair & Accuracy Support | SAGEMRO',
      description: 'Repair and accuracy support for press brakes when forming results, movement, or operating behavior need careful review.',
      summary: 'Document the forming symptom and recent changes so safe checks and the next service action can be considered.',
      equipment: 'Press brakes and related metal-forming equipment.',
      issues: ['Forming accuracy concerns', 'Unusual movement or noise', 'Alarms or interrupted operation'],
      process: EN_PROCESS,
      customerInputs: ['Equipment model', 'Alarm information', 'Photos of the setup or formed result', 'Recent tooling, material, or setup changes'],
      remoteBoundary: EN_REMOTE_BOUNDARY,
      onsiteBoundary: EN_ONSITE_BOUNDARY,
      primaryCta: 'Request service review',
      secondaryCta: 'Prepare service information',
      reviewedBy: REVIEWED_BY,
      publishedAt: PUBLISHED_AT,
      reviewedAt: PUBLISHED_AT,
      evidenceNotes: 'Recommendations are based on the information shared and are recorded with the agreed next action.',
    },
    {
      slug: 'remote-diagnostics',
      status: 'published',
      title: 'Industrial Equipment Remote Diagnostics',
      seoTitle: 'Industrial Equipment Remote Diagnostics | SAGEMRO',
      description: 'Remote diagnostic support helps organize symptoms, operating context, and safe next checks for industrial equipment.',
      summary: 'Use a structured review to decide whether remote guidance is appropriate or an onsite escalation should be considered.',
      equipment: 'Industrial laser, forming, and associated production equipment.',
      issues: ['Alarms or unexpected stops', 'Changes in operating behavior', 'Unclear symptoms needing structured review'],
      process: EN_PROCESS,
      customerInputs: ['Equipment model', 'Alarm information', 'Photos or relevant records', 'Recent operating, setup, or maintenance changes'],
      remoteBoundary: EN_REMOTE_BOUNDARY,
      onsiteBoundary: EN_ONSITE_BOUNDARY,
      primaryCta: 'Start a remote review',
      secondaryCta: 'Prepare diagnostic information',
      reviewedBy: REVIEWED_BY,
      publishedAt: PUBLISHED_AT,
      reviewedAt: PUBLISHED_AT,
      evidenceNotes: 'Remote guidance is limited to the evidence available and is recorded with the agreed next action.',
    },
    {
      slug: 'preventive-maintenance',
      status: 'published',
      title: 'Preventive Maintenance for Laser and Forming Equipment',
      seoTitle: 'Preventive Maintenance for Laser and Forming Equipment | SAGEMRO',
      description: 'Preventive maintenance planning for laser and metal-forming equipment starts with operating context, observed condition, and safe service boundaries.',
      summary: 'Share maintenance records and current observations so the service team can help define a practical next action.',
      equipment: 'Laser cutting, press brake, and related metal-forming equipment.',
      issues: ['Changes in equipment condition', 'Maintenance planning questions', 'Recurring operating concerns'],
      process: EN_PROCESS,
      customerInputs: ['Equipment model', 'Current observations or alarms', 'Photos of relevant equipment areas', 'Recent maintenance and operating changes'],
      remoteBoundary: EN_REMOTE_BOUNDARY,
      onsiteBoundary: EN_ONSITE_BOUNDARY,
      primaryCta: 'Plan a maintenance review',
      secondaryCta: 'Prepare maintenance information',
      reviewedBy: REVIEWED_BY,
      publishedAt: PUBLISHED_AT,
      reviewedAt: PUBLISHED_AT,
      evidenceNotes: 'Maintenance guidance is based on the information shared and is recorded with the agreed next action.',
    },
  ],
  'zh-CN': [
    {
      slug: 'laser-cutting-machine-repair',
      status: 'published',
      title: '激光切割机维修与故障诊断',
      seoTitle: '激光切割机维修与故障诊断 | SAGEMRO',
      description: '当激光切割设备出现运行异常时，提供结构化的维修与故障诊断支持，明确安全的下一步行动。',
      summary: '请说明运行工况，服务团队将评估故障现象、已有证据和合适的升级路径。',
      equipment: '激光切割机及相关切割系统设备。',
      issues: ['异常报警或停机', '切割质量变化', '运动、气体或工艺相关问题'],
      process: ZH_PROCESS,
      customerInputs: ['设备型号', '报警信息', '设备或加工结果照片', '近期运行或设置变更'],
      remoteBoundary: ZH_REMOTE_BOUNDARY,
      onsiteBoundary: ZH_ONSITE_BOUNDARY,
      primaryCta: '提交服务评估',
      secondaryCta: '准备服务信息',
      reviewedBy: REVIEWED_BY,
      publishedAt: PUBLISHED_AT,
      reviewedAt: PUBLISHED_AT,
      evidenceNotes: '建议以已提供的信息为依据，并与确认后的下一步行动一并记录。',
    },
    {
      slug: 'press-brake-repair',
      status: 'published',
      title: '折弯机维修与精度支持',
      seoTitle: '折弯机维修与精度支持 | SAGEMRO',
      description: '当折弯结果、设备运动或运行表现需要审慎评估时，提供维修与精度支持。',
      summary: '记录折弯异常和近期变更，以便评估可安全执行的检查和下一项服务行动。',
      equipment: '折弯机及相关金属成形设备。',
      issues: ['折弯精度问题', '异常运动或噪声', '报警或运行中断'],
      process: ZH_PROCESS,
      customerInputs: ['设备型号', '报警信息', '工装或折弯结果照片', '近期模具、材料或设置变更'],
      remoteBoundary: ZH_REMOTE_BOUNDARY,
      onsiteBoundary: ZH_ONSITE_BOUNDARY,
      primaryCta: '提交服务评估',
      secondaryCta: '准备服务信息',
      reviewedBy: REVIEWED_BY,
      publishedAt: PUBLISHED_AT,
      reviewedAt: PUBLISHED_AT,
      evidenceNotes: '建议以已提供的信息为依据，并与确认后的下一步行动一并记录。',
    },
    {
      slug: 'remote-diagnostics',
      status: 'published',
      title: '工业设备远程诊断与工程师支持',
      seoTitle: '工业设备远程诊断与工程师支持 | SAGEMRO',
      description: '远程诊断支持用于整理工业设备的故障现象、运行工况和可安全执行的下一步检查。',
      summary: '通过结构化评估，判断远程指导是否适用，或是否应考虑现场升级。',
      equipment: '工业激光、金属成形及相关生产设备。',
      issues: ['报警或异常停机', '运行表现发生变化', '需要结构化评估的未知故障现象'],
      process: ZH_PROCESS,
      customerInputs: ['设备型号', '报警信息', '照片或相关记录', '近期运行、设置或维护变更'],
      remoteBoundary: ZH_REMOTE_BOUNDARY,
      onsiteBoundary: ZH_ONSITE_BOUNDARY,
      primaryCta: '发起远程评估',
      secondaryCta: '准备诊断信息',
      reviewedBy: REVIEWED_BY,
      publishedAt: PUBLISHED_AT,
      reviewedAt: PUBLISHED_AT,
      evidenceNotes: '远程指导以可获得的证据为限，并与确认后的下一步行动一并记录。',
    },
    {
      slug: 'preventive-maintenance',
      status: 'published',
      title: '激光与金属成形设备预防性维护',
      seoTitle: '激光与金属成形设备预防性维护 | SAGEMRO',
      description: '激光与金属成形设备的预防性维护规划，从运行工况、观察到的状态和安全服务边界开始。',
      summary: '请提供维护记录和当前观察情况，服务团队可据此协助明确实际的下一步行动。',
      equipment: '激光切割、折弯及相关金属成形设备。',
      issues: ['设备状态发生变化', '维护规划问题', '反复出现的运行异常'],
      process: ZH_PROCESS,
      customerInputs: ['设备型号', '当前观察情况或报警信息', '相关设备区域照片', '近期维护和运行变更'],
      remoteBoundary: ZH_REMOTE_BOUNDARY,
      onsiteBoundary: ZH_ONSITE_BOUNDARY,
      primaryCta: '规划维护评估',
      secondaryCta: '准备维护信息',
      reviewedBy: REVIEWED_BY,
      publishedAt: PUBLISHED_AT,
      reviewedAt: PUBLISHED_AT,
      evidenceNotes: '维护建议以已提供的信息为依据，并与确认后的下一步行动一并记录。',
    },
  ],
};

function clonePage(page) {
  return {
    ...page,
    issues: [...page.issues],
    process: [...page.process],
    customerInputs: [...page.customerInputs],
  };
}

export function getServicePages(locale) {
  const pages = SERVICE_PAGES[locale] ?? SERVICE_PAGES.en;
  return pages.map(clonePage);
}

export function getServicePage(slug, locale) {
  const page = SERVICE_PAGES[locale]?.find((servicePage) => servicePage.slug === slug)
    ?? SERVICE_PAGES.en.find((servicePage) => servicePage.slug === slug);
  return page ? clonePage(page) : null;
}
