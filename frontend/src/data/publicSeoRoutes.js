import {
  directAccessNoindexIndustryTools,
  getLocalizedTool,
  getToolWorkedExample,
  publicIndustryTools,
} from './industryTools.js';
import { getDiagnosticGuides, getRelatedDiagnosticGuidesForService } from './diagnosticGuides.js';
import { getLocalizedInsights } from './insights.js';
import { getServicePage, getServicePages } from './servicePages.js';
import { getTechnicalAuthor } from './technicalAuthors.js';
import { getTechnicalReviewPolicy } from './technicalReviewPolicy.js';
import { welcomePageCopy } from './welcomePageCopy.js';

const HOSTS = { en: 'https://sagemro.com', 'zh-CN': 'https://sagemro.cn' };
const RELEASE_DATE = '2026-08-06';

const pages = {
  en: {
    home: {
      title: 'SAGEMRO Service OS',
      description: 'SAGEMRO helps industrial equipment users organize service needs, connect with qualified field engineers, and keep service records clear.',
    },
    tools: {
      title: 'Free Sheet Metal and Laser Cutting Calculators',
      description: 'Use free SAGEMRO calculators for metal weight, steel price planning, laser cutting cost, gas use, speed reference, bending, ROI, and auxiliary sizing.',
      h1: 'Free tools for sheet metal, laser cutting, bending, ROI, and auxiliary planning.',
      paragraphs: ['Start with numbers you can check: material weight, reference budget, cutting time, assist gas, bending assumptions, equipment ROI, and support equipment needs. Each tool keeps assumptions visible so you can review the next decision with better context.'],
    },
    services: {
      title: 'Industrial Equipment Service Support',
      description: 'Structured service support for laser cutting, press brakes, remote diagnostics, and preventive maintenance.',
      h1: 'Structured equipment service support for a clear next action.',
      paragraphs: ['Choose the service context that best matches the equipment and operating concern. Each page explains the information to prepare and the boundary between remote and onsite support.'],
    },
    insights: {
      title: 'SAGEMRO Insights for Laser and Metal Forming Equipment',
      description: 'Practical notes, calculators, and decision guides for laser and metal forming equipment.',
      h1: 'Practical notes for machine decisions, service risk, and shop-floor planning.',
      paragraphs: ['Short, checkable guides connected to the calculators and AI workspace. The goal is to clarify assumptions before service, purchasing, or production decisions.'],
    },
  },
  'zh-CN': {
    home: {
      title: 'SAGEMRO 智能服务系统',
      description: 'SAGEMRO 面向激光切割与金属成型设备，帮助客户整理问题、连接合格工程师并沉淀服务记录。',
    },
    tools: {
      title: '钣金、激光切割和折弯行业工具',
      description: '使用 SAGEMRO 行业工具估算材料重量、钢材预算、激光切割成本、辅助气体用量、切割速度、折弯、设备 ROI 和辅机选型参考。',
      h1: '钣金、切割、折弯与设备规划工具。',
      paragraphs: ['先从可检查的数据开始：材料重量、预算参考、切割时间、辅助气体、折弯假设、设备 ROI 和辅机需求。每个工具都会把假设列出来，方便你再做下一步判断。'],
    },
    services: {
      title: '工业设备服务支持',
      description: '查看激光切割、折弯机、远程诊断和预防性维护的结构化服务支持。',
      h1: '用结构化设备服务支持，明确下一步行动。',
      paragraphs: ['选择最符合设备和运行问题的服务场景。每个页面说明应准备的信息，以及远程与现场支持的边界。'],
    },
    insights: {
      title: 'SAGEMRO 激光与金属成型洞察',
      description: '面向激光切割与金属成型设备的实务说明、计算器和决策指南。',
      h1: '关于设备决策、服务风险与车间规划的实务说明。',
      paragraphs: ['与计算器和 AI 工作区关联的简短、可复核指南，帮助在服务、采购或生产决策前澄清假设。'],
    },
  },
};

function alternates(path) {
  return {
    en: `${HOSTS.en}${path === '/' ? '/' : path}`,
    'zh-CN': `${HOSTS['zh-CN']}${path === '/' ? '/' : path}`,
    'x-default': `${HOSTS.en}${path === '/' ? '/' : path}`,
  };
}

function route(locale, value) {
  return {
    robots: 'index,follow',
    ...value,
    canonical: `${HOSTS[locale]}${value.path === '/' ? '/' : value.path}`,
    alternates: alternates(value.path),
  };
}

function organization(locale) {
  return { '@type': 'Organization', '@id': `${HOSTS[locale]}/#organization`, name: 'SAGEMRO', url: `${HOSTS[locale]}/`, email: 'support@sagemro.com' };
}

function organizationRef(locale) {
  return { '@id': organization(locale)['@id'] };
}

function technicalTeamOrganization(locale) {
  const author = getTechnicalAuthor('sagemro-technical-service-team', locale);
  return {
    '@type': 'Organization',
    '@id': `${author.url}#technical-team`,
    name: author.name,
    description: author.bio,
    url: author.url,
  };
}

function breadcrumb(routeValue) {
  const parts = routeValue.path.split('/').filter(Boolean);
  const origin = new URL(routeValue.canonical).origin;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: parts.map((part, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: part,
      item: `${origin}/${parts.slice(0, index + 1).join('/')}`,
    })),
  };
}

function toolEvidenceSections(tool, locale) {
  const evidence = tool.seoEvidence;
  const example = getToolWorkedExample(tool, locale);
  if (!evidence?.formula || !example) return [];

  const headings = locale === 'zh-CN'
    ? { formula: '公式', example: '示例结果', assumptions: '假设', limitations: '局限', safety: '安全边界', review: '工程师复核', references: '参考依据' }
    : { formula: 'Formula', example: 'Worked example', assumptions: 'Assumptions', limitations: 'Limitations', safety: 'Safety boundary', review: 'Engineer review', references: 'References' };
  const result = example.result.rows.map(([label, value]) => `${label}: ${value}`).join('; ');

  return [
    { heading: headings.formula, body: `${evidence.formula} ${headings.references}: ${evidence.references.join(' ')}` },
    { heading: headings.example, body: `${example.intro} ${result}` },
    { heading: headings.assumptions, body: evidence.assumptions.join(' ') },
    { heading: headings.limitations, body: evidence.limitations.join(' ') },
    { heading: headings.safety, body: evidence.safetyBoundary },
    { heading: headings.review, body: evidence.reviewPrompt },
  ];
}

function toolRoute(locale, tool, robots = 'index,follow') {
  return route(locale, {
    robots,
    path: `/tools/${tool.slug}`,
    type: 'tool',
    title: tool.seoTitle,
    description: tool.seoDescription,
    modified: tool.updatedAt,
    body: { h1: tool.seoTitle, paragraphs: [tool.description, tool.guideBody], guideTitle: tool.guideTitle, sections: toolEvidenceSections(tool, locale), faqs: tool.faqs },
    structuredData: {
      '@type': 'WebApplication', name: tool.label, description: tool.seoDescription,
      applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: locale === 'zh-CN' ? 'CNY' : 'USD' },
      publisher: organizationRef(locale),
    },
  });
}

function withSchemaGraphs(routes, locale) {
  return routes.map((routeValue) => {
    const schemaOrganization = routeValue.schemaOrganization ?? organization(locale);
    const { schemaOrganization: _schemaOrganization, ...publicRoute } = routeValue;
    return {
      ...publicRoute,
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': routeValue.path === '/'
          ? [schemaOrganization, routeValue.structuredData]
          : [routeValue.structuredData, breadcrumb(routeValue), schemaOrganization],
      },
    };
  });
}

function buildRoutes(locale) {
  const copy = pages[locale] || pages.en;
  const welcome = welcomePageCopy[locale === 'zh-CN' ? 'zh' : 'en'];
  const tools = publicIndustryTools.map((tool) => getLocalizedTool(tool, locale));
  const insights = getLocalizedInsights(locale);
  const services = getServicePages(locale);
  const guides = getDiagnosticGuides(locale);
  const reviewPolicy = getTechnicalReviewPolicy(locale);
  const collection = (path, type, content, children) => route(locale, {
    path,
    type,
    title: content.title,
    description: content.description,
    modified: RELEASE_DATE,
    children,
    body: { h1: content.h1, paragraphs: content.paragraphs, list: children.map((child) => child.label || child.title) },
    structuredData: {
      '@type': 'CollectionPage',
      name: content.title,
      description: content.description,
      url: `${HOSTS[locale]}${path}`,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: children.map((child, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: child.canonical,
        })),
      },
    },
  });
  const home = route(locale, {
    path: '/',
    type: 'home',
    title: copy.home.title,
    description: copy.home.description,
    modified: RELEASE_DATE,
    body: { h1: welcome.headline, paragraphs: [welcome.intro], resources: welcome.resources },
    structuredData: { '@type': 'WebSite', name: 'SAGEMRO', url: `${HOSTS[locale]}/`, publisher: organizationRef(locale) },
  });
  const toolRoutes = tools.map((tool) => toolRoute(locale, tool));
  const insightRoutes = insights.map((insight) => route(locale, {
    path: `/insights/${insight.slug}`,
    type: 'insight',
    title: insight.title,
    description: insight.description,
    modified: insight.updatedAt,
    body: { h1: insight.title, paragraphs: [insight.description], sections: insight.sections },
    structuredData: {
      '@type': 'Article', headline: insight.title, description: insight.description,
      datePublished: insight.publishedAt, dateModified: insight.updatedAt,
      author: organizationRef(locale), publisher: organizationRef(locale),
      image: `${HOSTS[locale]}/sagemro-logo.png`, mainEntityOfPage: `${HOSTS[locale]}/insights/${insight.slug}`,
    },
  }));
  const serviceRoutes = services.map((service) => {
    const relatedGuides = getRelatedDiagnosticGuidesForService(service.slug, locale);
    return route(locale, {
      path: `/services/${service.slug}`,
      type: 'service',
      title: service.seoTitle.replace(/ \| SAGEMRO$/, ''),
      description: service.description,
      modified: service.reviewedAt,
      body: {
        h1: service.title,
        paragraphs: [service.summary, service.equipment, service.remoteBoundary, service.onsiteBoundary, service.evidenceNotes],
        sections: [
          { heading: locale === 'zh-CN' ? '问题范围' : 'Issue scope', body: service.issues.join(' ') },
          { heading: locale === 'zh-CN' ? '服务评估流程' : 'How the review works', body: service.process.join(' ') },
          { heading: locale === 'zh-CN' ? '需准备的信息' : 'Information to prepare', body: service.customerInputs.join(' ') },
        ],
        links: relatedGuides.map((guide) => ({ kind: 'guide', href: `/insights/${guide.slug}`, label: guide.title })),
        emptyState: relatedGuides.length ? '' : (locale === 'zh-CN' ? '更多指南将在证据完整并通过审核后发布。' : 'More reviewed guides will be added when their evidence is complete.'),
      },
      structuredData: {
        '@type': 'Service',
        name: service.title,
        description: service.description,
        url: `${HOSTS[locale]}/services/${service.slug}`,
        provider: organizationRef(locale),
      },
    });
  });
  const guideRoutes = guides.map((guide) => {
    const author = getTechnicalAuthor(guide.authorId, locale);
    const reviewer = getTechnicalAuthor(guide.reviewedBy, locale);
    const team = technicalTeamOrganization(locale);
    const reviewerId = reviewer.id === author.id ? team['@id'] : reviewer.url;
    const relatedService = getServicePage(guide.relatedServiceSlug, locale);
    return route(locale, {
      path: `/insights/${guide.slug}`,
      type: 'insight',
      title: guide.title,
      description: guide.description,
      modified: guide.reviewedAt,
      schemaOrganization: team,
      body: {
        h1: guide.title,
        paragraphs: [guide.description, guide.directAnswer, guide.safety],
        sections: [
          { heading: locale === 'zh-CN' ? '症状' : 'Symptoms', body: guide.symptoms.join(' ') },
          { heading: locale === 'zh-CN' ? '检查与行动' : 'Checks and actions', body: guide.checks.map((check, index) => `${check} ${guide.actions[index]}`).join(' ') },
          { heading: locale === 'zh-CN' ? '停止并升级' : 'Stop and escalate', body: guide.stopConditions.join(' ') },
        ],
        links: [
          ...(relatedService ? [{ kind: 'service', href: `/services/${relatedService.slug}`, label: relatedService.title }] : []),
          { kind: 'author', href: '/about/technical-review', label: `${locale === 'zh-CN' ? '作者' : 'Author'}: ${author.name}` },
          { kind: 'reviewer', href: '/about/technical-review', label: `${locale === 'zh-CN' ? '技术审核' : 'Technical review'}: ${reviewer.name}` },
        ],
      },
      structuredData: {
        '@type': 'Article',
        headline: guide.title,
        description: guide.description,
        url: `${HOSTS[locale]}/insights/${guide.slug}`,
        mainEntityOfPage: `${HOSTS[locale]}/insights/${guide.slug}`,
        datePublished: guide.publishedAt,
        dateModified: guide.reviewedAt,
        author: { '@id': team['@id'] },
        reviewedBy: { '@id': reviewerId },
        publisher: { '@id': team['@id'] },
        image: `${HOSTS[locale]}/sagemro-logo.png`,
      },
    });
  });
  const technicalTeam = technicalTeamOrganization(locale);
  const technicalReviewRoute = route(locale, {
    path: '/about/technical-review',
    type: 'technical-review',
    title: reviewPolicy.seoTitle.replace(/ \| SAGEMRO$/, ''),
    description: reviewPolicy.description,
    modified: reviewPolicy.reviewedAt,
    schemaOrganization: technicalTeam,
    body: {
      h1: reviewPolicy.title,
      paragraphs: [reviewPolicy.intro, reviewPolicy.errorReporting],
      sections: reviewPolicy.sections,
    },
    structuredData: {
      '@type': 'AboutPage',
      name: reviewPolicy.title,
      description: reviewPolicy.description,
      url: `${HOSTS[locale]}/about/technical-review`,
      datePublished: reviewPolicy.publishedAt,
      dateModified: reviewPolicy.reviewedAt,
      author: { '@id': technicalTeam['@id'] },
      publisher: { '@id': technicalTeam['@id'] },
    },
  });
  const toolsHub = collection('/tools', 'tools-hub', copy.tools, toolRoutes);
  const servicesHub = collection('/services', 'services-hub', copy.services, serviceRoutes);
  const insightsHub = collection('/insights', 'insights-hub', copy.insights, [...insightRoutes, ...guideRoutes]);
  const routes = [home, servicesHub, ...serviceRoutes, toolsHub, ...toolRoutes, insightsHub, ...insightRoutes, ...guideRoutes, technicalReviewRoute];

  return withSchemaGraphs(routes, locale);
}

export function getPublicSeoRoutes(locale = 'en') {
  return buildRoutes(locale === 'zh-CN' ? 'zh-CN' : 'en');
}

export function getPublicSeoRoute(pathname, locale = 'en') {
  const path = pathname === '/' ? '/' : String(pathname || '').replace(/\/$/, '');
  return getPublicSeoRoutes(locale).find((routeValue) => routeValue.path === path) || null;
}

export function getDirectAccessNoindexToolRoutes(locale = 'en') {
  const normalizedLocale = locale === 'zh-CN' ? 'zh-CN' : 'en';
  const tools = directAccessNoindexIndustryTools.map((tool) => getLocalizedTool(tool, normalizedLocale));

  return withSchemaGraphs(tools.map((tool) => toolRoute(normalizedLocale, tool, 'noindex,nofollow,noarchive')), normalizedLocale);
}
