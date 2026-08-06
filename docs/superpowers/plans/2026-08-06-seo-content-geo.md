# Service Content and GEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a bilingual service-and-diagnostics content system that answers high-intent equipment problems, shows verifiable authorship and review boundaries, and moves qualified visitors into AI diagnosis, engineer review, or a service request.

**Architecture:** Add pure localized data modules for service pages, diagnostic guides, author/reviewer identity, and enhanced tool explanations. Render them through two focused React page components, register only reviewed records in the public SEO manifest created by the technical-foundation plan, and reuse the existing AI chat and service-request flows instead of building a new lead form.

**Tech Stack:** React 19, Vite 8, Tailwind CSS, existing SAGEMRO funnel tracking, JSON-LD generated from the public SEO manifest, Node.js built-in test runner

## Global Constraints

- Execute only after the SEO technical-foundation plan passes on a main-based worktree.
- Ship English and Simplified Chinese content together; translations must use local search language rather than sentence-by-sentence equivalence.
- Do not publish manufacturer fault codes, parameter tables, claimed service coverage, case counts, certifications, success rates, or named customer stories without a primary source or approved internal evidence.
- Every diagnostic page must state electrical/mechanical safety limits and when to stop and escalate.
- The paused bend simulator remains absent from navigation, sitemap, service content, and recommendations.
- The heuristic laser cutting speed and auxiliary-sizing tools remain `noindex` until their datasets are replaced with verified sources; they may remain available as clearly labeled planning references.
- No content record becomes indexable unless `status === 'published'`, `reviewedAt` is present, `reviewedBy` resolves to a real team record, and at least one source or internal evidence note is present.

---

## File Map and Boundaries

- Create `frontend/src/data/technicalAuthors.js`: real SAGEMRO author/reviewer entities and bilingual bios.
- Create `frontend/src/data/servicePages.js`: four bilingual service records plus service hub copy.
- Create `frontend/src/data/diagnosticGuides.js`: reviewed bilingual diagnostic-guide records.
- Create `frontend/src/components/Services/ServicePages.jsx`: service hub and detail rendering.
- Create `frontend/src/components/Insights/DiagnosticGuide.jsx`: answer-first diagnostic layout.
- Create `frontend/src/components/common/PublicConversionPanel.jsx`: shared AI diagnosis / service request CTA.
- Modify `frontend/src/components/Insights/InsightsPage.jsx`: route rich diagnostic records and render author/review information.
- Modify `frontend/src/App.jsx`: register `/services` routes and pass existing diagnosis/service callbacks.
- Modify `frontend/src/data/publicSeoRoutes.js`: include published service and guide records.
- Modify `frontend/src/data/industryTools.js`: add transparent explanation fields and indexability review.
- Modify `frontend/src/components/Tools/IndustryToolsPage.jsx`: render formula, example, assumptions, limits, and engineer review CTA.
- Modify `frontend/src/components/common/AboutModal.jsx` or create `frontend/src/components/About/TechnicalReviewPage.jsx`: public review-policy page.
- Create `frontend/tests/service-pages.test.mjs`: bilingual service content and conversion contracts.
- Create `frontend/tests/diagnostic-guides.test.mjs`: safety, review, evidence, and publication contracts.
- Modify `frontend/tests/industry-tools-calculations.test.mjs`: explanation-to-calculation parity.
- Modify `frontend/tests/public-seo-routes.test.mjs`: manifest inclusion and draft/noindex exclusions.

### Task 1: Define Verifiable Author, Reviewer, and Publication Contracts

**Files:**
- Create: `frontend/src/data/technicalAuthors.js`
- Create: `frontend/tests/diagnostic-guides.test.mjs`

**Interfaces:**

```js
getTechnicalAuthor(id, locale) -> TechnicalAuthor | null

TechnicalAuthor = {
  id, type: 'team', name, role, bio, url
}
```

- [ ] **Step 1: Write a failing identity contract**

```js
test('technical content resolves to a real public team identity', () => {
  for (const locale of ['en', 'zh-CN']) {
    const team = getTechnicalAuthor('sagemro-technical-service-team', locale);
    assert.equal(team.type, 'team');
    assert.match(team.name, /SAGEMRO/);
    assert.ok(team.bio.length >= 80);
    assert.equal(team.url, `${locale === 'zh-CN' ? 'https://sagemro.cn' : 'https://sagemro.com'}/about/technical-review`);
  }
});
```

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/diagnostic-guides.test.mjs`
Expected: FAIL because the author module does not exist.

- [ ] **Step 3: Implement the only approved initial identity**

Use the public name `SAGEMRO Technical Service Team` / `SAGEMRO 技术服务团队`. The bio must say the team organizes industrial equipment service information, checks diagnostic steps and escalation boundaries, and corrects content when evidence changes. It must not claim OEM authorization, years of experience, geographic coverage, or certifications.

- [ ] **Step 4: Verify and commit**

Run: `cd frontend && node --test tests/diagnostic-guides.test.mjs`
Expected: PASS.

```bash
git add frontend/src/data/technicalAuthors.js frontend/tests/diagnostic-guides.test.mjs
git commit -m "feat(geo): define technical review identity"
```

### Task 2: Build the Four Service Records and Service Hub

**Files:**
- Create: `frontend/src/data/servicePages.js`
- Create: `frontend/tests/service-pages.test.mjs`

**Interfaces:**

```js
getServicePages(locale) -> Array<ServicePage>
getServicePage(slug, locale) -> ServicePage | null

ServicePage = {
  slug, status, title, seoTitle, description, summary,
  equipment, issues, process, customerInputs, remoteBoundary,
  onsiteBoundary, primaryCta, secondaryCta, reviewedBy,
  publishedAt, reviewedAt, evidenceNotes
}
```

- [ ] **Step 1: Write the failing service-data contract**

Require exactly these four slugs:

```js
const expected = [
  'laser-cutting-machine-repair',
  'press-brake-repair',
  'remote-diagnostics',
  'preventive-maintenance',
];
assert.deepEqual(getServicePages('en').map((page) => page.slug), expected);
assert.deepEqual(getServicePages('zh-CN').map((page) => page.slug), expected);
```

Also require at least three issues, four process steps, four customer inputs, a remote boundary, an onsite boundary, and no unsupported numbers in every record.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/service-pages.test.mjs`
Expected: FAIL because `servicePages.js` does not exist.

- [ ] **Step 3: Add exact page positioning**

Use these titles and primary intents:

| Slug | English title | Chinese title | Primary intent |
|---|---|---|---|
| `laser-cutting-machine-repair` | Laser Cutting Machine Repair & Diagnostics | 激光切割机维修与故障诊断 | Repair / diagnostics |
| `press-brake-repair` | Press Brake Repair & Accuracy Support | 折弯机维修与精度支持 | Repair / accuracy |
| `remote-diagnostics` | Industrial Equipment Remote Diagnostics | 工业设备远程诊断与工程师支持 | Remote diagnosis |
| `preventive-maintenance` | Preventive Maintenance for Laser and Forming Equipment | 激光与金属成形设备预防性维护 | Maintenance service |

Each record must use this evidence-safe service flow:

```js
process: [
  'Describe the symptom and operating context',
  'Share model, alarm, photos, and recent changes',
  'Review safe checks and decide remote or onsite escalation',
  'Record the agreed next action in the SAGEMRO service workspace',
]
```

The Chinese record must express the same operational steps naturally. `remoteBoundary` must exclude energized electrical work, safety-circuit bypass, hydraulic opening under pressure, and any adjustment requiring OEM-only procedures. `onsiteBoundary` must say availability is confirmed after equipment, location, urgency, and engineer fit are reviewed.

- [ ] **Step 4: Verify and commit**

Run: `cd frontend && node --test tests/service-pages.test.mjs`
Expected: PASS with no duplicate slugs or missing safety boundary.

```bash
git add frontend/src/data/servicePages.js frontend/tests/service-pages.test.mjs
git commit -m "feat(seo): define bilingual service content"
```

### Task 3: Render Service Pages and Connect Existing Conversion Flows

**Files:**
- Create: `frontend/src/components/Services/ServicePages.jsx`
- Create: `frontend/src/components/common/PublicConversionPanel.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/tests/service-pages.test.mjs`

**Interfaces:**

```jsx
<ServicePages pathname locale onStartDiagnosis onOpenServiceRequest onOpenLegal />
<PublicConversionPanel context primaryLabel secondaryLabel onStartDiagnosis onOpenServiceRequest />
```

- [ ] **Step 1: Add failing route and CTA source contracts**

Assert that `App.jsx` lazy-loads `ServicePages`, recognizes `/services` and `/services/`, passes the existing service-request opener, and provides a diagnosis callback that returns to `/` without automatically sending a fabricated message.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/service-pages.test.mjs`
Expected: FAIL because route/component wiring is absent.

- [ ] **Step 3: Implement the hub and detail layout**

Use the existing SAGEMRO public header/footer patterns. Detail order must be: breadcrumb, answer-first H1/summary, equipment and issue scope, four-step process, information checklist, remote/onsite boundary, review identity/date, conversion panel, related guides. Do not add a marketing carousel, popup, testimonial, chat transcript, or new form.

- [ ] **Step 4: Wire explicit CTA semantics**

```js
const handleServiceDiagnosis = useCallback(() => {
  window.history.pushState({}, '', '/');
  setCurrentPath('/');
}, []);

const handleServiceRequest = useCallback(() => {
  setWorkOrderModalOpen(true);
}, []);
```

The primary CTA starts at the existing AI workspace; the secondary CTA opens the existing service-request modal. Track clicks only in the analytics plan, not here.

- [ ] **Step 5: Run tests, lint, and commit**

Run: `cd frontend && node --test tests/service-pages.test.mjs && npm run lint`
Expected: PASS in both locale contracts.

```bash
git add frontend/src/components/Services/ServicePages.jsx frontend/src/components/common/PublicConversionPanel.jsx frontend/src/App.jsx frontend/tests/service-pages.test.mjs
git commit -m "feat(seo): add service acquisition pages"
```

### Task 4: Define the First Reviewed Diagnostic Guide Set

**Files:**
- Create: `frontend/src/data/diagnosticGuides.js`
- Modify: `frontend/tests/diagnostic-guides.test.mjs`

**Interfaces:**

```js
getDiagnosticGuides(locale, { publishedOnly = true }) -> Array<DiagnosticGuide>
getDiagnosticGuide(slug, locale) -> DiagnosticGuide | null

DiagnosticGuide = {
  slug, status, category, title, description, directAnswer,
  safety, symptoms, causes, checks, actions, stopConditions,
  relatedServiceSlug, relatedToolSlug, diagnosisPrompt,
  authorId, reviewedBy, publishedAt, reviewedAt, references,
  internalEvidenceNotes
}
```

- [ ] **Step 1: Write publication-gate tests**

Require published records to have at least two symptoms, three cause/check/action rows, two stop conditions, one reviewer, and either a non-empty `references` array or a non-empty `internalEvidenceNotes` array. Drafts must be omitted by default.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/diagnostic-guides.test.mjs`
Expected: FAIL because diagnostic records do not exist.

- [ ] **Step 3: Add these exact nine topics**

```js
const guideTopics = [
  ['laser-cutting-machine-not-firing', 'Laser cutting machine not firing', '激光切割机不出光'],
  ['fiber-laser-burr-and-dross', 'Fiber laser burr and dross troubleshooting', '激光切割毛刺与挂渣排查'],
  ['laser-chiller-alarm-troubleshooting', 'Laser chiller alarm troubleshooting', '激光冷水机报警排查'],
  ['laser-protective-lens-burning', 'Why a laser protective lens keeps burning', '激光保护镜片频繁烧坏的原因'],
  ['press-brake-angle-inaccuracy', 'Press brake angle inaccuracy troubleshooting', '折弯角度不准怎么排查'],
  ['press-brake-angle-variation', 'Uneven bend angle across the part', '折弯角度左右不一致怎么排查'],
  ['press-brake-low-hydraulic-pressure', 'Press brake low hydraulic pressure checks', '折弯机液压压力不足检查'],
  ['laser-cutting-machine-maintenance-checklist', 'Laser cutting machine maintenance checklist', '激光切割机维护保养检查表'],
  ['press-brake-maintenance-checklist', 'Press brake maintenance checklist', '折弯机维护保养检查表'],
];
```

For every topic, write cause/check/action rows in diagnostic order rather than frequency claims. The direct answer must distinguish observation from diagnosis. Stop conditions must cover exposed energized parts, defeated guards/interlocks, uncontrolled hydraulic/mechanical movement, smoke/fire/overheating, and any OEM-only calibration relevant to the topic.

- [ ] **Step 4: Apply the evidence gate**

Set a record to `published` only after the references are verified as manufacturer, component-maker, standards-body, or approved internal evidence. Store reference title, publisher, URL, and accessed date. Records without verified evidence remain `draft`; tests must prove drafts never enter `getDiagnosticGuides(locale)` or sitemap.

- [ ] **Step 5: Verify and commit**

Run: `cd frontend && node --test tests/diagnostic-guides.test.mjs`
Expected: PASS with nine bilingual records defined and only evidence-complete records published.

```bash
git add frontend/src/data/diagnosticGuides.js frontend/tests/diagnostic-guides.test.mjs
git commit -m "feat(geo): add reviewed diagnostic guide set"
```

### Task 5: Render Answer-First Diagnostic Guides

**Files:**
- Create: `frontend/src/components/Insights/DiagnosticGuide.jsx`
- Modify: `frontend/src/components/Insights/InsightsPage.jsx`
- Modify: `frontend/tests/diagnostic-guides.test.mjs`

- [ ] **Step 1: Add failing rendering contracts**

Assert visible source contains the labels for direct answer, safety, symptoms, cause/check/action, stop/escalate, sources, author, technical review, reviewed date, and related service in both languages.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/diagnostic-guides.test.mjs`
Expected: FAIL because `DiagnosticGuide.jsx` is absent.

- [ ] **Step 3: Implement the page order**

Render exactly:

1. Breadcrumb and category.
2. H1, direct answer, and last-reviewed date.
3. High-visibility safety block.
4. Symptoms checklist.
5. Accessible cause/check/action table with stacked mobile cards.
6. Ordered checks.
7. Stop/escalate conditions.
8. Related service and tool.
9. Author/reviewer identity.
10. Sources and correction link.
11. `PublicConversionPanel`.

Do not add prose before the direct answer and do not collapse safety/source sections by default.

- [ ] **Step 4: Preserve existing short insights**

`InsightsPage` must first check `getDiagnosticGuide(slug, locale)`, then fall back to existing `getLocalizedInsight`. Unknown slugs render `NotFoundPage` with client `noindex` while the static server returns 404.

- [ ] **Step 5: Verify, lint, and commit**

Run: `cd frontend && node --test tests/diagnostic-guides.test.mjs && npm run lint`
Expected: PASS with no inaccessible table or missing safety copy.

```bash
git add frontend/src/components/Insights/DiagnosticGuide.jsx frontend/src/components/Insights/InsightsPage.jsx frontend/tests/diagnostic-guides.test.mjs
git commit -m "feat(geo): render answer-first diagnostics"
```

### Task 6: Make Tool Explanations Transparent and Index Only Defensible Tools

**Files:**
- Modify: `frontend/src/data/industryTools.js`
- Modify: `frontend/src/components/Tools/IndustryToolsPage.jsx`
- Modify: `frontend/src/data/publicSeoRoutes.js`
- Modify: `frontend/tests/industry-tools-calculations.test.mjs`
- Modify: `frontend/tests/public-seo-routes.test.mjs`

**Interfaces:**

```js
ToolSeoEvidence = {
  indexable, formula, assumptions, workedExample, limitations,
  safetyBoundary, reviewPrompt, references
}
```

- [ ] **Step 1: Write failing evidence tests**

Require the metal-weight, laser-cost, press-brake-tonnage, and bend-allowance tools to expose a formula, at least three assumptions, a worked example with units, at least two limitations, and an engineer-review prompt. Require cutting-speed and auxiliary-sizing to have `indexable: false` until verified reference datasets replace their current heuristic formulas.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/industry-tools-calculations.test.mjs tests/public-seo-routes.test.mjs`
Expected: FAIL because evidence fields do not exist.

- [ ] **Step 3: Add formulas that match the implementation**

Use these exact displayed relationships:

```text
Metal weight = cross-section area × length × density × quantity
Laser cutting cost = total machine time × hourly rate + assist-gas cost
Air-bend tonnage = existing estimateAirBendTonnage inputs and material/safety factors
Bend allowance per bend = angle in radians × (inside radius + K-factor × thickness)
```

The worked examples must call the same calculation functions used by the tool and display their returned values; do not hand-calculate separate constants in content.

- [ ] **Step 4: Render evidence sections after the result**

Order: formula, worked example, assumptions, limitations, safety boundary, engineer review CTA, FAQ. Keep the calculator itself above the explanation. Mark non-indexable tools `noindex,nofollow,noarchive` in runtime metadata and omit them from the public manifest/sitemap while keeping direct access available.

- [ ] **Step 5: Verify and commit**

Run:

```bash
cd frontend
node --test tests/industry-tools-calculations.test.mjs tests/public-seo-routes.test.mjs
npm run lint
```

Expected: PASS; displayed formulas match calculator implementations and heuristic tools are omitted from sitemap.

```bash
git add frontend/src/data/industryTools.js frontend/src/components/Tools/IndustryToolsPage.jsx frontend/src/data/publicSeoRoutes.js frontend/tests/industry-tools-calculations.test.mjs frontend/tests/public-seo-routes.test.mjs
git commit -m "feat(seo): add evidence-backed tool explanations"
```

### Task 7: Publish Review Policy, Internal Links, and Complete Schema

**Files:**
- Create: `frontend/src/components/About/TechnicalReviewPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/common/Footer.jsx`
- Modify: `frontend/src/data/publicSeoRoutes.js`
- Modify: `frontend/tests/service-pages.test.mjs`
- Modify: `frontend/tests/public-seo-routes.test.mjs`

- [ ] **Step 1: Write failing public trust contracts**

Require `/about/technical-review` in both manifests; require every published guide to link author/reviewer IDs to that page; require service pages to link at least two relevant guides; require each guide to link one service page.

- [ ] **Step 2: Run and verify RED**

Run: `cd frontend && node --test tests/service-pages.test.mjs tests/public-seo-routes.test.mjs`
Expected: FAIL because the public review route is missing.

- [ ] **Step 3: Implement the review-policy page**

The page must explain who prepares content, how technical checks are performed, what evidence is accepted, how dates and corrections work, which advice requires OEM/qualified-person review, and how to report an error. It must not claim independence from manufacturers, OEM authorization, guaranteed accuracy, or complete equipment coverage.

- [ ] **Step 4: Generate schema from resolved records**

Service pages use `Service` plus breadcrumbs. Guides use `Article` plus breadcrumbs with resolved author/reviewer team and dates. Tool pages use `WebApplication`. Organization identity is emitted once in the graph. All URLs must use locale-appropriate domains.

- [ ] **Step 5: Run the full frontend gate and commit**

Run:

```bash
cd frontend
npm test
npm run lint
npm run build
```

Expected: every published service/guide/tool route has static localized HTML, schema, canonical, alternate links, and internal conversion links.

```bash
git add frontend/src/components/About/TechnicalReviewPage.jsx frontend/src/App.jsx frontend/src/components/common/Footer.jsx frontend/src/data/publicSeoRoutes.js frontend/tests/service-pages.test.mjs frontend/tests/public-seo-routes.test.mjs
git commit -m "feat(geo): publish technical review framework"
```

### Task 8: Editorial and Browser Acceptance Gate

**Files:**
- Update only when review finds defects: the content/data/component files above

- [ ] **Step 1: Run bilingual editorial review**

For each published page, verify direct answer, safety, terminology, units, source scope, manufacturer neutrality, CTA relevance, and absence of unsupported claims. A failed item returns the record to `draft` rather than weakening the publication gate.

- [ ] **Step 2: Run desktop and mobile browser checks**

Verify `/services`, all four service details, one laser guide, one press-brake guide, one indexable tool, and one non-indexable tool at 1440×900 and 390×844. Confirm CTA behavior, table readability, focus order, and no horizontal overflow.

- [ ] **Step 3: Run structured-data and source HTML checks**

Use rendered-page inspection plus raw `curl` source. Confirm the raw HTML includes the direct answer and schema before JavaScript, while the hydrated page remains visually equivalent.

- [ ] **Step 4: Commit only evidence-driven corrections**

```bash
git add frontend/src/data frontend/src/components frontend/tests
git commit -m "fix(seo): address bilingual content review"
```
