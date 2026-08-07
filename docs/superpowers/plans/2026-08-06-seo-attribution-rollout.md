# SEO Attribution and Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify organic and AI-search referrals, measure content/tool/CTA behavior through the existing privacy-limited funnel, expose a bilingual acquisition view in the existing promotion workspace, and release the SEO/GEO foundation safely to both production markets.

**Architecture:** Extend the existing analytics v2 pipeline without a migration: derive source/medium from explicit UTMs or a strict referrer map, add a small allowlisted set of acquisition events/properties, aggregate only counts by source and page in the Worker, and add one Acquisition tab to the existing Promotion Analytics page. Search Console and Baidu remain authoritative search platforms; the internal dashboard measures behavior and conversion after arrival.

**Tech Stack:** React 19 customer frontend, React 18 admin, Cloudflare Workers, existing D1 `funnel_events`, Node.js/SQLite tests, Google Search Console, Baidu Search Resource Platform

## Global Constraints

- Execute after the technical-foundation plan; content events may be added before all editorial pages are published.
- Use the existing `funnel_events` table and analytics v2 session semantics; do not add a migration, cookie tracker, fingerprinting, raw-IP field, third-party analytics SDK, cron, or Search Console credential in code.
- Explicit UTM parameters take precedence over referrer classification; same-site and empty referrers remain direct/unattributed.
- Store only allowlisted identifiers such as page path, content slug, tool ID, CTA type, and coarse engagement bucket; never store diagnostic text, prompts, email, phone, file names, or device serial numbers.
- Organic/AI traffic health alerts require at least 20 sessions; low-volume absence is `insufficient`, not a warning.
- Google Search Console is read-only during analysis. Baidu ownership verification requires the user to be signed in and to approve the exact verification action.
- Worker changes deploy only from `main`; `.cn` frontend/admin changes are ported to `china-edition` and released through Aliyun ECS.

---

## File Map and Boundaries

- Modify `frontend/src/services/funnelAnalytics.js`: pure referrer classification and attribution resolution.
- Modify `frontend/src/services/api.js`: allow new events/properties and use resolved attribution.
- Create `frontend/src/hooks/useAcquisitionTracking.js`: one landing event and one coarse engagement event per route view.
- Modify `frontend/src/App.jsx`: invoke acquisition tracking only on public routes.
- Modify `frontend/src/components/common/PublicConversionPanel.jsx`: track CTA type and context.
- Modify `frontend/src/components/Tools/IndustryToolCalculator.jsx`: emit first-start and valid-completion callbacks.
- Modify `frontend/src/components/Tools/IndustryToolsPage.jsx`: connect tool events.
- Modify `frontend/tests/funnel-analytics.test.mjs`: classifier and persistence tests.
- Create `frontend/tests/acquisition-events.test.mjs`: event wiring and privacy contracts.
- Modify `worker/src/index.js`: allow new event names/properties and expose one admin route.
- Modify `worker/src/lib/promotionAnalytics.js`: page/source acquisition aggregation.
- Modify `worker/tests/analytics-funnel.test.mjs`: allowlist/privacy tests.
- Modify `worker/tests/promotion-analytics.test.mjs`: SQLite acquisition-query and role-scope tests.
- Modify `admin/src/services/api.js`: acquisition client.
- Create `admin/src/components/promotion/OrganicAcquisition.jsx`: summary and page/source table.
- Modify `admin/src/pages/PromotionAnalyticsPage.jsx`: third accessible tab.
- Modify `admin/src/pages/PromotionAnalyticsPage.test.mjs`: bilingual tab/state contracts.
- Create `Marketing/research/seo-keyword-map.md`: prioritized bilingual keyword-to-page map.
- Update `Marketing/skills/seo-playbook.md`: replace obsolete sitemap/robots guidance with the actual implementation and operational checklist.

### Task 1: Classify Organic and AI-Search Referrers Deterministically

**Files:**
- Modify: `frontend/src/services/funnelAnalytics.js`
- Modify: `frontend/tests/funnel-analytics.test.mjs`

**Interfaces:**

```js
classifyReferrer(referrer, siteHostname) -> { source, medium } | null
resolveTrafficAttribution({ search, referrer, siteHostname, stored }) -> Attribution

Attribution = { source, medium, campaign, content, term }
```

- [ ] **Step 1: Write failing table-driven tests**

```js
const cases = [
  ['https://www.google.com/search?q=press+brake', 'google_organic', 'organic'],
  ['https://www.baidu.com/s?wd=激光切割机维修', 'baidu_organic', 'organic'],
  ['https://www.bing.com/search?q=fiber+laser+repair', 'bing_organic', 'organic'],
  ['https://chatgpt.com/', 'chatgpt_referral', 'ai_referral'],
  ['https://chat.openai.com/', 'chatgpt_referral', 'ai_referral'],
  ['https://www.perplexity.ai/search/x', 'perplexity_referral', 'ai_referral'],
  ['https://copilot.microsoft.com/', 'copilot_referral', 'ai_referral'],
];
for (const [referrer, source, medium] of cases) {
  assert.deepEqual(classifyReferrer(referrer, 'sagemro.com'), { source, medium });
}
assert.equal(classifyReferrer('https://sagemro.com/tools', 'sagemro.com'), null);
assert.equal(classifyReferrer('', 'sagemro.com'), null);
```

Also prove that `utm_source=newsletter` wins over Google referrer and that a stored non-direct attribution is reused only when there is neither UTM nor a newly classified external referrer.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/funnel-analytics.test.mjs`
Expected: FAIL because classifier exports are missing.

- [ ] **Step 3: Implement strict URL parsing**

Use `new URL(referrer)` inside `try/catch`, lowercase hostname, strip leading `www.`, and compare only hostname—not substring matches in the full URL. Use this fixed map:

```js
const REFERRER_RULES = [
  [/^(?:[^.]+\.)?google\.[a-z.]+$/, 'google_organic', 'organic'],
  [/^(?:[^.]+\.)?baidu\.com$/, 'baidu_organic', 'organic'],
  [/^(?:[^.]+\.)?bing\.com$/, 'bing_organic', 'organic'],
  [/^(?:chatgpt\.com|chat\.openai\.com)$/, 'chatgpt_referral', 'ai_referral'],
  [/^(?:[^.]+\.)?perplexity\.ai$/, 'perplexity_referral', 'ai_referral'],
  [/^copilot\.microsoft\.com$/, 'copilot_referral', 'ai_referral'],
];
```

Reject `google.example.com`, `baidu.com.example.org`, malformed URLs, the current hostname, and sibling SAGEMRO hosts as internal.

- [ ] **Step 4: Verify and commit**

Run: `cd frontend && node --test tests/funnel-analytics.test.mjs`
Expected: PASS for all mappings and precedence cases.

```bash
git add frontend/src/services/funnelAnalytics.js frontend/tests/funnel-analytics.test.mjs
git commit -m "feat(analytics): classify organic and AI referrals"
```

### Task 2: Extend the Privacy-Limited Event Contract

**Files:**
- Modify: `frontend/src/services/api.js`
- Modify: `worker/src/index.js`
- Modify: `frontend/tests/acquisition-events.test.mjs`
- Modify: `worker/tests/analytics-funnel.test.mjs`

**Interfaces:**

```text
Events: seo_landing_viewed, content_engaged, tool_started,
        tool_completed, conversion_cta_clicked

Properties: content_type, content_slug, cta_type,
            engagement_bucket, result_state
```

- [ ] **Step 1: Write failing frontend and Worker allowlist tests**

Send one allowed event with all approved properties plus `prompt`, `email`, `phone`, and `serial_number`. Assert approved properties survive and sensitive/arbitrary fields are absent in the Worker row.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
cd frontend && node --test tests/acquisition-events.test.mjs
cd ../worker && node --test tests/analytics-funnel.test.mjs
```

Expected: FAIL because the new events/properties are rejected.

- [ ] **Step 3: Add identical client and Worker allowlists**

Add the five event names to both event sets. Add the five property names to both property allowlists. Add enum validation in the Worker:

```js
engagement_bucket: new Set(['30s']),
result_state: new Set(['valid']),
cta_type: new Set(['ai_diagnosis', 'service_request', 'engineer_review']),
```

Keep `content_type` limited to `service`, `diagnostic_guide`, `insight`, and `tool`; clean `content_slug` to 120 characters.

- [ ] **Step 4: Use resolved attribution in `trackFunnelEvent`**

Replace UTM-only `currentAttribution` logic with `resolveTrafficAttribution`, persist only non-direct attribution, and keep existing storage-failure behavior and credential-free guest analytics fallback.

- [ ] **Step 5: Run tests and commit**

Run the focused frontend/Worker tests above.
Expected: PASS; sensitive fields remain absent and existing analytics v2 tests remain green.

```bash
git add frontend/src/services/api.js worker/src/index.js frontend/tests/acquisition-events.test.mjs worker/tests/analytics-funnel.test.mjs
git commit -m "feat(analytics): add acquisition event contract"
```

### Task 3: Instrument Public Landing, Engagement, Tools, and CTAs

**Files:**
- Create: `frontend/src/hooks/useAcquisitionTracking.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/common/PublicConversionPanel.jsx`
- Modify: `frontend/src/components/Tools/IndustryToolCalculator.jsx`
- Modify: `frontend/src/components/Tools/IndustryToolsPage.jsx`
- Modify: `frontend/tests/acquisition-events.test.mjs`

**Interfaces:**

```js
useAcquisitionTracking({ path, contentType, contentSlug, indexable })
onToolStarted(toolId)
onToolCompleted(toolId)
onConversionClick({ contentType, contentSlug, ctaType })
```

- [ ] **Step 1: Write failing wiring contracts**

Require one `seo_landing_viewed` event on mount for an indexable public route, one `content_engaged` event after 30 visible seconds, no engagement event after unmount, one tool start on first input interaction, one tool completion on the first valid result, and one CTA event before the existing callback runs.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/acquisition-events.test.mjs`
Expected: FAIL because the hook and callbacks are absent.

- [ ] **Step 3: Implement coarse engagement without scroll surveillance**

```js
useEffect(() => {
  if (!indexable) return undefined;
  trackFunnelEvent('seo_landing_viewed', { content_type: contentType, content_slug: contentSlug });
  let remaining = 30_000;
  let visibleSince = null;
  let timer = null;
  let sent = false;
  const fire = () => {
    if (sent) return;
    sent = true;
    trackFunnelEvent('content_engaged', {
      content_type: contentType,
      content_slug: contentSlug,
      engagement_bucket: '30s',
    });
  };
  const pause = () => {
    if (visibleSince !== null) remaining = Math.max(0, remaining - (Date.now() - visibleSince));
    visibleSince = null;
    window.clearTimeout(timer);
    timer = null;
  };
  const arm = () => {
    if (sent || timer !== null) return;
    if (remaining === 0) { fire(); return; }
    visibleSince = Date.now();
    timer = window.setTimeout(fire, remaining);
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') arm();
    else pause();
  };
  onVisibility();
  document.addEventListener('visibilitychange', onVisibility);
  return () => { pause(); document.removeEventListener('visibilitychange', onVisibility); };
}, [contentSlug, contentType, indexable]);
```

Never collect scroll position, selected text, or prompt content.

- [ ] **Step 4: Instrument tools and CTAs exactly once per mounted page**

Use component refs to suppress repeated `tool_started` and `tool_completed` events. A completion requires the calculator's existing valid result state; input focus alone is not completion. `PublicConversionPanel` records CTA context, then invokes the existing diagnosis/service callback.

- [ ] **Step 5: Verify, lint, and commit**

Run: `cd frontend && node --test tests/acquisition-events.test.mjs && npm run lint`
Expected: PASS without duplicate events.

```bash
git add frontend/src/hooks/useAcquisitionTracking.js frontend/src/App.jsx frontend/src/components/common/PublicConversionPanel.jsx frontend/src/components/Tools/IndustryToolCalculator.jsx frontend/src/components/Tools/IndustryToolsPage.jsx frontend/tests/acquisition-events.test.mjs
git commit -m "feat(analytics): track public acquisition behavior"
```

### Task 4: Aggregate Acquisition Counts by Page and Source

**Files:**
- Modify: `worker/src/lib/promotionAnalytics.js`
- Modify: `worker/src/index.js`
- Modify: `worker/tests/promotion-analytics.test.mjs`

**Interfaces:**

```js
loadOrganicAcquisition(databases, filters) -> {
  summary, pages, sources, dataQuality, reportingTimezone
}
GET /api/admin/analytics/organic-acquisition
```

- [ ] **Step 1: Write failing SQLite aggregation tests**

Seed Google, Baidu, ChatGPT, direct, duplicate-session, engaged, tool, CTA, AI, and service-request events. Assert:

```js
assert.equal(result.summary.landingSessions, 4);
assert.equal(result.summary.engagedSessions, 2);
assert.equal(result.summary.toolCompletions, 1);
assert.equal(result.summary.ctaClicks, 2);
assert.equal(result.pages[0].pagePath, '/services/laser-cutting-machine-repair');
assert.equal(result.sources.some((row) => row.source === 'chatgpt_referral'), true);
```

Assert that staff market scope still limits COM/CN data and that API output contains no anonymous/session/user identifiers or raw properties.

- [ ] **Step 2: Run and verify RED**

Run: `cd worker && node --test tests/promotion-analytics.test.mjs`
Expected: FAIL because acquisition aggregation is missing.

- [ ] **Step 3: Implement aggregate-only SQL**

Reuse `parsePromotionFilters` and the fixed Asia/Shanghai window. Group by `page_path` and by `source, medium`; count distinct session IDs for landing/engagement and count approved events for tools/CTAs/service requests. Cap each table at 100 rows and return an `other` aggregate for the remainder rather than dropping totals.

- [ ] **Step 4: Add the operations/admin read route**

Use the same role and market-scope guard as current promotion overview/channels endpoints. Set `Cache-Control: no-store`. Do not return raw event rows.

- [ ] **Step 5: Verify and commit**

Run: `cd worker && node --test tests/promotion-analytics.test.mjs tests/analytics-funnel.test.mjs`
Expected: PASS for both markets, privacy, and permission checks.

```bash
git add worker/src/lib/promotionAnalytics.js worker/src/index.js worker/tests/promotion-analytics.test.mjs
git commit -m "feat(analytics): aggregate organic acquisition"
```

### Task 5: Add a Bilingual Acquisition Tab to Promotion Analytics

**Files:**
- Modify: `admin/src/services/api.js`
- Create: `admin/src/components/promotion/OrganicAcquisition.jsx`
- Modify: `admin/src/pages/PromotionAnalyticsPage.jsx`
- Modify: `admin/src/pages/PromotionAnalyticsPage.test.mjs`

**Interfaces:**

```js
getOrganicAcquisition(filters, signal) -> Promise<OrganicAcquisitionResponse>
<OrganicAcquisition data isCn onSelectSource />
```

- [ ] **Step 1: Write failing page contracts**

Require an accessible third tab with English `Acquisition` and Chinese `自然搜索与 AI 引荐`, abortable loading, loading/error/retry/empty states, summary metrics, source table, page table, data-quality note, and no raw visitor identity.

- [ ] **Step 2: Run and verify RED**

Run: `cd admin && node --test src/pages/PromotionAnalyticsPage.test.mjs`
Expected: FAIL because the tab/client/component is absent.

- [ ] **Step 3: Add the API client and tab state**

Use the existing promotion filter serialization and `AbortController` pattern. Fetch only while the tab is active. Keep overview and channel behavior unchanged.

- [ ] **Step 4: Render decision-oriented metrics**

Summary: landing sessions, engaged sessions, tool completions, conversion CTA clicks, and service requests. Source table: source/medium, sessions, engagement rate, tool completions, CTA clicks, service requests. Page table: path, content type, sessions, engaged sessions, CTA clicks, service requests. Display `Insufficient data` below 20 sessions and do not color it as a warning.

- [ ] **Step 5: Verify, build, and commit**

Run:

```bash
cd admin
npm test
npm run build
```

Expected: all existing promotion tests and new acquisition tests pass.

```bash
git add admin/src/services/api.js admin/src/components/promotion/OrganicAcquisition.jsx admin/src/pages/PromotionAnalyticsPage.jsx admin/src/pages/PromotionAnalyticsPage.test.mjs
git commit -m "feat(admin): add organic acquisition view"
```

### Task 6: Record the Keyword Map and Replace the Obsolete SEO Runbook

**Files:**
- Create: `Marketing/research/seo-keyword-map.md`
- Modify: `Marketing/skills/seo-playbook.md`

- [ ] **Step 1: Write the bilingual keyword-to-page map**

For every approved service page, diagnostic topic, and indexable tool record: primary query, supporting queries, intent, target URL, CTA, evidence owner, publication status, and the weighted score `business 40 + evidence 25 + authority 20 + competition 15`. State that no external volume was invented and that Search Console currently has only 11 impressions in the audited 28-day window.

- [ ] **Step 2: Replace obsolete technical statements**

Remove claims that sitemap/robots are missing and remove the obsolete `react-snap` recommendation. Document the actual manifest, post-build generator, static route output, schema, real 404 routing, Search Console process, Baidu process, and analytics source names.

- [ ] **Step 3: Add the weekly review decision rule**

Only promote a new topic when it has service relevance, evidence ownership, a distinct intent, and a target CTA. Merge synonyms rather than creating duplicate pages. Move unsafe or unsourced records back to draft/noindex.

- [ ] **Step 4: Verify links and commit**

Run: `rg -n "react-snap|no sitemap|robots.*missing" Marketing/skills/seo-playbook.md Marketing/research/seo-keyword-map.md`
Expected: no obsolete statements or placeholders.

```bash
git add Marketing/research/seo-keyword-map.md Marketing/skills/seo-playbook.md
git commit -m "docs(marketing): define SEO keyword operations"
```

### Task 7: Full Gate, Dual-Market Release, and Search Platform Handoff

**Files:**
- Update only if verification exposes a defect: files from Tasks 1–6
- Do not commit credentials or verification secrets

- [ ] **Step 1: Run the full main-branch CI gate**

Run Worker tests, frontend lint/tests/build, admin tests/build, and E2E exactly as `.github/workflows/deploy.yml`.
Expected: all pass and no migration file is introduced.

- [ ] **Step 2: Seed only local/test analytics and verify dashboard semantics**

Use fixture events for every organic/AI source and verify counts, filters, market scope, insufficient-data behavior, and privacy. Do not insert test events into production D1.

- [ ] **Step 3: Deploy main through the normal PR and production gate**

After release, verify `.com` raw HTML, sitemap, robots, 404, canonical, one service page, one guide, one tool, analytics POST 202, and the admin acquisition tab. Worker deploy requires no migration in this plan.

- [ ] **Step 4: Port shared changes to `china-edition`**

Resolve only known locale/branch differences, run full China tests/build, push `china-edition`, then manually trigger the Aliyun ECS workflow. Verify `.cn`, `admin.sagemro.cn`, `engineer.sagemro.cn`, and `api.sagemro.cn/health`.

- [ ] **Step 5: Update Google Search Console**

Submit `https://sagemro.com/sitemap.xml`, inspect one service URL and one guide URL, request indexing only after raw HTML/status/canonical checks pass, and record the date as the 30-day comparison baseline.

- [ ] **Step 6: Configure Baidu with user participation**

Ask the user to sign in to Baidu Search Resource Platform. Present the exact verification method offered by Baidu; add only the provided verification file or meta token after approval. Submit `https://sagemro.cn/sitemap.xml` and record the same baseline fields. Never guess or reuse a Google token.

- [ ] **Step 7: Establish 30/60/90-day reviews**

- Day 30: indexed pages, soft 404s, crawl errors, non-brand impressions, Baidu discovery.
- Day 60: query/page growth, ranking direction, organic/AI landing sessions, engagement, tool completion, CTA clicks.
- Day 90: qualified diagnosis/service requests, content-to-inquiry paths, topics to expand, merge, update, or return to draft.
