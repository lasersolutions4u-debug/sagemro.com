import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { getDiagnosticGuide, getDiagnosticGuides } from '../src/data/diagnosticGuides.js';
import { getPublicSeoRouteMeta, isDiagnosticGuideSlug } from '../src/data/publicSeoRouteIndex.js';
import { getPublicSeoRoute, getPublicSeoRoutes } from '../src/data/publicSeoRoutes.js';

const root = path.resolve(import.meta.dirname, '..');
const LOCALES = ['en', 'zh-CN'];

test('the generated route index covers exactly the same routes and fields as the manifest', () => {
  for (const locale of LOCALES) {
    const manifest = getPublicSeoRoutes(locale);
    assert.ok(manifest.length > 0, locale);

    for (const route of manifest) {
      const meta = getPublicSeoRouteMeta(route.path, locale);
      assert.ok(meta, `${locale} ${route.path} 不在索引里`);
      assert.equal(meta.type, route.type, `${locale} ${route.path} type`);
      assert.equal(meta.robots, route.robots, `${locale} ${route.path} robots`);
      assert.equal(meta.path, route.path, `${locale} ${route.path} path`);
    }

    // 反向存在性：索引与清单必须同时命中、同时落空（删掉路由却忘了重新生成时这里会失败）。
    for (const pathname of ['/definitely-not-a-route', '/services', '/services/nope', '/tools']) {
      const viaIndex = getPublicSeoRouteMeta(pathname, locale);
      const viaManifest = getPublicSeoRoute(pathname, locale);
      assert.equal(Boolean(viaIndex), Boolean(viaManifest), `${locale} ${pathname} 存在性`);
    }
  }
});

test('the generated route index normalises paths and locales exactly like the manifest lookup', () => {
  const probes = [
    '/', '//', '/services', '/services/', '/services//', '/services/laser-cutting-machine-repair/',
    '/partners', '/partners/', '/about', '/about/', '/topics/', '/tools/steel-price-watch',
    '/private', '/nope', '', null, undefined, '/SERVICES',
  ];

  for (const locale of [...LOCALES, 'en-US', undefined]) {
    for (const pathname of probes) {
      const meta = getPublicSeoRouteMeta(pathname, locale);
      const route = getPublicSeoRoute(pathname, locale);
      assert.equal(Boolean(meta), Boolean(route), `${locale} ${String(pathname)} 存在性`);
      if (meta && route) {
        assert.deepEqual(
          { path: meta.path, type: meta.type, robots: meta.robots },
          { path: route.path, type: route.type, robots: route.robots },
          `${locale} ${String(pathname)}`,
        );
      }
    }
  }
});

test('the generated diagnostic-guide slug set matches getDiagnosticGuide truthiness', () => {
  for (const locale of LOCALES) {
    const published = getDiagnosticGuides(locale, { publishedOnly: true }).map((guide) => guide.slug);
    assert.ok(published.length > 0, locale);

    for (const slug of published) {
      assert.equal(isDiagnosticGuideSlug(slug, locale), true, `${locale} ${slug}`);
      assert.ok(getDiagnosticGuide(slug, locale), `${locale} ${slug}`);
    }

    // 未发布 / 不存在 / 非字符串的 slug 一律与 getDiagnosticGuide 同口径。
    for (const slug of ['', 'nope', null, undefined, 42, 'laser-cutting-machine-not-firing-imaginary']) {
      assert.equal(
        isDiagnosticGuideSlug(slug, locale),
        Boolean(getDiagnosticGuide(slug, locale)),
        `${locale} ${String(slug)}`,
      );
    }

    // 未发布的指南必须被判为 false，否则埋点会把它们记成 diagnostic_guide。
    for (const guide of getDiagnosticGuides(locale, { publishedOnly: false })) {
      assert.equal(
        isDiagnosticGuideSlug(guide.slug, locale),
        Boolean(getDiagnosticGuide(guide.slug, locale)),
        `${locale} ${guide.slug}（未发布）`,
      );
    }
  }

  // locale 缺失时 getDiagnosticGuide 会回落到 en，索引必须一致。
  const englishSlug = getDiagnosticGuides('en', { publishedOnly: true })[0].slug;
  assert.equal(isDiagnosticGuideSlug(englishSlug, undefined), true);
  assert.equal(isDiagnosticGuideSlug(englishSlug, 'fr'), true);
  assert.equal(isDiagnosticGuideSlug('nope', undefined), false);
});

test('the acquisition hook keeps the heavy route and guide data off the eager import path', () => {
  // 这条测试的性质是**回归护栏**，不是风格检查：
  // hooks/useAcquisitionTracking.js 被 App.jsx 在渲染期同步调用，任何静态 import 都会
  // 把那个模块挂到每一个营销页的首屏上。publicSeoRoutes 是 132 KB、diagnosticGuides 是 38 KB，
  // 它们原先就是这样被拉进首屏的。要重新引入，先证明收益大于代价。
  const source = readFileSync(path.join(root, 'src/hooks/useAcquisitionTracking.js'), 'utf8');

  assert.doesNotMatch(source, /from\s+'[^']*publicSeoRoutes/, '不要在埋点模块里 import 完整路由表');
  assert.doesNotMatch(source, /from\s+'[^']*diagnosticGuides/, '不要在埋点模块里 import 完整指南数据');
  assert.match(source, /from\s+'\.\.\/data\/publicSeoRouteIndex\.js'/);
});
