# SAGEMRO Public Service Site and SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `sagemro.com` and `sagemro.cn` into outcome-first public service sites that explain SAGEMRO's equipment services, retain the existing tools and insights, and create crawlable service and brand landing pages.

**Architecture:** Keep the existing React/Vite public-route manifest and static prerender pipeline. Add one bilingual homepage content model, one public homepage component, four missing service-detail records, and an initial evidence-based brand hub. Public calls to action only navigate to the single service-request route on the matching `ai.*` host; they do not create another form.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4, Node.js ES modules, Node test runner, generated static HTML, JSON-LD.

---

## Global constraints

- Preserve `/services/`, `/tools/`, `/insights/`, and `/about/technical-review/` URLs and canonicals.
- Do not copy competitor text, testimonials, response-time promises, customer counts, or warranty terms.
- Do not claim official authorization or partnership with any equipment brand.
- Keep `support@sagemro.com` as the only public direct contact channel.
- All service-request CTAs must resolve to `https://ai.sagemro.com/service-request` or `https://ai.sagemro.cn/service-request`.
- Brand pages must contain unique, useful service content; never generate name-swapped thin pages.

## File map

- Create `frontend/src/data/publicHomeContent.js` — bilingual homepage sections and safe CTA targets.
- Create `frontend/src/components/Home/PublicHomePage.jsx` — visible public homepage.
- Create `frontend/src/components/common/PublicSiteShell.jsx` — shared public header/footer/navigation.
- Create `frontend/src/data/brandServicePages.js` — initial brand registry and bilingual content.
- Create `frontend/src/components/Brands/BrandServicePages.jsx` — brand hub/detail rendering.
- Modify `frontend/src/data/servicePages.js` — add retrofit, relocation, used-equipment, and parts pages.
- Modify `frontend/src/data/publicSeoRoutes.js` — publish homepage, service, and brand route metadata.
- Modify `frontend/src/App.jsx` — render public home and brand routes on public builds.
- Modify public shells (`ServicePages.jsx`, `InsightsPage.jsx`, `IndustryToolsPage.jsx`, `TechnicalReviewPage.jsx`) only to reuse navigation and AI-host CTA helpers.
- Modify `frontend/scripts/publicPageRenderer.mjs` — render semantic links and homepage sections in first paint.
- Modify `frontend/scripts/buildPublicPages.mjs` — add `/brands/` to `llms.txt`; keep AI routes outside crawl artifacts.
- Test with focused frontend tests plus the full frontend gate.

### Task 1: Lock the homepage content contract

**Files:**
- Create: `frontend/tests/public-home-content.test.mjs`
- Create: `frontend/src/data/publicHomeContent.js`

- [ ] **Step 1: Write the failing content test**

Create a test that imports `getPublicHomeContent(locale)` and asserts:

```js
for (const locale of ['en', 'zh-CN']) {
  const page = getPublicHomeContent(locale);
  assert.equal(page.problemLinks.length, 6);
  assert.equal(page.services.length, 6);
  assert.equal(page.reasons.length, 4);
  assert.equal(page.process.length, 4);
  assert.ok(page.faqs.length >= 7);
  assert.match(page.primaryCta.href, /^https:\/\/ai\.sagemro\.(com|cn)\/service-request\?mode=assist$/);
  assert.match(page.secondaryCta.href, /^https:\/\/ai\.sagemro\.(com|cn)\/service-request\?mode=manual$/);
  assert.doesNotMatch(JSON.stringify(page), /30\s*分钟|24\s*小时|数万|official authorized|官方授权/i);
}
```

Also assert the six Chinese service titles exactly equal:

```js
[
  '设备维修与故障诊断',
  '系统升级与设备改造',
  '拆机、移位与重新安装',
  '设备检测与预防性维护',
  '旧设备评估与处置支持',
  '耗材、备件与更换调试',
]
```

- [ ] **Step 2: Run the test and verify failure**

Run: `cd frontend && node --test tests/public-home-content.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `publicHomeContent.js`.

- [ ] **Step 3: Implement the bilingual content model**

Export `getPublicHomeContent(locale)` and store these stable structures:

```js
const HOSTS = { en: 'https://ai.sagemro.com', 'zh-CN': 'https://ai.sagemro.cn' };

export function getPublicHomeContent(locale = 'en') {
  const normalized = locale === 'zh-CN' ? 'zh-CN' : 'en';
  const page = CONTENT[normalized];
  return {
    ...structuredClone(page),
    primaryCta: { ...page.primaryCta, href: `${HOSTS[normalized]}/service-request?mode=assist` },
    secondaryCta: { ...page.secondaryCta, href: `${HOSTS[normalized]}/service-request?mode=manual` },
  };
}
```

The Chinese hero must lead with equipment outcomes, not AI:

```js
hero: {
  eyebrow: '激光与金属成形设备服务',
  title: '设备出现故障？从问题判断到服务执行，帮你明确下一步。',
  description: '面向激光切割机、折弯机及相关工业设备，提供故障诊断、维修、系统改造、移位安装、维护保养、旧设备评估与备件支持。',
}
```

The AI disclosure belongs in the process section only:

```js
aiBoundary: '系统可以协助整理信息和发现缺失项；实际诊断、报价、派工和安全要求由技术人员确认。'
```

- [ ] **Step 4: Run focused tests**

Run: `cd frontend && node --test tests/public-home-content.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit after user authorizes implementation commits**

```bash
git add frontend/src/data/publicHomeContent.js frontend/tests/public-home-content.test.mjs
git commit -m "feat: define public service homepage content"
```

### Task 2: Render the public homepage and shared site shell

**Files:**
- Create: `frontend/src/components/Home/PublicHomePage.jsx`
- Create: `frontend/src/components/common/PublicSiteShell.jsx`
- Create: `frontend/tests/public-home-page.test.mjs`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Write the failing component contract**

Read the source files in the test and assert that the page renders semantic section headings, regular links, and no modal form:

```js
assert.match(homeSource, /<h1/);
assert.match(homeSource, /content\.services\.map/);
assert.match(homeSource, /content\.reasons\.map/);
assert.match(homeSource, /content\.process\.map/);
assert.match(homeSource, /content\.faqs\.map/);
assert.match(homeSource, /href=\{content\.primaryCta\.href\}/);
assert.doesNotMatch(homeSource, /WorkOrderModal|submitWorkOrder|<form/);
assert.match(shellSource, /href="\/services\/"/);
assert.match(shellSource, /href="\/brands\/"/);
assert.match(shellSource, /href="\/tools\/"/);
assert.match(shellSource, /href="\/insights\/"/);
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/public-home-page.test.mjs`

Expected: FAIL because the new components do not exist.

- [ ] **Step 3: Implement `PublicSiteShell`**

Render the SAGEMRO mark, the four public navigation links, a customer-system link to the market-matching `ai.*` host, `children`, and the existing `Footer`. Use real `<a>` elements so crawlers receive links without JavaScript.

- [ ] **Step 4: Implement `PublicHomePage`**

Render sections in this approved order:

```js
[
  'hero',
  'problemLinks',
  'services',
  'reasons',
  'process',
  'brands',
  'tools',
  'insights',
  'faqs',
  'finalCta',
]
```

Use Lucide line icons and existing SAGEMRO colors. Do not add emoji, stock testimonials, a phone CTA, or WhatsApp CTA. Service cards link to real public service pages; tool and insight cards reuse existing data rather than duplicating copy.

- [ ] **Step 5: Route public `/` to the new page**

In `App.jsx`, make the public-site branch render `PublicHomePage` for `/`. Keep the current customer workspace branch available for the later AI build target; do not delete it in this task.

- [ ] **Step 6: Run focused tests and lint**

Run: `cd frontend && node --test tests/public-home-page.test.mjs tests/public-home-content.test.mjs && npm run lint`

Expected: PASS; ESLint exits 0.

- [ ] **Step 7: Commit after authorization**

```bash
git add frontend/src/App.jsx frontend/src/components/Home/PublicHomePage.jsx frontend/src/components/common/PublicSiteShell.jsx frontend/tests/public-home-page.test.mjs
git commit -m "feat: add outcome-first public homepage"
```

### Task 3: Expand the service page registry without deleting existing routes

**Files:**
- Modify: `frontend/src/data/servicePages.js`
- Modify: `frontend/tests/service-pages.test.mjs`

- [ ] **Step 1: Write failing service registry tests**

Assert both locales contain the four new slugs while retaining the four current slugs:

```js
const expected = [
  'laser-cutting-machine-repair',
  'press-brake-repair',
  'remote-diagnostics',
  'preventive-maintenance',
  'equipment-system-retrofit',
  'machine-relocation-installation',
  'used-equipment-evaluation',
  'spare-parts-consumables',
];
assert.deepEqual(getServicePages(locale).map((page) => page.slug), expected);
```

For `used-equipment-evaluation`, assert the boundary text contains the equivalent of “evaluation is not a purchase commitment” in each locale.

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/service-pages.test.mjs`

Expected: FAIL because the four new pages are absent.

- [ ] **Step 3: Add complete bilingual records**

Each record must define every existing service-page field: `slug`, `status`, `title`, `seoTitle`, `description`, `summary`, `equipment`, `issues`, `process`, `customerInputs`, `remoteBoundary`, `onsiteBoundary`, `primaryCta`, `secondaryCta`, `reviewedBy`, `publishedAt`, `reviewedAt`, and `evidenceNotes`.

Use these Chinese page titles:

```js
[
  '激光与金属成形设备系统升级改造',
  '工业设备拆机、移位、安装与调试',
  '旧激光与金属成形设备评估和处置支持',
  '激光与金属成形设备耗材及备件支持',
]
```

- [ ] **Step 4: Run focused tests**

Run: `cd frontend && node --test tests/service-pages.test.mjs tests/public-seo-routes.test.mjs`

Expected: PASS; the existing four service canonicals remain unchanged.

- [ ] **Step 5: Commit after authorization**

```bash
git add frontend/src/data/servicePages.js frontend/tests/service-pages.test.mjs
git commit -m "feat: expand public equipment service coverage"
```

### Task 4: Add the initial brand service hub and unique brand pages

**Files:**
- Create: `frontend/src/data/brandServicePages.js`
- Create: `frontend/src/components/Brands/BrandServicePages.jsx`
- Create: `frontend/tests/brand-service-pages.test.mjs`

- [ ] **Step 1: Write failing brand registry tests**

Lock the first verified batch and exact stable slugs:

```js
const expectedSlugs = [
  'hans-laser', 'hsg-laser', 'bodor-laser', 'hymson-laser',
  'trumpf', 'bystronic', 'amada', 'yawei',
  'raycus', 'ipg-photonics', 'max-photonics',
  'friendess-bochu', 'beckhoff', 'raytools',
];
```

Assert every brand has:

```js
assert.ok(page.summary.length >= 80);
assert.ok(page.supportScope.length >= 3);
assert.ok(page.commonNeeds.length >= 3);
assert.ok(page.customerInputs.length >= 4);
assert.match(page.independenceNotice, /independent|独立/);
assert.doesNotMatch(JSON.stringify(page), /authorized service center|官方授权服务中心/i);
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/brand-service-pages.test.mjs`

Expected: FAIL because the registry and components do not exist.

- [ ] **Step 3: Implement the registry**

Group entries by `machine`, `laser-source`, `control-system`, and `cutting-head`. Each brand page must describe only independent diagnostic, repair coordination, retrofit, parts matching, or maintenance support. Include trademark-neutral wording and a per-brand CTA preset:

```js
cta: {
  href: `${aiHost}/service-request?mode=manual&brand=${encodeURIComponent(page.slug)}`,
  label: locale === 'zh-CN' ? '提交该品牌设备问题' : 'Submit this brand service request',
}
```

- [ ] **Step 4: Implement hub/detail rendering**

`BrandServicePages` must render `/brands/` as a categorized hub and `/brands/:slug/` as a detail page with support scope, common needs, required information, service boundary, related service links, and the single AI-host request CTA.

- [ ] **Step 5: Run focused tests**

Run: `cd frontend && node --test tests/brand-service-pages.test.mjs`

Expected: PASS with 14 unique brand slugs in each locale.

- [ ] **Step 6: Commit after authorization**

```bash
git add frontend/src/data/brandServicePages.js frontend/src/components/Brands/BrandServicePages.jsx frontend/tests/brand-service-pages.test.mjs
git commit -m "feat: add initial multi-brand service hub"
```

### Task 5: Publish the homepage, services, and brands through the existing SEO manifest

**Files:**
- Modify: `frontend/src/data/publicSeoRoutes.js`
- Modify: `frontend/scripts/publicPageRenderer.mjs`
- Modify: `frontend/scripts/buildPublicPages.mjs`
- Modify: `frontend/tests/public-seo-routes.test.mjs`
- Modify: `frontend/tests/public-build-output.test.mjs`

- [ ] **Step 1: Write failing manifest assertions**

Import `getBrandServicePages(locale)` from `brandServicePages.js`, then assert:

```js
for (const locale of ['en', 'zh-CN']) {
  const routes = getPublicSeoRoutes(locale);
  assert.ok(routes.some((route) => route.path === '/brands'));
  for (const { slug } of getBrandServicePages(locale)) {
    assert.ok(routes.some((route) => route.path === `/brands/${slug}`));
  }
  assert.equal(routes.some((route) => route.path.startsWith('/service-request')), false);
  assert.equal(routes.some((route) => /ai\.sagemro\./.test(route.canonical)), false);
}
```

Also assert the homepage prerender contains regular links to `/services/`, `/brands/`, `/tools/`, and `/insights/`.

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/public-seo-routes.test.mjs tests/public-build-output.test.mjs`

Expected: FAIL because brand routes and homepage links are absent.

- [ ] **Step 3: Extend the manifest and schema**

Add brand hub/detail routes. Use `CollectionPage` for `/brands/`, `Service` for brand details, and retain one `Organization` graph node per route. Add FAQs to homepage body/schema only when the visible React page shows the same text.

- [ ] **Step 4: Render semantic internal links**

Extend `renderBody()` to output `body.links`, homepage resource groups, and CTA links as escaped anchors. Never render a sensitive free-text draft into HTML or a URL.

- [ ] **Step 5: Add brands to crawl artifacts**

Add `${host}/brands/` to `llms.txt`. `sitemap.xml` must include only public main-domain routes. AI-host URLs remain excluded.

- [ ] **Step 6: Run build-output tests**

Run: `cd frontend && npm run build && node --test tests/public-seo-routes.test.mjs tests/public-build-output.test.mjs tests/seo-contract.test.mjs`

Expected: PASS; generated brand pages contain crawlable H1/body/schema and main-domain canonicals.

- [ ] **Step 7: Commit after authorization**

```bash
git add frontend/src/data/publicSeoRoutes.js frontend/scripts/publicPageRenderer.mjs frontend/scripts/buildPublicPages.mjs frontend/tests/public-seo-routes.test.mjs frontend/tests/public-build-output.test.mjs
git commit -m "feat: publish service and brand SEO routes"
```

### Task 6: Unify public navigation without moving tools or insights

**Files:**
- Modify: `frontend/src/components/Services/ServicePages.jsx`
- Modify: `frontend/src/components/Insights/InsightsPage.jsx`
- Modify: `frontend/src/components/Tools/IndustryToolsPage.jsx`
- Modify: `frontend/src/components/About/TechnicalReviewPage.jsx`
- Modify: `frontend/tests/public-navigation-contract.test.mjs`

- [ ] **Step 1: Write the failing navigation contract**

Assert all four public shells expose `/services/`, `/brands/`, `/tools/`, `/insights/`, and a market-matching `ai.*` customer-system link. Assert no component imports `WorkOrderModal` or implements another form.

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/public-navigation-contract.test.mjs`

Expected: FAIL because public pages currently use inconsistent headers and main-domain AI links.

- [ ] **Step 3: Reuse `PublicSiteShell`**

Replace page-local public headers only. Preserve each page's current content, metadata, calculations, and technical-review copy.

- [ ] **Step 4: Run regression tests**

Run: `cd frontend && node --test tests/public-navigation-contract.test.mjs tests/service-pages.test.mjs tests/diagnostic-guides.test.mjs tests/industry-tools-calculations.test.mjs`

Expected: PASS; existing tools and insights remain on their original paths.

- [ ] **Step 5: Commit after authorization**

```bash
git add frontend/src/components/Services/ServicePages.jsx frontend/src/components/Insights/InsightsPage.jsx frontend/src/components/Tools/IndustryToolsPage.jsx frontend/src/components/About/TechnicalReviewPage.jsx frontend/tests/public-navigation-contract.test.mjs
git commit -m "refactor: unify public site navigation"
```

### Task 7: Full public-site verification

**Files:**
- Verify only.

- [ ] **Step 1: Run the full frontend gate**

Run: `cd frontend && npm run lint && npm test && npm run build`

Expected: exit 0 with no failed tests or build errors.

- [ ] **Step 2: Inspect generated crawl artifacts**

Run:

```bash
cd frontend
node -e "const fs=require('fs'); for (const p of ['dist/index.html','dist/services/index.html','dist/brands/index.html','dist/robots.txt','dist/sitemap.xml']) { if (!fs.existsSync(p)) throw new Error('missing '+p) }"
```

Expected: exit 0. `dist/index.html` contains semantic links to services, brands, tools, and insights; `sitemap.xml` contains no `ai.sagemro.*` URL.

- [ ] **Step 3: Check the diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only files named in this plan plus approved documentation changes are modified.

- [ ] **Step 4: Do not deploy in this plan**

Stop after local verification. Production deployment belongs to `2026-08-31-ai-subdomain-migration-deployment.md` and requires explicit user confirmation.
