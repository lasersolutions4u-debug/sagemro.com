/**
 * 生成 `src/data/publicSeoRouteIndex.js`。
 *
 * 背景：`src/data/publicSeoRoutes.js` 是全部公开路由的**唯一事实来源**，但它把两套语言的
 * 全部正文（sections / faqs / links / structuredData）都装在一个模块里，构建后是 132 KB。
 * 埋点判定只需要其中每页的 `type` 与 `robots` 两个字段，却因为这个 import 把 132 KB
 * 挂在了**每一个**营销页上（首页、/tools/、/insights/、/partners/ 等根本不渲染路由正文的页面也一样）。
 *
 * 本脚本把埋点真正需要的极小信息抽成一个约 2 KB 的索引模块：
 *   - 每页的 `{ type, robots }`
 *   - 已发布故障诊断指南的 slug 集合（`getDiagnosticGuide(slug, locale)` 的真值判定，
 *     原实现为此把 38 KB 的 `diagnosticGuides.js` 也拉进了首屏）
 *
 * 运行：`npm run generate:seo-route-index`
 * 输出必须一起提交；`tests/public-seo-route-index.test.mjs` 会逐项比对索引与源数据，
 * 忘记重新生成（或改了路由没重跑）会导致测试失败。
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getPublicSeoRoutes } from '../src/data/publicSeoRoutes.js';
import { getDiagnosticGuides } from '../src/data/diagnosticGuides.js';

const LOCALES = ['en', 'zh-CN'];
const OUTPUT = path.resolve(import.meta.dirname, '../src/data/publicSeoRouteIndex.js');

function buildRouteMeta(locale) {
  const table = {};
  for (const routeValue of getPublicSeoRoutes(locale)) {
    if (table[routeValue.path]) {
      throw new Error(`${locale} 里出现重复路径：${routeValue.path}`);
    }
    // 只留埋点判定用得到的两项。多留一个字段就是多一份会静默漂移的副本。
    table[routeValue.path] = { type: routeValue.type, robots: routeValue.robots };
  }
  return table;
}

function buildGuideSlugs(locale) {
  // getDiagnosticGuide 只认 status === 'published'，这里必须同口径。
  return getDiagnosticGuides(locale, { publishedOnly: true }).map((guide) => guide.slug).sort();
}

const routeMeta = {};
const guideSlugs = {};
for (const locale of LOCALES) {
  routeMeta[locale] = buildRouteMeta(locale);
  guideSlugs[locale] = buildGuideSlugs(locale);
}

const file = `// 本文件由 scripts/generatePublicSeoRouteIndex.mjs 生成，请勿手改。
// 重新生成：npm run generate:seo-route-index
//
// 存在的理由：埋点判定（hooks/useAcquisitionTracking.js）只需要每页的 type / robots 与
// 「这个 slug 是不是已发布的故障诊断指南」，而这两件事原先要 import 132 KB 的
// publicSeoRoutes.js（全部路由正文）和 38 KB 的 diagnosticGuides.js —— 于是它们被挂在
// 每一个营销页的首屏上，包括根本不渲染路由正文的首页。
//
// 正确性由 tests/public-seo-route-index.test.mjs 保证：索引与源数据逐项比对，
// 并且对每条路由都比对「走索引」与「注入完整 route 对象」得到的埋点上下文完全一致。

const ROUTE_META = ${JSON.stringify(routeMeta, null, 2)};

const DIAGNOSTIC_GUIDE_SLUGS = ${JSON.stringify(guideSlugs, null, 2)};

/**
 * 与 publicSeoRoutes.getPublicSeoRoute 完全相同的路径归一化与 locale 兜底。
 * 只返回 { path, type, robots }。
 */
export function getPublicSeoRouteMeta(pathname, locale = 'en') {
  const table = ROUTE_META[locale === 'zh-CN' ? 'zh-CN' : 'en'];
  const normalizedPath = pathname === '/' ? '/' : String(pathname || '').replace(/\\/$/, '');
  const meta = table[normalizedPath];
  return meta ? { path: normalizedPath, type: meta.type, robots: meta.robots } : null;
}

/**
 * 等价于 Boolean(getDiagnosticGuide(slug, locale))，含 locale 缺失时回落到 en 的行为。
 */
export function isDiagnosticGuideSlug(slug, locale = 'en') {
  if (typeof slug !== 'string' || !slug) return false;
  const slugs = DIAGNOSTIC_GUIDE_SLUGS[locale] ?? DIAGNOSTIC_GUIDE_SLUGS.en;
  return slugs.includes(slug);
}
`;

await writeFile(OUTPUT, file, 'utf8');

const routeCount = LOCALES.reduce((total, locale) => total + Object.keys(routeMeta[locale]).length, 0);
console.log(`已写入 ${path.relative(process.cwd(), OUTPUT)}`);
console.log(`  路由 ${routeCount} 条（${LOCALES.map((locale) => `${locale}: ${Object.keys(routeMeta[locale]).length}`).join('，')}）`);
console.log(`  诊断指南 slug ${LOCALES.map((locale) => `${locale}: ${guideSlugs[locale].length}`).join('，')}`);
console.log(`  文件大小 ${Buffer.byteLength(file, 'utf8')} B`);
