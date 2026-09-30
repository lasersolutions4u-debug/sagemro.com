import assert from 'node:assert/strict';
import test from 'node:test';
import { walkStaticImports } from './helpers/eagerGraph.mjs';

// 首屏字节预算是这个项目反复踩的坑：`publicSeoRoutes.js`（132 KB 构建后）与
// `diagnosticGuides.js`（38 KB）曾经因为埋点模块的一句 import 而挂在每个营销页上；
// `industryTools.js`（61 KB）也是同类。三次都不是"代码写错了"，而是**没人看得见**
// 某个静态 import 把多大一份数据拖进了首屏。
//
// 所以这里不逐条写死"哪个文件不许被 import"，而是给出一条**会自己生效**的规则：
// 首屏图里不许出现超过 20 KB 的数据模块。新增一条 import 让某份大表进入首屏时，
// 这条测试会直接失败，并告诉你它有多大。

const DATA_MODULE_BUDGET_BYTES = 20_000;

test('the eager module graph reachable from App.jsx obeys the data-module size budget', () => {
  const graph = walkStaticImports();

  // 遍历本身要可信：入口图不可能只有几个文件。
  assert.ok(graph.length > 15, `只走到 ${graph.length} 个文件，import 解析大概坏了`);
  assert.ok(graph.some((entry) => entry.relative === 'src/App.jsx'), '入口本身应当在图里');

  const oversize = graph
    .filter((entry) => /^src\/data\/.*\.js$/.test(entry.relative))
    .filter((entry) => entry.size > DATA_MODULE_BUDGET_BYTES)
    .map((entry) => `${entry.relative} (${entry.size} B)`);

  assert.deepEqual(
    oversize,
    [],
    `首屏图里出现了超过 ${DATA_MODULE_BUDGET_BYTES} B 的数据模块：\n${oversize.join('\n')}\n`
      + '如果它确实是首屏必需的，把必要的那几个字段生成成一个小模块（参考 '
      + 'src/data/publicSeoRouteIndex.js 与 src/data/homeFeaturedTools.js）；'
      + '如果只是"顺手 import 一下"，改成按需加载。',
  );
});

test('the three modules that once cost every marketing page their weight stay out of the eager graph', () => {
  const graph = walkStaticImports();
  const reached = new Set(graph.map((entry) => entry.relative));

  // 逐条点名，是为了让失败信息直接说出"这曾经花了多少钱"。
  const offenders = [
    'src/data/publicSeoRoutes.js',
    'src/data/diagnosticGuides.js',
    'src/data/industryTools.js',
  ].filter((relative) => reached.has(relative));

  assert.deepEqual(offenders, [], `这些模块不该在首屏图里：${offenders.join(', ')}`);

  // 生成的小索引必须在图里 —— 否则说明它们被换掉了、上面的断言就是空的。
  assert.ok(reached.has('src/data/publicSeoRouteIndex.js'), '路由索引应当是首屏图的一部分');
  assert.ok(reached.has('src/data/homeFeaturedTools.js'), '首页工具数据应当是首屏图的一部分');
});
