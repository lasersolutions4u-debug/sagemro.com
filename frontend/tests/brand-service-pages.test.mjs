import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const expectedSlugs = [
  'hans-laser',
  'hsg-laser',
  'bodor-laser',
  'hymson-laser',
  'trumpf',
  'bystronic',
  'amada',
  'yawei',
  'raycus',
  'ipg-photonics',
  'max-photonics',
  'friendess-bochu',
  'beckhoff',
  'raytools',
];

const expectedCategories = {
  machine: ['hans-laser', 'hsg-laser', 'bodor-laser', 'hymson-laser', 'trumpf', 'bystronic', 'amada', 'yawei'],
  'laser-source': ['raycus', 'ipg-photonics', 'max-photonics'],
  'control-system': ['friendess-bochu', 'beckhoff'],
  'cutting-head': ['raytools'],
};

async function loadBrandModule() {
  return import('../src/data/brandServicePages.js');
}

test('brand registry exposes the approved fourteen slugs in four practical categories', async () => {
  const { getBrandServicePages } = await loadBrandModule();

  for (const locale of ['en', 'zh-CN']) {
    const pages = getBrandServicePages(locale);
    assert.deepEqual(pages.map((page) => page.slug), expectedSlugs);
    assert.equal(new Set(pages.map((page) => page.slug)).size, expectedSlugs.length);

    for (const [category, slugs] of Object.entries(expectedCategories)) {
      assert.deepEqual(pages.filter((page) => page.category === category).map((page) => page.slug), slugs);
    }
  }
});

test('every bilingual brand page has useful differentiated support content', async () => {
  const { getBrandServicePage, getBrandServicePages } = await loadBrandModule();

  for (const locale of ['en', 'zh-CN']) {
    const pages = getBrandServicePages(locale);
    assert.equal(new Set(pages.map((page) => page.summary)).size, expectedSlugs.length);

    for (const page of pages) {
      assert.ok(page.brandName.length > 0);
      assert.ok(page.title.length > 0);
      assert.ok(page.seoTitle.length > 0);
      assert.ok(page.description.length > 0);
      assert.ok(page.summary.length >= 80, `${locale}/${page.slug} summary should contain at least eighty characters`);
      assert.ok(page.supportScope.length >= 3);
      assert.ok(page.commonNeeds.length >= 3);
      assert.ok(page.customerInputs.length >= 4);
      assert.ok(page.independenceNotice.length > 0);
      assert.equal(getBrandServicePage(page.slug, locale).slug, page.slug);
    }
  }

  assert.equal(getBrandServicePage('not-a-brand', 'en'), null);
});

test('brand pages clearly state independent service boundaries without authorization claims', async () => {
  const { getBrandServicePages } = await loadBrandModule();

  for (const page of getBrandServicePages('en')) {
    const copy = Object.values(page).flat().join(' ');
    assert.match(page.independenceNotice, /independent/i);
    assert.match(page.independenceNotice, /not affiliated|not authorized/i);
    assert.doesNotMatch(copy, /official service|official partner|authorized service provider/i);
  }

  for (const page of getBrandServicePages('zh-CN')) {
    const copy = Object.values(page).flat().join(' ');
    assert.match(page.independenceNotice, /独立/);
    assert.match(page.independenceNotice, /非.*官方|未获.*授权/);
    assert.doesNotMatch(copy, /官方服务商|官方合作伙伴|授权服务商/);
  }
});

test('brand request links use the matching AI market and preserve the selected brand', async () => {
  const { getBrandServiceRequestHref } = await loadBrandModule();

  for (const slug of expectedSlugs) {
    assert.equal(getBrandServiceRequestHref(slug, 'en'), `https://ai.sagemro.com/service-request?mode=manual&brand=${slug}`);
    assert.equal(getBrandServiceRequestHref(slug, 'zh-CN'), `https://ai.sagemro.cn/service-request?mode=manual&brand=${slug}`);
  }
});

test('brand route parsing distinguishes the category hub, details, and malformed paths', async () => {
  const { getBrandServicePageRoute } = await loadBrandModule();

  assert.deepEqual(getBrandServicePageRoute('/brands'), { type: 'hub', slug: '' });
  assert.deepEqual(getBrandServicePageRoute('/brands/'), { type: 'hub', slug: '' });
  assert.deepEqual(getBrandServicePageRoute('/brands/trumpf'), { type: 'detail', slug: 'trumpf' });
  assert.deepEqual(getBrandServicePageRoute('/brands/trumpf/'), { type: 'detail', slug: 'trumpf' });
  assert.deepEqual(getBrandServicePageRoute('/brands//'), { type: 'not-found', slug: '' });
  assert.equal(getBrandServicePageRoute('/services/trumpf'), null);
});

test('brand hub and detail component reuse the public shell and only link to the unified request flow', async () => {
  const component = await readFile(new URL('../src/components/Brands/BrandServicePages.jsx', import.meta.url), 'utf8');

  assert.match(component, /<PublicSiteShell/);
  assert.match(component, /getBrandServicePageRoute\(pathname\)/);
  assert.match(component, /getBrandServicePages\(locale\)/);
  assert.match(component, /getBrandServiceRequestHref\(page\.slug, locale\)/);
  assert.match(component, /items=\{page\.supportScope\}/);
  assert.match(component, /items=\{page\.commonNeeds\}/);
  assert.match(component, /items=\{page\.customerInputs\}/);
  assert.doesNotMatch(component, /<form\b/i);
  assert.doesNotMatch(component, /whatsapp|tel:/i);
});
