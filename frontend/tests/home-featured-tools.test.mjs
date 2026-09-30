import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getHomeFeaturedTools, HOME_FEATURED_TOOL_IDS } from '../src/data/homeFeaturedTools.js';
import { getLocalizedTool, industryTools } from '../src/data/industryTools.js';

const LOCALES = ['en', 'zh-CN'];

test('the generated home tool cards match getLocalizedTool field by field in both locales', () => {
  // 首页卡片现在读的是生成模块，而源数据仍是 industryTools.js。
  // 这条测试就是两者的粘合剂：生成物一旦与源数据脱节（改了工具文案却忘了重新生成），
  // 首页会静默显示旧文案——正是这种静默漂移最难发现，所以逐字段断言。
  for (const locale of LOCALES) {
    const generated = getHomeFeaturedTools(locale);
    assert.equal(generated.length, HOME_FEATURED_TOOL_IDS.length, locale);

    for (const [index, toolId] of HOME_FEATURED_TOOL_IDS.entries()) {
      const source = industryTools.find((tool) => tool.id === toolId);
      assert.ok(source, `industryTools 里没有 id=${toolId}`);
      const localized = getLocalizedTool(source, locale);

      assert.deepEqual(
        generated[index],
        {
          id: localized.id,
          slug: localized.slug,
          label: localized.label,
          description: localized.description,
        },
        `${locale} ${toolId}`,
      );
    }
  }
});

test('the generated home tool cards keep only the four fields the home page renders', () => {
  // 多留字段就是多一份会漂移的副本，也会把 61 KB 里的 SEO 证据悄悄带回来。
  for (const locale of LOCALES) {
    for (const tool of getHomeFeaturedTools(locale)) {
      assert.deepEqual(Object.keys(tool).sort(), ['description', 'id', 'label', 'slug'], `${locale} ${tool.id}`);
      assert.ok(tool.label.trim() && tool.description.trim(), `${locale} ${tool.id} 文案不能为空`);
      assert.match(tool.slug, /^[a-z0-9-]+$/, `${locale} ${tool.id} slug`);
    }
  }
});

test('the home page renders its tool cards from the generated module, not from the full tool table', () => {
  const source = readFileSync(
    new URL('../src/components/Public/PublicHomePage.jsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /from '\.\.\/\.\.\/data\/homeFeaturedTools'/);
  assert.doesNotMatch(source, /from '\.\.\/\.\.\/data\/industryTools'/);
});

test('getHomeFeaturedTools falls back to the English cards for an unknown locale and copies defensively', () => {
  const english = getHomeFeaturedTools('en');
  assert.deepEqual(getHomeFeaturedTools('fr'), english);
  assert.deepEqual(getHomeFeaturedTools(), english);

  const mutated = getHomeFeaturedTools('en');
  mutated[0].label = 'CHANGED';
  assert.notEqual(getHomeFeaturedTools('en')[0].label, 'CHANGED');
});
