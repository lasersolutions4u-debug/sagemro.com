import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getPublicSeoRoutes } from '../src/data/publicSeoRoutes.js';

// SERP 的长度限制是**显示宽度**，而一个汉字约占两个半角字符——所以中英两版不能用同一套字符数。
// 拿同一套阈值去量中英两版，正是当初「CN 内容量只有 COM 的 43%」那个错误结论的老路。
const BUDGET = {
  en: { title: 60, description: 160, descriptionFloor: 70 },
  'zh-CN': { title: 40, description: 80, descriptionFloor: 40 },
};
const BRAND_SUFFIX = ' | SAGEMRO';

test('the title suffix this budget is measured against is still what the renderer emits', async () => {
  // 这条断言是「护栏的护栏」：预算按 `${route.title} | SAGEMRO` 的长度算，
  // 如果哪天渲染器改了后缀，下面那条测试就会在错误的基准上继续通过。
  const renderer = await readFile(new URL('../scripts/publicPageRenderer.mjs', import.meta.url), 'utf8');
  assert.match(renderer, /const title = `\$\{route\.title\} \| SAGEMRO`;/);
});

test('every public route keeps its title and description inside the SERP budget', () => {
  const violations = [];
  for (const locale of ['en', 'zh-CN']) {
    const budget = BUDGET[locale];
    for (const route of getPublicSeoRoutes(locale)) {
      const title = `${route.title}${BRAND_SUFFIX}`;
      if (title.length > budget.title) {
        violations.push(`${locale} ${route.path} title ${title.length}/${budget.title}：${title}`);
      }
      if (!route.description) {
        violations.push(`${locale} ${route.path} 没有 description`);
        continue;
      }
      if (route.description.length > budget.description) {
        violations.push(`${locale} ${route.path} description ${route.description.length}/${budget.description} 过长`);
      }
      if (route.description.length < budget.descriptionFloor) {
        violations.push(`${locale} ${route.path} description ${route.description.length}/${budget.descriptionFloor} 过短`);
      }
    }
  }
  assert.deepEqual(violations, [], `以下页面的元数据超出 SERP 长度预算：\n${violations.join('\n')}`);
});

test('the meta description is not simply the first visible paragraph of the page', () => {
  // 这类缺陷的实质是**长度**，不是"能不能复用正文"：文章页拿自己的导语当 meta 是常规做法，
  // 真正出问题的是 `/about/` 那种把 305 字符的正文首段直接当描述的情况——它已经被上面的
  // 预算测试拦住。所以这里只做一件事：确保**超过预算**的正文段落没有被当成描述用。
  const violations = [];
  for (const locale of ['en', 'zh-CN']) {
    const budget = BUDGET[locale];
    for (const route of getPublicSeoRoutes(locale)) {
      const firstParagraph = route.body?.paragraphs?.[0];
      if (!firstParagraph || firstParagraph.length <= budget.description) continue;
      if (route.description === firstParagraph) violations.push(`${locale} ${route.path}`);
    }
  }
  assert.deepEqual(
    violations,
    [],
    '这些页面把过长的正文首段直接当 meta description 用了：\n' + violations.join('\n'),
  );
});
