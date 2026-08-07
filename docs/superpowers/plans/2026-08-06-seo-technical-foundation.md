# SEO Technical Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every indexable SAGEMRO customer-facing route return complete, localized HTML with correct metadata, schema, sitemap membership, canonical routing, and a real 404 response before client JavaScript runs.

**Architecture:** Keep the React SPA for interaction, but add a build-time public-route manifest and a dependency-free post-build generator that writes one static `index.html` per public route. The generator derives locale from the built root document, writes sitemap/robots/redirect artifacts from the same manifest, and leaves private application routes on the SPA entry. Cloudflare and Aliyun nginx receive separate, tested routing rules.

**Tech Stack:** React 19, Vite 8, Node.js 24 built-ins, Cloudflare Pages static routing, nginx on Aliyun ECS, Node.js built-in test runner

## Global Constraints

- Start implementation from a fresh worktree based on `origin/main`; do not implement on `codex/computer-handoff-2026-07-31` and do not merge its retired 3D bend experiment.
- Port shared frontend commits to a separate worktree based on `origin/china-edition`; `.cn` production still requires the Aliyun ECS workflow.
- Do not add a runtime SSR server, headless-browser build dependency, analytics vendor, D1 migration, or new Worker route in this plan.
- Keep the paused bend simulator out of generated pages and sitemap by using `publicIndustryTools`.
- Keep private/login routes out of sitemap and give their static shell `noindex,nofollow,noarchive`.
- Before editing `.github/workflows/deploy.yml` or `.github/workflows/aliyun-cn-deploy.yml`, pause and obtain the repository-required explicit confirmation.
- All generated English and Simplified Chinese output must come from the same interfaces and pass the same tests.

---

## File Map and Boundaries

- Create `frontend/src/data/publicSeoRoutes.js`: pure public-route manifest and localized metadata.
- Modify `frontend/src/data/industryTools.js`: add per-record `updatedAt` dates used by sitemap generation.
- Modify `frontend/src/data/insights.js`: add per-record `publishedAt` and `updatedAt` dates used by article schema and sitemap generation.
- Create `frontend/scripts/publicPageRenderer.mjs`: HTML escaping, head rendering, schema rendering, static body rendering, sitemap, robots, and redirects.
- Create `frontend/scripts/buildPublicPages.mjs`: post-build filesystem orchestration only.
- Create `frontend/tests/public-seo-routes.test.mjs`: manifest, schema, sitemap, route, and omission contracts.
- Create `frontend/tests/public-build-output.test.mjs`: temporary-dist integration test for generated HTML and 404 behavior.
- Modify `frontend/package.json`: run the post-build generator after Vite.
- Modify `frontend/src/main.jsx`: remove the build-time fallback immediately before React mounts.
- Modify `frontend/src/utils/seo.js`: keep client navigation metadata equivalent to generated metadata.
- Modify `frontend/tests/seo-contract.test.mjs`: assert new output and noindex boundaries.
- Modify `frontend/public/_redirects`: remove broad `/tools/*` and `/insights/*` SPA rewrites after static routes exist.
- Modify `frontend/public/robots.txt`: explicit search-crawler policy and sitemap pointer.
- Create `frontend/public/llms.txt`: short, non-promotional route guide.
- Create `ops/configure_public_routes.py`: narrowly patch nginx public/private fallback rules with refusal on unknown configuration.
- Create `frontend/tests/nginx-public-routes.test.mjs`: fixture tests for the nginx transformer.
- Modify `.github/workflows/aliyun-cn-deploy.yml`: run the tested nginx transformer and preserve the existing backup/rollback sequence.

### Task 1: Define One Localized Public-Route Manifest

**Files:**
- Create: `frontend/src/data/publicSeoRoutes.js`
- Create: `frontend/tests/public-seo-routes.test.mjs`

**Interfaces:**

```js
getPublicSeoRoutes(locale) -> Array<PublicSeoRoute>
getPublicSeoRoute(pathname, locale) -> PublicSeoRoute | null

PublicSeoRoute = {
  path, type, title, description, canonical, alternates,
  modified, robots, body, structuredData
}
```

- [ ] **Step 1: Write the failing manifest contract**

```js
test('manifest lists only indexable customer routes in both locales', () => {
  for (const locale of ['en', 'zh-CN']) {
    const routes = getPublicSeoRoutes(locale);
    assert.equal(routes.some((route) => route.path === '/tools/bend-simulator'), false);
    assert.equal(routes.some((route) => route.path === '/engineer'), false);
    assert.equal(new Set(routes.map((route) => route.path)).size, routes.length);
    assert.equal(routes.every((route) => route.robots === 'index,follow'), true);
    assert.equal(routes.every((route) => /^https:\/\/sagemro\.(com|cn)/.test(route.canonical)), true);
    assert.equal(routes.every((route) => route.alternates.en && route.alternates['zh-CN']), true);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd frontend && node --test tests/public-seo-routes.test.mjs`
Expected: FAIL because `publicSeoRoutes.js` does not exist.

- [ ] **Step 3: Implement the pure manifest**

Use `publicIndustryTools`, `getLocalizedTool`, `getLocalizedInsights`, and the exact canonical helpers below:

```js
const HOSTS = { en: 'https://sagemro.com', 'zh-CN': 'https://sagemro.cn' };

function alternates(path) {
  return {
    en: `${HOSTS.en}${path === '/' ? '/' : path}`,
    'zh-CN': `${HOSTS['zh-CN']}${path === '/' ? '/' : path}`,
    'x-default': `${HOSTS.en}${path === '/' ? '/' : path}`,
  };
}

function route(locale, value) {
  return {
    robots: 'index,follow',
    ...value,
    canonical: `${HOSTS[locale]}${value.path === '/' ? '/' : value.path}`,
    alternates: alternates(value.path),
  };
}
```

The manifest must contain `/`, `/tools`, each of the nine `publicIndustryTools`, `/insights`, and each localized insight. `body` must contain the visible H1, introductory paragraphs, lists, guide text, FAQ, or article sections already present in the corresponding data object. Add `updatedAt: '2026-08-06'` to the current public tool records and `publishedAt` plus `updatedAt: '2026-08-06'` to the current insight records; route `modified` must come from these fields. Homepage and hub routes use the actual release date of the static-page change. Future content updates must change their record date; the generator must not stamp every page with build time. Do not add engineer-host URLs to the customer sitemap; engineer recruitment indexing is a separate host-specific project.

- [ ] **Step 4: Verify GREEN and commit**

Run: `cd frontend && node --test tests/public-seo-routes.test.mjs`
Expected: PASS for both locales and no paused/private route.

```bash
git add frontend/src/data/publicSeoRoutes.js frontend/src/data/industryTools.js frontend/src/data/insights.js frontend/tests/public-seo-routes.test.mjs
git commit -m "feat(seo): define public route manifest"
```

### Task 2: Render Complete Static HTML Without Browser Dependencies

**Files:**
- Create: `frontend/scripts/publicPageRenderer.mjs`
- Modify: `frontend/tests/public-seo-routes.test.mjs`

**Interfaces:**

```js
escapeHtml(value) -> string
renderPublicDocument(template, route, locale) -> complete HTML string
renderSitemap(routes) -> XML string
renderRedirects(routes) -> Cloudflare _redirects string
renderRobots(locale) -> robots.txt string
```

- [ ] **Step 1: Add failing renderer tests**

```js
test('rendered tool HTML contains crawlable content and safe JSON-LD', () => {
  const route = getPublicSeoRoute('/tools/press-brake-tonnage-calculator', 'en');
  const html = renderPublicDocument(TEMPLATE, route, 'en');
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>Press Brake Tonnage Calculator \| SAGEMRO<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/sagemro\.com\/tools\/press-brake-tonnage-calculator"/);
  assert.match(html, /hreflang="zh-CN"/);
  assert.match(html, /<h1>Press Brake Tonnage Calculator<\/h1>/);
  assert.match(html, /application\/ld\+json/);
  assert.doesNotMatch(html, /<script[^>]*>.*<\/script><\/script>/s);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/public-seo-routes.test.mjs`
Expected: FAIL because renderer exports are missing.

- [ ] **Step 3: Implement escaping and deterministic head replacement**

Use this escaping boundary for all text and attributes:

```js
export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
```

`renderPublicDocument` must replace the template title/description/robots/lang, add canonical plus `en`, `zh-CN`, and `x-default` alternates, add Open Graph and Twitter summary tags, add one JSON-LD script, and replace `<div id="root"></div>` with:

```html
<div id="root" data-prerendered="true">
  <main class="seo-static-shell">
    <a href="/">SAGEMRO</a>
    <h1>Localized visible heading</h1>
    <p>Localized visible introduction</p>
    <section>Localized route body</section>
  </main>
</div>
```

Do not hide the shell with CSS; React removes it when interaction starts.

- [ ] **Step 4: Implement schema per page type**

Render:

```js
const commonPublisher = {
  '@type': 'Organization',
  name: 'SAGEMRO',
  url: route.alternates[locale],
  logo: `${HOSTS[locale]}/sagemro-logo.png`,
};
```

- Homepage: `Organization` plus `WebSite` in an `@graph`.
- Tool: `WebApplication` with `applicationCategory: 'BusinessApplication'`, `operatingSystem: 'Web'`, `offers.price: '0'`, and `offers.priceCurrency: locale === 'zh-CN' ? 'CNY' : 'USD'`.
- Insight: `Article` with headline, description, author, publisher, datePublished, dateModified, image, and mainEntityOfPage.
- Hub: `CollectionPage` with an `ItemList` of child canonical URLs.
- Every non-home route: add `BreadcrumbList` in the same `@graph`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `cd frontend && node --test tests/public-seo-routes.test.mjs`
Expected: PASS, including escaping of `<`, `&`, quotes, and JSON script boundaries.

```bash
git add frontend/scripts/publicPageRenderer.mjs frontend/tests/public-seo-routes.test.mjs
git commit -m "feat(seo): render crawlable public documents"
```

### Task 3: Generate Route Files, Sitemap, Robots, Redirects, and llms.txt at Build Time

**Files:**
- Create: `frontend/scripts/buildPublicPages.mjs`
- Create: `frontend/tests/public-build-output.test.mjs`
- Modify: `frontend/package.json`
- Modify: `frontend/public/_redirects`
- Modify: `frontend/public/robots.txt`
- Create: `frontend/public/llms.txt`

**Interfaces:**

```js
buildPublicPages({ distDir }) -> Promise<{ locale, routeCount }>
```

- [ ] **Step 1: Write a failing temporary-dist integration test**

Create a temporary directory with the real `frontend/index.html` copied as `index.html`, call `buildPublicPages`, and assert:

```js
assert.match(await read('tools/press-brake-tonnage-calculator/index.html'), /<h1>Press Brake Tonnage Calculator<\/h1>/);
assert.match(await read('insights/press-brake-tonnage-risk-check/index.html'), /Article/);
assert.match(await read('sitemap.xml'), /<lastmod>2026-08-06<\/lastmod>/);
assert.doesNotMatch(await read('sitemap.xml'), /bend-simulator/);
assert.match(await read('_redirects'), /\/work-orders\/\* \/index\.html 200/);
assert.doesNotMatch(await read('_redirects'), /\/tools\/\*/);
```

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/public-build-output.test.mjs`
Expected: FAIL because `buildPublicPages.mjs` does not exist.

- [ ] **Step 3: Implement deterministic output**

`buildPublicPages` must:

1. Read `dist/index.html`.
2. Detect locale from `<html lang="zh-CN">`; otherwise use `en`.
3. Render each manifest route to `dist/<route>/index.html`, with `/` replacing `dist/index.html`.
4. Write `dist/sitemap.xml`, `dist/robots.txt`, `dist/_redirects`, and `dist/llms.txt`.
5. Refuse duplicate paths or paths containing `..`, query strings, hashes, or a trailing slash other than `/`.

The generated Cloudflare redirects must begin with the locale-appropriate www canonicalization and one trailing-slash redirect per public route, then preserve private SPA routes and finish with the real 404. For the English build the shape is:

```text
https://www.sagemro.com/* https://sagemro.com/:splat 301
/tools/ /tools 301
/insights/ /insights 301
/<each-public-detail>/ /<each-public-detail> 301
/activate /index.html 200
/engineer /index.html 200
/work-orders/* /index.html 200
/* /404.html 404
```

The Chinese auxiliary Pages build uses `www.sagemro.cn` → `sagemro.cn`. Never generate a redirect for `/` itself.

The generated robots body must explicitly allow `Googlebot`, `Bingbot`, `Baiduspider`, and `OAI-SearchBot`; disallow `/api/`, `/admin/`, `/engineer/`, `/work-orders/`, and `/activate`; and point to the locale sitemap. Keep training controls (`GPTBot`, `Google-Extended`, and other training-only agents) separate from search access. After deployment, inspect the final `.com` response because Cloudflare managed robots may prepend account-level directives.

The generated `llms.txt` must identify SAGEMRO, state that tool results are planning references, list the four current hub URLs, and include the support email. It must not claim rankings, certifications, service coverage, or success rates.

- [ ] **Step 4: Wire the post-build command**

Change the package script to:

```json
"build": "vite build && node scripts/buildPublicPages.mjs"
```

- [ ] **Step 5: Run integration test and full build**

Run:

```bash
cd frontend
node --test tests/public-build-output.test.mjs
npm run build
test -f dist/tools/press-brake-tonnage-calculator/index.html
test -f dist/insights/press-brake-tonnage-risk-check/index.html
```

Expected: tests pass and generated files exist with non-empty HTML.

- [ ] **Step 6: Commit build generation**

```bash
git add frontend/scripts/buildPublicPages.mjs frontend/tests/public-build-output.test.mjs frontend/package.json frontend/public/_redirects frontend/public/robots.txt frontend/public/llms.txt
git commit -m "build(seo): generate public pages and crawl files"
```

### Task 4: Keep Client Navigation Metadata in Parity

**Files:**
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/utils/seo.js`
- Modify: `frontend/tests/seo-contract.test.mjs`

**Interfaces:**

```js
setSeoMetadata({ title, description, canonical, robots, lang, structuredData, alternates, image })
```

- [ ] **Step 1: Write failing client parity tests**

Assert that `seo.js` manages description, robots, canonical, hreflang, Open Graph, Twitter, and schema, and that `main.jsx` removes only a `data-prerendered="true"` fallback before mounting.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/seo-contract.test.mjs`
Expected: FAIL on hreflang/Open Graph/Twitter and prerender removal.

- [ ] **Step 3: Extend the metadata helper**

Add idempotent helpers for `meta[property]` and `link[hreflang]`. When `structuredData` is an array or an `@graph`, serialize it through the existing JSON-LD element. When a field is absent, remove stale route-specific tags instead of leaving metadata from the previous SPA route.

Before `createRoot`, use:

```js
const rootElement = document.getElementById('root');
if (rootElement.dataset.prerendered === 'true') {
  rootElement.replaceChildren();
  delete rootElement.dataset.prerendered;
}
createRoot(rootElement).render(/* existing StrictMode tree */);
```

- [ ] **Step 4: Run tests, lint, and commit**

Run: `cd frontend && node --test tests/seo-contract.test.mjs && npm run lint`
Expected: PASS with no stale-tag or lint failures.

```bash
git add frontend/src/main.jsx frontend/src/utils/seo.js frontend/tests/seo-contract.test.mjs
git commit -m "feat(seo): align runtime metadata with static pages"
```

### Task 5: Enforce Real Public 404s on Aliyun nginx

**Files:**
- Create: `ops/configure_public_routes.py`
- Create: `frontend/tests/nginx-public-routes.test.mjs`
- Modify: `.github/workflows/aliyun-cn-deploy.yml`

**Interfaces:**

```text
python3 ops/configure_public_routes.py <nginx-config> <additional-nginx-configs>
exit 0 only when every matched customer/engineer server is safely transformed
```

- [ ] **Step 1: Obtain explicit workflow-edit confirmation**

State that this task changes `.github/workflows/aliyun-cn-deploy.yml` and nginx routing, with the purpose of replacing soft 404s while retaining `/activate`, `/engineer`, and `/work-orders/*` SPA deep links. Do not edit until confirmed.

- [ ] **Step 2: Write failing fixture tests**

Cover:

```nginx
location / { try_files $uri /index.html; }
```

Expected transformed behavior:

```nginx
location = /activate { try_files /index.html =404; }
location = /engineer { try_files /index.html =404; }
location ~ ^/work-orders/[^/]+$ { try_files /index.html =404; }
location ~ ^(.+)/$ { return 301 https://$host$1; }
location / { try_files $uri $uri/ /404.html =404; }
```

For the customer server, also add an exact `www.sagemro.cn` canonical redirect to `https://sagemro.cn$request_uri`. Exclude the root `/` from the trailing-slash matcher and preserve `engineer.sagemro.cn` as its own host.

Also assert idempotency and refusal when no recognized `location /` block exists.

- [ ] **Step 3: Implement the narrow transformer**

Use Python standard library only. Create a backup in memory, replace exactly one recognized `location /` block per relevant server, write atomically with `tempfile.NamedTemporaryFile`, and restore the original bytes if any input file fails validation. Never modify admin server routing.

- [ ] **Step 4: Wire after existing nginx backup and before `nginx -t`**

Copy the script into `release/ops`, verify it in the package step, run it on the already discovered `nginx_config_files`, then retain the existing `nginx -t`, reload, health checks, and rollback job.

- [ ] **Step 5: Verify and commit**

Run:

```bash
cd frontend
node --test tests/nginx-public-routes.test.mjs tests/nginx-http2-config.test.mjs tests/routing-and-layout-contract.test.mjs
```

Expected: all routing, HTTP/2, workflow backup, and rollback contracts pass.

```bash
git add ops/configure_public_routes.py frontend/tests/nginx-public-routes.test.mjs .github/workflows/aliyun-cn-deploy.yml
git commit -m "fix(seo): return real 404s on China routes"
```

### Task 6: Reduce Public-Page Bootstrap Cost

**Files:**
- Modify: `frontend/vite.config.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/public/sagemro-logo.png` or replace references with `frontend/public/sagemro-brand-mark.svg`
- Create: `frontend/tests/public-bundle-contract.test.mjs`

- [ ] **Step 1: Write a failing bundle contract**

After `npm run build`, parse `dist/.vite/manifest.json` and assert that a tool entry does not eagerly import `vendor-markdown`, that no public entry imports bend-simulator code, and that the rendered logo asset is below 80 KB or uses the existing SVG brand mark.

- [ ] **Step 2: Enable the Vite manifest**

Set `build.manifest: true`. Keep existing chunk boundaries, but remove a broad `vendor-misc` grouping if it causes unrelated public dependencies to share one eager chunk. Do not add a bundle-analysis dependency.

- [ ] **Step 3: Preserve lazy public routes**

Keep `IndustryToolsPage` and `InsightsPage` lazy. Ensure the Markdown dependency is imported only by a component that actually renders Markdown; current structured insight data must not eagerly load `react-markdown`.

- [ ] **Step 4: Optimize the logo without changing the visual identity**

Prefer the existing `sagemro-brand-mark.svg` for header/favicon use. If the PNG remains for schema/social preview, generate a visually equivalent optimized file and keep dimensions explicit.

- [ ] **Step 5: Run full frontend checks and commit**

Run:

```bash
cd frontend
npm test
npm run lint
npm run build
node --test tests/public-bundle-contract.test.mjs
```

Expected: all tests pass, every public static HTML file builds, and the bundle contract passes.

```bash
git add frontend/vite.config.js frontend/src/App.jsx frontend/public/sagemro-logo.png frontend/tests/public-bundle-contract.test.mjs
git commit -m "perf(seo): reduce public bootstrap cost"
```

### Task 7: Port, Release, and Verify Both Production Sites

**Files:**
- Modify during port only: the same shared frontend files on `china-edition`
- Update only if evidence changes: `DEPLOY.md`

- [ ] **Step 1: Run the repository test gate on the main-based implementation branch**

Run the same Worker, frontend, admin, and E2E commands used by `.github/workflows/deploy.yml`.
Expected: all pass before a PR is opened.

- [ ] **Step 2: Verify generated HTML locally**

Run `npm run preview` and check with `curl` that one tool, one insight, `/tools/not-real`, and a trailing-slash URL produce the intended body/status/redirect. Verify the same after the China build.

- [ ] **Step 3: Merge and deploy `.com` first**

Use the normal PR/test/environment gate. After deployment verify:

```bash
curl -fsS https://sagemro.com/tools/press-brake-tonnage-calculator | grep -F '<h1>Press Brake Tonnage Calculator</h1>'
curl -fsSI https://sagemro.com/tools/not-real | grep -E '^HTTP/.* 404'
curl -fsS https://sagemro.com/sitemap.xml | grep -F '<lastmod>'
```

- [ ] **Step 4: Port shared commits to `china-edition`**

Resolve only localized branch differences, run the complete China frontend/admin tests, push `china-edition`, then manually trigger `Deploy China Edition to Aliyun ECS`.

- [ ] **Step 5: Verify `.cn`, then submit sitemaps**

Verify static Chinese H1, real 404, canonical, hreflang, sitemap, robots, and health endpoints. Resubmit `https://sagemro.com/sitemap.xml` in Search Console. Configure Baidu only after the user is signed in and explicitly approves the ownership-verification action.
