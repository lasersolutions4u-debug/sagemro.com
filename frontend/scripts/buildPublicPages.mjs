import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { getDirectAccessNoindexToolRoutes, getPublicSeoRoutes } from '../src/data/publicSeoRoutes.js';
import { renderNotFoundDocument, renderPublicDocument, renderSitemap } from './publicPageRenderer.mjs';

const hosts = { en: 'https://sagemro.com', 'zh-CN': 'https://sagemro.cn' };

function localeFromTemplate(template) {
  return /<html\b[^>]*\blang\s*=\s*["']zh-CN["']/i.test(template) ? 'zh-CN' : 'en';
}

function validateRoutes(routes) {
  const paths = new Set();

  for (const route of routes) {
    const { path } = route;
    if (typeof path !== 'string' || !path.startsWith('/') || (path !== '/' && path.endsWith('/'))
      || path.includes('..') || /[?#]/.test(path) || paths.has(path)) {
      throw new Error(`Unsafe or duplicate public route path: ${path}`);
    }
    paths.add(path);
  }
}

function renderSitemapWithDates(routes) {
  let sitemap = renderSitemap(routes);
  for (const route of routes) {
    if (!route.modified) continue;
    sitemap = sitemap.replace(`<loc>${route.canonical}</loc>`, `<loc>${route.canonical}</loc>\n    <lastmod>${route.modified}</lastmod>`);
  }
  return sitemap;
}

function renderRedirects() {
  return [
    '/activate / 200',
    '/engineer / 200',
    '/work-orders/* / 200',
    '',
  ].join('\n');
}

function renderRobots(locale) {
  const host = hosts[locale];
  // 允许常规搜索引擎，以及 ChatGPT 搜索用的 OAI-SearchBot（检索/引用用途，不是训练）。
  const publicSearchAgents = ['Googlebot', 'Bingbot', 'OAI-SearchBot'];
  // 只用于喂训练的抓取器，明确拒绝。
  // Google-Extended 刻意不在这份名单里：它控制的是 Gemini Apps / Vertex AI 的 grounding
  // ——也就是"内容能不能被 AI 答案引用"——不只是训练。把它当"仅训练"一起封掉，
  // 等于顺手放弃了 Google 的 AI 答案面（AI Overviews / Gemini），这不是原本的意图。
  const trainingOnlyAgents = ['GPTBot', 'ClaudeBot', 'CCBot'];
  const privatePaths = ['/api/', '/admin/'];
  const searchPolicy = (agent) => [`User-agent: ${agent}`, 'Allow: /', ...privatePaths.map((path) => `Disallow: ${path}`)].join('\n');
  const baiduPolicy = locale === 'zh-CN'
    ? searchPolicy('Baiduspider')
    : 'User-agent: Baiduspider\nDisallow: /';

  return [
    ...publicSearchAgents.map(searchPolicy),
    baiduPolicy,
    searchPolicy('*'),
    ...trainingOnlyAgents.map((agent) => `User-agent: ${agent}\nDisallow: /`),
    `Sitemap: ${host}/sitemap.xml`,
    '',
  ].join('\n\n');
}

/**
 * llms.txt：给 AI 系统的一份自述。
 *
 * 以前这里是一句与市场无关的模板，且中英两版除域名外完全相同——中文站交给 AI 的是一份
 * 英文自我介绍，内容还是更早的"工具站"口径（planning references for industrial equipment users），
 * 既没写真实业务，也没列服务页。现在按语言分别描述业务、列出主要页面。
 */
function renderLlms(locale) {
  const host = hosts[locale];
  if (locale === 'zh-CN') {
    return `# SAGEMRO（济南钰峭机械有限公司）

SAGEMRO 承接激光与金属成形设备整机厂自己做不过来的售后交付：保内上门、出口设备海外装机与调试、
返修件流转与备件支持。工程师与备件由我们组织，按项目或按次结算。我们不销售设备。

本站由济南钰峭机械有限公司运营，服务与备件由济南团队组织交付。

本站内容为服务说明与规划参考。实际诊断、报价、派工与安全要求由技术人员按具体项目确认，
不预先承诺交付时效。

## 主要页面

- ${host}/ — 业务总览
- ${host}/services/ — 服务项目
- ${host}/services/laser-cutting-machine-repair/ — 激光切割机维修与故障诊断（含参考价格区间）
- ${host}/services/press-brake-repair/ — 折弯机维修与精度支持
- ${host}/services/remote-diagnostics/ — 激光切割机远程诊断与工程师支持
- ${host}/services/preventive-maintenance/ — 激光切割机与折弯机预防性维护（含参考价格区间）
- ${host}/services/machine-relocation-installation/ — 激光切割机拆机、移位、安装与调试
- ${host}/services/spare-parts-consumables/ — 激光切割机备件与耗材供应（含参考价格区间）
- ${host}/services/oem-service-partner/ — 整机厂售后合作与保内服务外包
- ${host}/services/after-sales-outsourcing/ — 设备委外维修与售后外包
- ${host}/services/overseas-delivery/ — 出口设备海外安装调试与交付
- ${host}/services/third-party-service/ — 第三方与多品牌设备服务
- ${host}/tools/ — 材料重量、切割成本、折弯与辅机选型计算器
- ${host}/insights/ — 实务说明与故障处理指南
- ${host}/topics/ — 按机型、服务形态与问题类型浏览
- ${host}/about/ — SAGEMRO 是谁：法人实体、业务范围与服务边界
- ${host}/about/technical-review/ — 技术内容审核政策
- ${host}/contact/ — 邮箱、工作时段（UTC+8）、回复时效、注册地址与运营主体
- ${host}/refund-policy/ — 付款、取消与退款政策（30% 预付 / 70% 验收后付、取消分档、退款时效）

## 适用范围

- 本文件仅描述中国版站点。国际版见 ${hosts.en}/
- SAGEMRO 是服务承包方，不是设备制造商或设备销售商
- 运营主体：济南钰峭机械有限公司（${host}/contact/ 与 /about/ 均列明）
- 报价先于开工并逐项列明；本文件所列参考区间不构成报价

联系：support@sagemro.com（周一至周五 09:00–18:00，UTC+8；一个工作日内回复，不含法定节假日）
`;
  }
  return `# SAGEMRO LLC (Wyoming, United States)

SAGEMRO takes over the after-sales delivery that laser and metal forming equipment builders and their
overseas dealers cannot cover themselves: in-warranty on-site service, export commissioning and customer
training, and exchange-unit flow for returned parts. Engineers and parts are organized by SAGEMRO from
Jinan, China; work is billed per project or per visit. We do not sell machines.

SAGEMRO LLC (Wyoming) operates this website and issues invoices to overseas customers; service delivery is
supported by our team in Jinan, China. The registered office is 30 N Gould St Ste N, Sheridan, WY 82801,
United States; the service team, parts stock, and workshop are in Jinan.

Content on this site is service information and planning reference. Final diagnosis, pricing, assignment,
and safety requirements are confirmed by technicians for the individual project; no lead time is promised
in advance. Repair, maintenance, and parts pages publish indicative budget ranges; the binding price is
stated in the written quotation issued by SAGEMRO LLC.

## Main pages

- ${host}/ — overview of the three delivery forms
- ${host}/partners/ — support for overseas dealers and agents
- ${host}/services/ — service catalogue
- ${host}/services/laser-cutting-machine-repair/ — laser cutting machine repair and diagnostics (indicative budget ranges)
- ${host}/services/press-brake-repair/ — press brake repair and accuracy support
- ${host}/services/remote-diagnostics/ — laser cutting machine remote diagnostics
- ${host}/services/preventive-maintenance/ — laser cutting machine and press brake maintenance (indicative budget ranges)
- ${host}/services/machine-relocation-installation/ — relocation, installation, and commissioning
- ${host}/services/spare-parts-consumables/ — spare parts and consumables, including exchange units (indicative budget ranges)
- ${host}/services/oem-service-partner/ — OEM after-sales service partner
- ${host}/services/after-sales-outsourcing/ — outsourced laser equipment field service
- ${host}/services/overseas-delivery/ — overseas installation, commissioning, and warranty response
- ${host}/services/third-party-service/ — third-party and multi-brand equipment service
- ${host}/tools/ — free laser cutting, press brake, and material calculators
- ${host}/insights/ — practical service notes and troubleshooting guides
- ${host}/topics/ — browse service and technical content by topic
- ${host}/about/ — who SAGEMRO is: legal entity, scope, and service boundaries
- ${host}/about/technical-review/ — technical content review policy
- ${host}/contact/ — email, working hours (UTC+8), response time, the registered office, and the invoicing entity
- ${host}/refund-policy/ — payment, cancellation, and refund policy (30% deposit, 70% on acceptance)

## Scope

- This file describes the international site. The China edition is ${hosts['zh-CN']}/
- SAGEMRO is a service contractor, not a machine manufacturer or a machine seller
- Operating entity: SAGEMRO LLC (Wyoming, United States); service delivery: Jinan, China
- Registered office: 30 N Gould St Ste N, Sheridan, WY 82801, United States
- Every job is quoted in writing before it starts; the indicative ranges on this site are not quotations
- SAGEMRO does not replace the equipment maker's warranty; claims under a maker warranty stay with the maker or its dealer

Contact: support@sagemro.com (Mon–Fri 09:00–18:00 UTC+8; reply within one business day, public holidays excluded)
`;
}

async function writeRoute(distDir, route, template, locale) {
  const target = route.path === '/' ? join(distDir, 'index.html') : join(distDir, route.path.slice(1), 'index.html');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, renderPublicDocument(template, route, locale));
}

export async function buildPublicPages({ distDir, locale: requestedLocale }) {
  const template = await readFile(join(distDir, 'index.html'), 'utf8');
  // An explicit locale is what SAGEMRO_BUILD_MARKET supplies. The template fallback
  // keeps a bare `node scripts/buildPublicPages.mjs` working against whatever
  // checkout it happens to run in, which is how this behaved before the market
  // dimension existed.
  const locale = requestedLocale ?? localeFromTemplate(template);
  const routes = getPublicSeoRoutes(locale);
  const noindexToolRoutes = getDirectAccessNoindexToolRoutes(locale);
  validateRoutes([...routes, ...noindexToolRoutes]);

  await Promise.all([...routes, ...noindexToolRoutes].map((route) => writeRoute(distDir, route, template, locale)));
  await Promise.all([
    writeFile(join(distDir, '404.html'), renderNotFoundDocument(template, locale)),
    writeFile(join(distDir, 'sitemap.xml'), renderSitemapWithDates(routes)),
    writeFile(join(distDir, 'robots.txt'), renderRobots(locale)),
    writeFile(join(distDir, '_redirects'), renderRedirects()),
    writeFile(join(distDir, 'llms.txt'), renderLlms(locale)),
  ]);

  return { locale, routeCount: routes.length };
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  await buildPublicPages({ distDir: resolve('dist') });
}
