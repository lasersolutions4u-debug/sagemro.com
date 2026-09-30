/**
 * 生成 `src/data/homeFeaturedTools.js`。
 *
 * 背景：首页要渲染三张工具卡片，为此 `PublicHomePage.jsx` 原先 import 了
 * `data/industryTools.js`（61 KB 源码）—— 那里装着全部 10 个工具的 SEO 证据、
 * FAQ、示例、以及所有计算器的实现。首页真正用到的只有 3 个工具的
 * `{ id, slug, label, description }`（本地化后）。
 *
 * 因为 `PublicHomePage` 是静态导入的，这 61 KB 就落在**入口分块**里，每个营销页都要付费；
 * 实测把这条 import 摘掉，入口分块 331 KB → 275 KB（首页首屏 JS 574 → 519 KB）。
 *
 * 本脚本把首页需要的那一小片抽出来（约 1 KB），源数据仍是 `industryTools.js` ——
 * 生成物与源数据的一致性由 `tests/home-featured-tools.test.mjs` 保证。
 *
 * 要换首页推荐哪几个工具：改下面的 `FEATURED_TOOL_IDS`，然后
 * `npm run generate:home-featured-tools`。
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getLocalizedTool, industryTools } from '../src/data/industryTools.js';

const FEATURED_TOOL_IDS = ['cutting-speed', 'auxiliary-sizing', 'metal-weight'];
const LOCALES = ['en', 'zh-CN'];
const OUTPUT = path.resolve(import.meta.dirname, '../src/data/homeFeaturedTools.js');

const localized = {};
for (const locale of LOCALES) {
  localized[locale] = FEATURED_TOOL_IDS.map((id) => {
    const tool = industryTools.find((candidate) => candidate.id === id);
    if (!tool) throw new Error(`industryTools 里没有 id=${id}，首页会少一张卡片`);
    const copy = getLocalizedTool(tool, locale);
    // 只留首页渲染用得到的四个字段：多留一个就多一份会静默漂移的副本。
    return { id: copy.id, slug: copy.slug, label: copy.label, description: copy.description };
  });
}

const file = `// 本文件由 scripts/generateHomeFeaturedTools.mjs 生成，请勿手改。
// 重新生成：npm run generate:home-featured-tools
//
// 存在的理由：首页只需要 3 个工具卡片的 { id, slug, label, description }，而
// data/industryTools.js 有 61 KB（全部工具的 SEO 证据 + 计算器）。首页是静态导入的，
// 直接 import 那个模块会把 61 KB 放进入口分块，让每一个营销页都多付一次。
//
// 正确性由 tests/home-featured-tools.test.mjs 保证：生成物与 getLocalizedTool 的输出逐字段一致。

export const HOME_FEATURED_TOOL_IDS = ${JSON.stringify(FEATURED_TOOL_IDS)};

const TOOLS = ${JSON.stringify(localized, null, 2)};

/** 返回首页工具卡片的本地化数据（每次调用都是新对象，调用方改它不会污染缓存）。 */
export function getHomeFeaturedTools(locale = 'en') {
  const table = TOOLS[locale] ?? TOOLS.en;
  return table.map((tool) => ({ ...tool }));
}
`;

await writeFile(OUTPUT, file, 'utf8');

console.log(`已写入 ${path.relative(process.cwd(), OUTPUT)}`);
console.log(`  工具 ${FEATURED_TOOL_IDS.length} 个 × ${LOCALES.length} 语言`);
console.log(`  文件大小 ${Buffer.byteLength(file, 'utf8')} B`);
