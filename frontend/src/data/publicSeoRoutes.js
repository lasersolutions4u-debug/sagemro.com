import { getLocalizedTool, publicIndustryTools } from './industryTools.js';
import { getLocalizedInsights } from './insights.js';
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
  return { '@type': 'Organization', name: 'SAGEMRO', url: `${HOSTS[locale]}/`, email: 'support@sagemro.com' };
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

function buildRoutes(locale) {
  const copy = pages[locale] || pages.en;
  const welcome = welcomePageCopy[locale === 'zh-CN' ? 'zh' : 'en'];
  const tools = publicIndustryTools.map((tool) => getLocalizedTool(tool, locale));
  const insights = getLocalizedInsights(locale);
  const collection = (path, type, content, children) => route(locale, {
    path,
    type,
    title: content.title,
    description: content.description,
    modified: RELEASE_DATE,
    body: { h1: content.h1, paragraphs: content.paragraphs, list: children.map((child) => child.label || child.title) },
    structuredData: { '@type': 'CollectionPage', name: content.title, description: content.description },
  });
  const home = route(locale, {
    path: '/',
    type: 'home',
    title: copy.home.title,
    description: copy.home.description,
    modified: RELEASE_DATE,
    body: { h1: welcome.headline, paragraphs: [welcome.intro], resources: welcome.resources },
    structuredData: { '@graph': [organization(locale), { '@type': 'WebSite', name: 'SAGEMRO', url: `${HOSTS[locale]}/` }] },
  });
  const toolRoutes = tools.map((tool) => route(locale, {
    path: `/tools/${tool.slug}`,
    type: 'tool',
    title: tool.seoTitle,
    description: tool.seoDescription,
    modified: tool.updatedAt,
    body: { h1: tool.seoTitle, paragraphs: [tool.description, tool.guideBody], guideTitle: tool.guideTitle, faqs: tool.faqs },
    structuredData: {
      '@type': 'WebApplication', name: tool.label, description: tool.seoDescription,
      applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: locale === 'zh-CN' ? 'CNY' : 'USD' },
    },
  }));
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
      author: organization(locale), publisher: organization(locale),
      image: `${HOSTS[locale]}/sagemro-logo.png`, mainEntityOfPage: `${HOSTS[locale]}/insights/${insight.slug}`,
    },
  }));
  const toolsHub = collection('/tools', 'tools-hub', copy.tools, tools);
  const insightsHub = collection('/insights', 'insights-hub', copy.insights, insights);
  const routes = [home, toolsHub, ...toolRoutes, insightsHub, ...insightRoutes];

  return routes.map((routeValue) => routeValue.path === '/' ? routeValue : {
    ...routeValue,
    structuredData: routeValue.structuredData['@graph']
      ? routeValue.structuredData
      : { '@graph': [routeValue.structuredData, breadcrumb(routeValue)] },
  });
}

export function getPublicSeoRoutes(locale = 'en') {
  return buildRoutes(locale === 'zh-CN' ? 'zh-CN' : 'en');
}

export function getPublicSeoRoute(pathname, locale = 'en') {
  const path = pathname === '/' ? '/' : String(pathname || '').replace(/\/$/, '');
  return getPublicSeoRoutes(locale).find((routeValue) => routeValue.path === path) || null;
}
