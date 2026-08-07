const TECHNICAL_SERVICE_TEAM_ID = 'sagemro-technical-service-team';

const TECHNICAL_AUTHORS = {
  en: {
    id: TECHNICAL_SERVICE_TEAM_ID,
    type: 'team',
    name: 'SAGEMRO Technical Service Team',
    role: 'Technical content author and reviewer',
    bio: 'The SAGEMRO Technical Service Team organizes industrial equipment service information, checks diagnostic steps and escalation boundaries, and corrects content when evidence changes.',
    url: 'https://sagemro.com/about/technical-review/',
  },
  'zh-CN': {
    id: TECHNICAL_SERVICE_TEAM_ID,
    type: 'team',
    name: 'SAGEMRO 技术服务团队',
    role: '技术内容作者与审核团队',
    bio: 'SAGEMRO 技术服务团队整理工业设备服务信息，核查诊断步骤和升级边界，并在证据发生变化时更正内容。团队通过清晰组织信息、标明适用范围和下一步升级条件，帮助读者理解何时应进一步确认。',
    url: 'https://sagemro.cn/about/technical-review/',
  },
};

export function getTechnicalAuthor(id, locale) {
  if (id !== TECHNICAL_SERVICE_TEAM_ID) return null;

  const author = TECHNICAL_AUTHORS[locale] ?? TECHNICAL_AUTHORS.en;
  return { ...author };
}
