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
import { getPublicHomeContent } from './publicHomeContent.js';
import { getTopicGroups } from './topicGroups.js';
import { getCompanyAbout } from './companyAbout.js';
import { getServiceBilling } from './serviceBilling.js';
import {
  getLegalEntity,
  ICP_RECORD_NUMBER,
  SUPPORT_EMAIL,
  SUPPORT_TIMEZONE_SHORT,
} from './companyProfile.js';

const HOSTS = { en: 'https://sagemro.com', 'zh-CN': 'https://sagemro.cn' };
// hub / 首页 / 服务页这几类页面没有比"内容发布"更细的变更时间，统一用这个日期。
// 改这些页面的文案时要一起更新，否则 sitemap 的 lastmod 会一直停在旧日期。
const RELEASE_DATE = '2026-11-13';

function publicUrl(host, path) {
  return `${host}${path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`}`;
}

const pages = {
  en: {
    home: {
      title: 'Laser & Press Brake After-Sales Service for OEMs',
      description: 'SAGEMRO takes over the after-sales that equipment builders and their dealers cannot cover — in-warranty on-site visits, export commissioning, and exchange-unit flow. Engineers and parts organized by us; billed per project or per visit.',
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
      // 原先这里是「Structured equipment service support for a clear next action.」——一句零关键词的口号。
      // H1 是页面主题的最强声明，枢纽页更该说清它到底聚合了哪几类服务，所以补上机型与服务形态词。
      h1: 'Service scopes for laser cutting machine repair, press brake repair, and preventive maintenance.',
      paragraphs: ['Choose the service context that best matches the equipment and operating concern. Each page explains the information to prepare and the boundary between remote and onsite support.'],
    },
    insights: {
      title: 'Insights for Laser and Metal Forming Equipment',
      description: 'Practical notes, calculators, and decision guides for laser and metal forming equipment.',
      h1: 'Practical notes for machine decisions, service risk, and shop-floor planning.',
      paragraphs: ['Short, checkable guides connected to the calculators and AI workspace. The goal is to clarify assumptions before service, purchasing, or production decisions.'],
    },
  },
  'zh-CN': {
    home: {
      title: '整机厂售后外包：保内上门、出口设备海外交付、返修件流转',
      description: '承接整机厂售后交付外包：保内上门、出口设备海外装机与调试、返修件流转与备件支持，按项目或按次承接。工程师与备件由我们组织，检测数据与服务结论留档回传。',
    },
    tools: {
      title: '钣金、激光切割和折弯行业工具',
      description: '使用 SAGEMRO 行业工具估算材料重量、钢材预算、激光切割成本、辅助气体用量、切割速度、折弯、设备 ROI 和辅机选型参考。',
      h1: '钣金、切割、折弯与设备规划工具。',
      paragraphs: ['先从可检查的数据开始：材料重量、预算参考、切割时间、辅助气体、折弯假设、设备 ROI 和辅机需求。每个工具都会把假设列出来，方便你再做下一步判断。'],
    },
    services: {
      title: '工业设备服务支持',
      description: '激光切割机维修、折弯机维修、远程诊断、预防性维护与备件支持的服务场景总览，按项目或按次承接。',
      // 同 COM：原先的「用结构化设备服务支持，明确下一步行动。」零关键词。
      h1: '激光切割机维修、折弯机维修与设备维保的服务场景总览。',
      paragraphs: ['选择最符合设备和运行问题的服务场景。每个页面说明应准备的信息，以及远程与现场支持的边界。'],
    },
    insights: {
      title: 'SAGEMRO 激光与金属成型洞察',
      description: '面向激光切割与金属成型设备的实务说明、计算器与决策指南：材料与成本、维护与故障排查，均附可复核的假设。',
      h1: '关于设备决策、服务风险与车间规划的实务说明。',
      paragraphs: ['与计算器和 AI 工作区关联的简短、可复核指南，帮助在服务、采购或生产决策前澄清假设。'],
    },
  },
};

function alternates(path) {
  return {
    en: publicUrl(HOSTS.en, path),
    'zh-CN': publicUrl(HOSTS['zh-CN'], path),
    'x-default': publicUrl(HOSTS.en, path),
  };
}

/**
 * 只在国际站发布的页面（如 /partners/）不能声明 zh-CN 版本：那个 URL 在 sagemro.cn 上是 404，
 * 而 hreflang 要求每个被指向的 URL 真实存在。这类路由自己给出 alternates，不再从 path 推导。
 */
function englishOnlyAlternates(path) {
  return {
    en: publicUrl(HOSTS.en, path),
    'x-default': publicUrl(HOSTS.en, path),
  };
}

function route(locale, value) {
  return {
    robots: 'index,follow',
    ...value,
    canonical: publicUrl(HOSTS[locale], value.path),
    alternates: value.alternates ?? alternates(value.path),
  };
}

/**
 * 公司实体节点。
 *
 * 这里以前只有 name/url/email 三个字段——搜索引擎和 AI 无法据此确认这是一个真实经营实体，
 * 也不知道它到底做什么。法人名与备案号原先只存在于页脚与用户协议里，
 * 而爬虫读的是静态壳，壳里两者都没有。现在补上 entity 描述与标识字段。
 */
function organization(locale) {
  const entity = getLegalEntity(locale);
  return {
    '@type': 'Organization',
    '@id': `${HOSTS[locale]}/#organization`,
    name: entity.name,
    legalName: entity.legalName,
    url: `${HOSTS[locale]}/`,
    description: entity.description,
    email: SUPPORT_EMAIL,
    logo: `${HOSTS[locale]}/sagemro-logo.png`,
    // 注册地址来自 companyProfile.js（美国侧是 Wyoming 注册地址）。中国站不公布街道地址，
    // 只到国家层级——备案号承担的是另一套可核验口径。
    address: entity.address
      ? {
        '@type': 'PostalAddress',
        streetAddress: entity.address.street,
        addressLocality: entity.address.city,
        addressRegion: entity.address.region,
        postalCode: entity.address.postalCode,
        addressCountry: entity.address.country,
      }
      : { '@type': 'PostalAddress', addressCountry: entity.country },
    areaServed: entity.areaServed,
    // 2026-11-13 决定：联系方式以邮件为主，电话暂不对外公布（事实与原因见 companyProfile.js）。
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SUPPORT_EMAIL,
      availableLanguage: locale === 'zh-CN' ? ['zh-CN'] : ['en'],
      hoursAvailable: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
    },
    // 工信部备案号只有中国版持有，国际站不带这一项。
    ...(locale === 'zh-CN'
      ? { identifier: { '@type': 'PropertyValue', propertyID: 'ICP', value: ICP_RECORD_NUMBER } }
      : {}),
  };
}

function organizationRef(locale) {
  return { '@id': organization(locale)['@id'] };
}

/**
 * 联系页。
 *
 * 这一页的存在理由不是「再加一个页面」，而是把收款方审核与渠道尽调真正会问的三件事
 * 放在同一个 URL 上：谁能联系上、按哪个时区多久回、以及谁签合同谁开发票。
 *
 * 所以正文只写可以从 companyProfile.js 复核的事实：邮箱、时区、工作时长、
 * 服务团队所在地、注册地址、运营主体与开票主体。不写「24 小时」「全球响应」这类无法兑现的承诺。
 *
 * 2026-11-13：按运营方决定，**电话暂不对外公布**，联系以邮件为主；邮件也是唯一能留下书面记录的入口。
 */
function contactPage(locale) {
  const entity = getLegalEntity(locale);
  const isCn = locale === 'zh-CN';
  const registeredOffice = entity.address?.formatted;
  const sections = isCn
    ? [
      { heading: '邮箱', body: `${SUPPORT_EMAIL}。邮件直接进入服务团队。请一并提供设备型号、报警原文，以及铭牌或故障件的照片；请勿发送图纸、密码等敏感信息。` },
      { heading: '回复时效', body: '所有咨询在一个工作日内回复，法定节假日不计入。需要安排现场方案的请求会更久，因为可用性要在设备、地点与工程师匹配情况核实之后才能确认。' },
      { heading: '我们在哪里', body: `服务团队、备件库与车间都在山东济南（${SUPPORT_TIMEZONE_SHORT}），工作时间为周一至周五 09:00–18:00，服务按此时间协调。国内按地区安排上门；出口设备按国家与项目逐案确认现场资源。完整通信地址印在合同与发票上，也可通过邮件索取。` },
      { heading: '本站由谁运营、由谁开票', body: `${entity.operatingEntityStatement} 国内业务的发票由本公司开出，收款信息印在发票上，不在本页公布。` },
      { heading: '询价需要提供什么', body: '请提供设备型号、设备所在国家或地区，以及故障现象或零件号。书面报价会逐项列明服务范围、差旅、备件与结算方式，并在开工前发出。' },
      { heading: '备件与交换件', body: '备件按零件号逐项报价。故障件会导致停产时，可以先发可用件、坏件回收维修；押金按件值收取，回收件检测合格后退还。' },
    ]
    : [
      { heading: 'Email', body: `${SUPPORT_EMAIL}. This reaches the service team directly and leaves a written record of the request. Include the machine model, the alarm text, and a photo of the machine label or the failed part if you have them. Do not send drawings, passwords, or other secrets.` },
      { heading: 'Response time', body: 'Requests are answered within one business day, excluding public holidays. A request that needs an on-site plan takes longer, because availability is confirmed after the equipment, the location, and the engineer fit have been reviewed.' },
      { heading: 'Where we are', body: `The registered office is ${registeredOffice}. The service team, the parts stock, and the workshop are in Jinan, Shandong, China (${SUPPORT_TIMEZONE_SHORT}); the team works Monday to Friday, 09:00–18:00, and service engineers are dispatched from there. Note the time difference when you write.` },
      { heading: 'Who operates this site and who invoices you', body: `${entity.operatingEntityStatement} Invoices for overseas work are issued in US dollars by SAGEMRO LLC, and the payment details are printed on the invoice itself rather than published on this page.` },
      { heading: 'What to send with a quotation request', body: 'Send the machine model, the site country, and the symptom or the part number. The written quotation itemizes service scope, travel, parts, and the settlement basis, and it is issued before any work starts.' },
      { heading: 'Parts and exchange units', body: 'Part orders are quoted per part number. Where a failed part stops production, an exchange unit can be shipped first and the returned unit repaired afterwards; a deposit equal to the unit value is held until the returned unit has been inspected.' },
    ];

  return route(locale, {
    path: '/contact',
    type: 'contact',
    title: isCn ? '联系我们：服务、备件与报价' : 'Contact SAGEMRO: Service, Parts and Quotations',
    description: isCn
      ? '联系 SAGEMRO：邮箱、工作时段与回复时效。激光切割机与折弯机维修、备件与报价请求都在这里受理。'
      : 'Reach the SAGEMRO service team by email for repairs, spare parts, and quotations. Reply within one business day, UTC+8.',
    modified: RELEASE_DATE,
    body: {
      h1: isCn ? '联系 SAGEMRO：设备维修、备件与报价' : 'Contact SAGEMRO about service, parts, and quotations.',
      paragraphs: [isCn
        ? 'SAGEMRO 承接激光切割机与折弯机的维修、保养、备件与整机厂售后外包。请通过邮箱或咨询表单联系我们，一个工作日内回复（不含法定节假日）；需要现场方案的请求会先做可行性确认。'
        : 'SAGEMRO takes repair, maintenance, spare-parts, and after-sales outsourcing requests for laser cutting machines and press brakes. Write to us or send the consultation form and a reply follows within one business day; a request that needs an on-site visit gets a feasibility check first.'],
      sections,
      links: [
        { href: `mailto:${SUPPORT_EMAIL}`, label: SUPPORT_EMAIL },
        { href: '/services/', label: isCn ? '服务项目' : 'Services' },
        { href: '/services/spare-parts-consumables/', label: isCn ? '备件与耗材' : 'Spare parts and consumables' },
        { href: '/refund-policy/', label: isCn ? '付款、取消与退款政策' : 'Payment, cancellation and refund policy' },
        { href: '/about/', label: isCn ? '关于我们与运营主体' : 'About SAGEMRO and the operating entity' },
      ],
    },
    structuredData: {
      '@type': 'ContactPage',
      name: isCn ? '联系 SAGEMRO' : 'Contact SAGEMRO',
      description: isCn
        ? 'SAGEMRO 的联系方式、工作时段、回复时效与运营主体。'
        : 'How to reach SAGEMRO: email, working hours, response time, the registered office, and the operating entity.',
      url: publicUrl(HOSTS[locale], '/contact'),
      mainEntity: organizationRef(locale),
    },
  });
}

/**
 * 退款与取消政策页。
 *
 * 为什么要有独立一页而不是只塞进条款弹窗：
 * 1. 收款方与支付机构的审核要求「退款政策有一个可访问的 URL」，弹窗不算；
 * 2. 条款要能被引用、被银行尽调截图、被客户在争议时直接打开。
 *
 * 正文全部来自 data/serviceBilling.js（与条款同一数据源），这里只负责排版成章节。
 * 政策必须与站内既有承诺自洽：报价先于开工、逐项列明、不替代原厂保修。
 */
function refundPolicyPage(locale) {
  const isCn = locale === 'zh-CN';
  const billing = getServiceBilling(locale);
  const p = billing.page;
  const sections = [p.quote, p.deposit, p.customerCancellation, p.ourCancellation, p.refunds, p.workmanship, p.warrantyBoundary, p.dispute]
    .map((section) => ({
      heading: section.heading,
      body: section.body,
      ...(section.items ? { items: [...section.items] } : {}),
    }));

  return route(locale, {
    path: '/refund-policy',
    type: 'refund-policy',
    title: isCn
      ? '服务付款、取消与退款政策'
      : 'Service Payment, Cancellation and Refund Policy',
    description: isCn
      ? 'SAGEMRO 服务的付款与退款口径：30% 预付、70% 验收后付、取消分档、退款时效，以及与设备厂家保修的边界。'
      : 'Deposit and balance, cancellation windows, refunds, and why SAGEMRO does not replace the equipment maker\'s warranty.',
    modified: RELEASE_DATE,
    body: {
      h1: isCn
        ? 'SAGEMRO 服务的付款、取消与退款政策'
        : 'Payment, cancellation, and refund policy for SAGEMRO service work.',
      paragraphs: [isCn
        ? '本页是 SAGEMRO 服务业务的付款与取消口径：报价如何转为预付款与尾款、各阶段取消要承担什么、退款怎么办理，以及设备厂家保修的位置。中国境内业务由济南钰峭机械有限公司执行与开票；海外业务由境外主体签约与开票，主体在报价单中写明。'
        : 'This page is the payment and cancellation policy for service work ordered from SAGEMRO: how a quotation becomes a deposit and a balance, what a cancellation costs at each stage, how a refund is handled, and where the equipment maker\'s warranty stands. It applies to overseas work invoiced by SAGEMRO LLC and, through the Chinese operating company, to work delivered inside China.'],
      sections,
      links: [
        { href: '/contact/', label: isCn ? '联系我们' : 'Contact SAGEMRO' },
        { href: '/services/', label: isCn ? '服务项目与报价区间' : 'Services and indicative budgets' },
        { href: '/about/', label: isCn ? '关于我们与运营主体' : 'About SAGEMRO and the operating entity' },
      ],
    },
    structuredData: {
      '@type': 'WebPage',
      name: isCn ? '退款与取消政策' : 'Payment, cancellation and refund policy',
      description: isCn
        ? 'SAGEMRO 服务业务的付款、取消与退款政策。'
        : 'Payment, cancellation, and refund policy for SAGEMRO service work.',
      url: publicUrl(HOSTS[locale], '/refund-policy'),
      about: organizationRef(locale),
      dateModified: RELEASE_DATE,
    },
  });
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
      item: `${origin}/${parts.slice(0, index + 1).join('/')}/`,
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
    const { schemaOrganization: _schemaOrganization, schemaExtra = [], ...publicRoute } = routeValue;
    const extra = Array.isArray(schemaExtra) ? schemaExtra : [schemaExtra];
    return {
      ...publicRoute,
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [
          ...(routeValue.path === '/'
            ? [schemaOrganization, routeValue.structuredData]
            : [routeValue.structuredData, breadcrumb(routeValue), schemaOrganization]),
          ...extra,
        ],
      },
    };
  });
}

function buildRoutes(locale) {
  const copy = pages[locale] || pages.en;
  const publicHome = getPublicHomeContent(locale === 'zh-CN');
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
    body: {
      h1: content.h1,
      paragraphs: content.paragraphs,
      // 带 href：静态壳才能把子页标题渲染成链接。原先只给纯文本，
      // 于是 /services/、/tools/、/insights/ 三个枢纽页在壳里一个内链都没有。
      list: children.map((child) => ({ href: new URL(child.canonical).pathname, label: child.label || child.title })),
    },
    structuredData: {
      '@type': 'CollectionPage',
      name: content.title,
      description: content.description,
      url: publicUrl(HOSTS[locale], path),
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
    // 元数据要能放进 SERP：原先这一条 235 字符，头一句说完重点后剩下的全被截掉。
    // 正文口径不受影响——首页正文来自 publicHomeContent.js，与这里无关。
    description: locale === 'zh-CN'
      ? copy.home.description
      : 'SAGEMRO takes over the after-sales that equipment builders and their dealers cannot cover: in-warranty visits, export commissioning, and exchange-unit flow.',
    modified: RELEASE_DATE,
    body: {
      h1: publicHome.hero.title,
      paragraphs: [publicHome.hero.description],
      sections: [
        ...(locale === 'zh-CN'
          ? [
            // 以前这三块被拼成一整个 <p>（三类服务的处境+做法、4 步流程、4 条边界用空格相连），
            // AI 无法把其中任何一条当独立事实取用。现在每类服务各自成一个 H2 + P。
            ...publicHome.makerEngagements.items.map((item) => ({
              heading: item.title,
              body: `${item.context} ${item.approach}`,
            })),
            {
              heading: publicHome.makerWorkflow.title,
              body: publicHome.makerWorkflow.steps.map((step, index) => `${index + 1}. ${step.title}：${step.detail}`).join(' '),
            },
            {
              heading: publicHome.makerBoundary.title,
              body: publicHome.makerBoundary.items.map((item) => item.detail).join(' '),
            },
          ]
          : []),
        {
          heading: locale === 'zh-CN' ? '我们能解决的设备问题' : 'Equipment problems and service needs we handle',
          body: publicHome.services.items.map((item) => item.title).join(' · '),
        },
        {
          heading: locale === 'zh-CN' ? '为什么选择 SAGEMRO' : 'Why customers choose SAGEMRO',
          body: publicHome.reasons.items.map((item) => `${item.title}: ${item.detail}`).join(' '),
        },
        {
          heading: locale === 'zh-CN' ? '服务流程' : 'Service process',
          body: `${publicHome.process.steps.map((step, index) => `${index + 1}. ${step.title}`).join(' ')} ${publicHome.process.boundary}`,
        },
        {
          heading: locale === 'zh-CN' ? '工具与技术洞察' : 'Tools and technical insights',
          body: [
            ...publicHome.tools.items.map((item) => item.title),
            ...publicHome.insights.items.map((item) => item.title),
          ].join(' · '),
        },
        // 渠道商内容以前只在客户端渲染，静态壳里完全不存在——爬虫与 AI 看不到这条业务线，
        // 而它是国际站最重要的差异化。CN 不露出招商内容，所以只在国际站加。
        ...(locale === 'zh-CN' || !publicHome.partnerEntry ? [] : [{
          heading: publicHome.partnerEntry.title,
          body: publicHome.partnerEntry.description,
        }]),
      ],
      faqs: publicHome.faqs.items,
      links: [
        { href: '/services/', label: locale === 'zh-CN' ? '服务项目' : 'Services' },
        { href: '/tools/', label: locale === 'zh-CN' ? '实用工具' : 'Tools' },
        { href: '/insights/', label: locale === 'zh-CN' ? '技术洞察' : 'Insights' },
        { href: '/topics/', label: locale === 'zh-CN' ? '按主题浏览' : 'Browse by topic' },
        { href: '/about/', label: locale === 'zh-CN' ? '关于我们' : 'About SAGEMRO' },
        { href: '/contact/', label: locale === 'zh-CN' ? '联系我们' : 'Contact' },
        { href: '/refund-policy/', label: locale === 'zh-CN' ? '付款与退款政策' : 'Payment and refund policy' },
        ...(locale === 'zh-CN' ? [] : [{ href: '/partners/', label: 'Dealers and service partners' }]),
        ...(locale === 'zh-CN' ? [] : [{ href: 'https://www.dhgate.com/store/sagemro', label: 'Store' }]),
        { href: publicHome.requestCtas.assist.href, label: publicHome.requestCtas.assist.label },
      ],
    },
    structuredData: { '@type': 'WebSite', name: 'SAGEMRO', url: `${HOSTS[locale]}/`, publisher: organizationRef(locale) },
    // 首页的问答以前只有视觉呈现、没有机器可读标注。补 FAQPage：富结果与 AI 问答提取都靠它。
    schemaExtra: [{
      '@type': 'FAQPage',
      mainEntity: publicHome.faqs.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    }],
  });
  // 渠道商页面只对国际站发布；CN 不露出招商内容（见 COM/CN 受众定位方案 §3）。
  // 正文从 publicHome.partnerPage 取，与可见页面同源，避免两处漂移。
  const partnerRoutes = locale === 'zh-CN' ? [] : [route(locale, {
    path: '/partners',
    type: 'partners',
    // 渲染器会统一补 " | SAGEMRO"，这里再写一遍会得到 "... | SAGEMRO | SAGEMRO"。
    title: 'Laser & Press Brake Dealer Service Partner Support',
    description: publicHome.partnerPage.seoDescription ?? publicHome.partnerPage.description,
    // CN 上这个路径是 404，不能声明 zh-CN 版本。
    alternates: englishOnlyAlternates('/partners'),
    modified: RELEASE_DATE,
    body: {
      h1: publicHome.partnerPage.title,
      paragraphs: [publicHome.partnerPage.description],
      sections: publicHome.partnerPage.sections.map((section) => ({ heading: section.heading, body: section.body })),
      links: [
        { href: '/services/', label: 'Services' },
        { href: '/insights/', label: 'Insights' },
      ],
    },
    structuredData: { '@type': 'Service', name: 'Dealer and service partner support', serviceType: 'Equipment service and parts support for dealers', provider: organizationRef(locale) },
  })];
  const toolRoutes = tools.map((tool) => toolRoute(locale, tool));
  const insightRoutes = insights.map((insight) => route(locale, {
    path: `/insights/${insight.slug}`,
    type: 'insight',
    // 元数据与正文解耦：正文标题与首段可以长，SERP 标题与描述必须短。
    // seoTitle/seoDescription 按需提供，缺省仍用正文文案；预算由 tests/seo-metadata-budget.test.mjs 兜底。
    title: insight.seoTitle ?? insight.title,
    description: insight.seoDescription ?? insight.description,
    modified: insight.updatedAt,
    body: { h1: insight.title, paragraphs: [insight.description], sections: insight.sections },
    structuredData: {
      '@type': 'Article', headline: insight.title, description: insight.seoDescription ?? insight.description,
      datePublished: insight.publishedAt, dateModified: insight.updatedAt,
      author: organizationRef(locale), publisher: organizationRef(locale),
      image: `${HOSTS[locale]}/sagemro-logo.png`, mainEntityOfPage: publicUrl(HOSTS[locale], `/insights/${insight.slug}`),
    },
  }));
  const serviceRoutes = services.map((service) => {
    const relatedGuides = getRelatedDiagnosticGuidesForService(service.slug, locale);
    return route(locale, {
      path: `/services/${service.slug}`,
      type: 'service',
      title: service.seoTitle.replace(/ \| SAGEMRO$/, ''),
      // 服务页的 description 同时是枢纽页卡片上的可见文案，所以可以长；
      // 需要更短的 SERP 描述时由 seoDescription 单独提供。
      description: service.seoDescription ?? service.description,
      modified: RELEASE_DATE,
      body: {
        h1: service.title,
        paragraphs: [service.summary, service.equipment, service.remoteBoundary, service.onsiteBoundary, service.evidenceNotes],
        sections: [
          { heading: locale === 'zh-CN' ? '问题范围' : 'Issue scope', body: service.issues.join(' ') },
          { heading: locale === 'zh-CN' ? '服务评估流程' : 'How the review works', body: service.process.join(' ') },
          { heading: locale === 'zh-CN' ? '需准备的信息' : 'Information to prepare', body: service.customerInputs.join(' ') },
          // 页面上额外的小节（如备件页的交换件），带锚点，壳里渲染成 <h2 id="…">。
          ...(service.extraSections ?? []).map((section) => ({ heading: section.heading, body: section.body, anchor: section.anchor })),
          // 指示性价格区间。壳里把每一条压成一句话，数字与单位必须和可见页面同源
          // （都来自 data/servicePricing.js），否则爬虫读到的是另一套价。
          ...(service.pricing ? [{
            heading: service.pricing.heading,
            body: [
              service.pricing.intro,
              ...service.pricing.rows.map((row) => `${row.label}: ${row.value}${row.detail ? ` — ${row.detail}` : ''}.`),
              service.pricing.note,
            ].join(' '),
          }] : []),
        ],
        links: relatedGuides.map((guide) => ({ kind: 'guide', href: `/insights/${guide.slug}/`, label: guide.title })),
        emptyState: '',
      },
      structuredData: {
        '@type': 'Service',
        name: service.title,
        description: service.seoDescription ?? service.description,
        url: publicUrl(HOSTS[locale], `/services/${service.slug}`),
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
      title: guide.seoTitle ?? guide.title,
      description: guide.seoDescription ?? guide.description,
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
          ...(relatedService ? [{ kind: 'service', href: `/services/${relatedService.slug}/`, label: relatedService.title }] : []),
          { kind: 'author', href: '/about/technical-review/', label: `${locale === 'zh-CN' ? '作者' : 'Author'}: ${author.name}` },
          { kind: 'reviewer', href: '/about/technical-review/', label: `${locale === 'zh-CN' ? '技术审核' : 'Technical review'}: ${reviewer.name}` },
        ],
      },
      structuredData: {
        '@type': 'Article',
        headline: guide.title,
        description: guide.description,
        url: publicUrl(HOSTS[locale], `/insights/${guide.slug}`),
        mainEntityOfPage: publicUrl(HOSTS[locale], `/insights/${guide.slug}`),
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
      url: publicUrl(HOSTS[locale], '/about/technical-review'),
      datePublished: reviewPolicy.publishedAt,
      dateModified: reviewPolicy.reviewedAt,
      author: { '@id': technicalTeam['@id'] },
      publisher: { '@id': technicalTeam['@id'] },
    },
  });
  // 公司 / 关于页。
  // 审计指出站点里只有技术审核政策、没有一页回答「SAGEMRO 是谁」。对 GEO 而言这是实体权威的
  // 缺口：AI 要把这个名字解析成真实经营实体，就需要一个可引用的自我描述页。
  // 内容全部来自已核实事实（法人名与备案号来自 companyProfile.js），不写客户名称、不写案例、
  // 不写任何时效或能力承诺。
  const about = getCompanyAbout(locale);
  const aboutEntity = getLegalEntity(locale);
  const aboutRoute = route(locale, {
    path: '/about',
    type: 'about',
    title: locale === 'zh-CN'
      ? `关于 ${aboutEntity.name}：整机厂售后交付外包`
      : `About ${aboutEntity.name}: After-Sales Delivery for OEMs`,
    description: about.seoDescription ?? about.intro,
    modified: RELEASE_DATE,
    body: {
      h1: about.h1,
      paragraphs: [about.intro],
      sections: about.sections.map((section) => ({ heading: section.heading, body: section.body })),
      links: [
        { href: '/services/', label: locale === 'zh-CN' ? '服务项目' : 'Services' },
        { href: '/topics/', label: locale === 'zh-CN' ? '按主题浏览' : 'Browse by topic' },
        ...(locale === 'zh-CN' ? [] : [{ href: '/partners/', label: 'Dealers and service partners' }]),
        { href: '/about/technical-review/', label: locale === 'zh-CN' ? '技术内容审核政策' : 'Technical content review policy' },
        { href: '/contact/', label: locale === 'zh-CN' ? '联系我们' : 'Contact SAGEMRO' },
        { href: '/refund-policy/', label: locale === 'zh-CN' ? '付款、取消与退款政策' : 'Payment, cancellation and refund policy' },
      ],
    },
    structuredData: {
      '@type': 'AboutPage',
      name: about.h1,
      description: about.seoDescription ?? about.intro,
      url: publicUrl(HOSTS[locale], '/about'),
      about: organizationRef(locale),
    },
  });
  const toolsHub = collection('/tools', 'tools-hub', copy.tools, toolRoutes);
  const servicesHub = collection('/services', 'services-hub', copy.services, serviceRoutes);
  const insightsHub = collection('/insights', 'insights-hub', copy.insights, [...insightRoutes, ...guideRoutes]);
  const contact = contactPage(locale);
  const refundPolicy = refundPolicyPage(locale);
  const contentRoutes = [home, ...partnerRoutes, servicesHub, ...serviceRoutes, toolsHub, ...toolRoutes,
    insightsHub, ...insightRoutes, ...guideRoutes, technicalReviewRoute, aboutRoute, contact, refundPolicy];

  // 主题聚合页。放在最后构建，因为链接文字要从目标页自己的标题解析——
  // 标题改了聚合页不会挂着旧文字。这一页不新增任何事实。
  const labelByPath = new Map(contentRoutes.map((routeValue) => [routeValue.path, routeValue.body?.h1 || routeValue.title]));
  const topicMembers = [...new Set(getTopicGroups(locale).flatMap((section) => section.groups.flatMap((group) => group.members)))];
  const topicRoute = route(locale, {
    path: '/topics',
    type: 'topics',
    title: locale === 'zh-CN'
      ? '按机型、服务形态与问题类型查找服务'
      : 'Find Service by Machine, Form, and Problem Type',
    description: locale === 'zh-CN'
      ? '把服务项目、常用工具与技术洞察按机型、服务形态和问题类型重新聚合，便于按现场实际情况找到对应内容。'
      : 'Service records, calculators, and technical notes regrouped by machine type, service form, and problem type.',
    modified: RELEASE_DATE,
    body: {
      h1: locale === 'zh-CN' ? '按现场情况查找服务与技术内容' : 'Find service and technical content by the situation in front of you',
      paragraphs: [locale === 'zh-CN'
        ? '同一台设备的问题往往同时属于几个类别：机型、服务形态与故障类型。下面按这三条线索把已有内容重新分组，每组只列出确实属于该主题的页面。'
        : 'A single problem usually belongs to more than one category: the machine, the service form, and the type of fault. These groups reorganise the existing pages along those lines, and each group lists only pages that genuinely belong to it.'],
      sections: getTopicGroups(locale).flatMap((section) => section.groups.map((group) => ({
        heading: locale === 'zh-CN' ? `${section.heading}：${group.heading}` : `${section.heading}: ${group.heading}`,
        items: group.members.map((path) => ({ href: `${path}/`, label: labelByPath.get(path) ?? path })),
      }))),
      links: [
        { href: '/services/', label: locale === 'zh-CN' ? '全部服务项目' : 'All service records' },
        { href: '/tools/', label: locale === 'zh-CN' ? '全部工具' : 'All tools' },
        { href: '/insights/', label: locale === 'zh-CN' ? '全部技术洞察' : 'All insights' },
      ],
    },
    structuredData: {
      '@type': 'CollectionPage',
      name: locale === 'zh-CN' ? '按主题浏览' : 'Browse by topic',
      description: locale === 'zh-CN' ? '按机型、服务形态与问题类型聚合的服务与技术内容。' : 'Service and technical content grouped by machine, service form, and problem type.',
      url: publicUrl(HOSTS[locale], '/topics'),
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: topicMembers.map((path, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: publicUrl(HOSTS[locale], path),
        })),
      },
    },
  });

  return withSchemaGraphs([...contentRoutes, topicRoute], locale);
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

export function getRuntimeSeoRoute(pathname, locale = 'en') {
  const publicRoute = getPublicSeoRoute(pathname, locale);
  if (publicRoute) return publicRoute;

  const path = pathname === '/' ? '/' : String(pathname || '').replace(/\/$/, '');
  return getDirectAccessNoindexToolRoutes(locale).find((routeValue) => routeValue.path === path) || null;
}
