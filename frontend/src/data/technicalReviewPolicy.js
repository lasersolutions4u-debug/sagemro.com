const REVIEW_DATE = '2026-08-06';

const POLICIES = {
  en: {
    title: 'How SAGEMRO technical content is prepared and reviewed',
    seoTitle: 'Technical Content Review Policy | SAGEMRO',
    description: 'How the SAGEMRO Technical Service Team prepares, checks, dates, corrects, and limits public technical content.',
    intro: 'The SAGEMRO Technical Service Team prepares and reviews public service pages, diagnostic guides, and calculator explanations. This page describes the checks behind that content and the limits readers should keep in mind.',
    publishedAt: REVIEW_DATE,
    reviewedAt: REVIEW_DATE,
    sections: [
      {
        heading: 'Who prepares the content',
        body: 'The SAGEMRO Technical Service Team organizes equipment-service information into practical pages. The team separates observable symptoms from diagnosis, states the information needed for review, and marks when a next step must move to qualified service.',
      },
      {
        heading: 'How technical checks are performed',
        body: 'A technical check compares each public instruction with its cited evidence, confirms that the sequence stays within external and non-invasive observations, and checks the stop and escalation boundaries. A guide is published only when the available evidence supports its complete public sequence; otherwise it remains unpublished.',
      },
      {
        heading: 'Evidence we accept',
        body: 'Accepted evidence includes relevant public material from equipment manufacturers, component makers, and standards or safety bodies, plus approved internal evidence that can be documented and checked. A source is used only for the claims it supports, and its title, publisher, URL, and access date are recorded on published diagnostic guides.',
      },
      {
        heading: 'Publication dates and corrections',
        body: 'Published content shows a publication date and a last-reviewed date. When evidence or a safety boundary changes, the team reviews the affected page, corrects the public text, and updates the review date when the review is completed.',
      },
      {
        heading: 'OEM and qualified-person limits',
        body: 'Model-specific settings, protected calibration, safety circuits, energized electrical work, pressurized hydraulic work, and other safety-critical procedures require the applicable OEM procedure or a qualified person. The machine manual, site energy-control procedure, and locally applicable requirements control the actual work.',
      },
    ],
    errorReporting: 'To report a possible error, email support@sagemro.com with the page URL, the statement or step in question, and any source or equipment context that can help the review.',
  },
  'zh-CN': {
    title: 'SAGEMRO 技术内容如何编写与审核',
    seoTitle: '技术内容审核政策 | SAGEMRO',
    description: '说明 SAGEMRO 技术服务团队如何编写、核查、标注日期、更正并限定公开技术内容的适用范围。',
    intro: 'SAGEMRO 技术服务团队负责公开服务页面、诊断指南和计算器说明的编写与审核。本页说明这些内容采用的核查方法，以及读者在使用时需要注意的边界。',
    publishedAt: REVIEW_DATE,
    reviewedAt: REVIEW_DATE,
    sections: [
      {
        heading: '内容由谁编写',
        body: 'SAGEMRO 技术服务团队将设备服务信息整理为实用页面。团队会区分可观察现象与诊断结论，说明评估所需信息，并标明何时必须升级给合格服务人员。',
      },
      {
        heading: '如何进行技术核查',
        body: '技术核查会将每项公开说明与其引用证据逐项对照，确认检查顺序仅包含外部、非侵入式观察，并核查停止和升级边界。只有现有证据能够支持完整公开流程时，指南才会发布；否则保持未发布状态。',
      },
      {
        heading: '接受的证据',
        body: '可接受证据包括设备制造商、部件制造商、标准机构或安全机构发布的相关公开资料，以及能够记录并复核的已批准内部证据。资料只用于其实际支持的陈述；已发布诊断指南会记录来源标题、发布方、网址和访问日期。',
      },
      {
        heading: '发布日期与更正',
        body: '已发布内容会显示发布日期和最后审核日期。当证据或安全边界发生变化时，团队会复核受影响页面、更正公开文字，并在审核完成后更新审核日期。',
      },
      {
        heading: 'OEM 与合格人员边界',
        body: '具体机型设置、受保护校准、安全回路、带电电气作业、带压液压作业及其他安全关键程序，必须采用适用的 OEM 程序或由合格人员执行。实际工作应以设备手册、现场能量控制程序和当地适用要求为准。',
      },
    ],
    errorReporting: '如需报告可能的错误，请发送邮件至 support@sagemro.com，并提供页面网址、有疑问的陈述或步骤，以及有助于复核的来源或设备背景。',
  },
};

export function getTechnicalReviewPolicy(locale = 'en') {
  const policy = POLICIES[locale] ?? POLICIES.en;
  return {
    ...policy,
    sections: policy.sections.map((section) => ({ ...section })),
  };
}
