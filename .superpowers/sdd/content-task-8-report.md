# Task 8 — Bilingual Editorial and Browser Acceptance Gate

Date: 2026-08-07 (Asia/Shanghai)
Worktree: `/Users/joe/Projects/sagemro.com/.worktrees/seo-technical-main`
Starting HEAD: `a53e25f868affb24e0677fe63fc5ec69233811d3`

## Outcome

Acceptance passed after three evidence-driven corrections:

1. The press-brake tonnage calculator was downgraded from indexable to direct-access noindex in EN and zh-CN. Its supposed formula exposed the internal identifier `estimateAirBendTonnage` and cited only its own inputs/outputs, so it did not meet the publication evidence gate.
2. Tool hub/detail H1 styles changed from `break-keep` to `break-words`; real Chromium showed long Chinese titles overflowing mobile viewports by 80 px and 193 px before the change and 0 px after it.
3. The public build now emits a localized, schema-free, `noindex,nofollow,noarchive` `404.html`. Draft routes still generate no route file, while raw/static and hydrated requests now resolve as HTTP 404 NotFound pages.

No press-brake diagnostic guide was published. The acceptance matrix used `/services/press-brake-repair` for visible press-brake service coverage and `/insights/press-brake-angle-inaccuracy` as the representative draft URL.

## Editorial review

Review criteria for every page group were direct answer, safety boundary, terminology, units, source scope, manufacturer neutrality, CTA relevance, and unsupported claims.

| Page group (reviewed in EN and zh-CN) | Records | Result |
| --- | ---: | --- |
| Service hub/details | `/services` plus 4 service records | Pass. Answer-first summaries, remote/onsite boundaries, neutral service language, relevant service CTAs, no numeric/availability guarantees. |
| Published diagnostic guides | `laser-protective-lens-burning`, `laser-cutting-machine-maintenance-checklist` | Pass. Observation is separated from diagnosis; non-invasive checks, stop/escalation conditions, OEM limits, references, author/reviewer, and service/tool CTAs remain present. |
| Indexable tools after gate | metal weight, laser cutting cost, V-die/bend allowance | Pass. Formulas, calculator-derived examples, units, assumptions, limitations, safety/review prompts, and neutral planning boundaries are present. |
| Direct-access noindex tools | steel price, press-brake tonnage, assist gas, cutting speed, equipment ROI, auxiliary sizing | Pass for direct access with visible planning limitations and relevant AI review CTA. Press-brake tonnage failed indexability evidence and was downgraded; no evidence text was fabricated. |
| Technical review policy | `/about/technical-review` | Pass. Preparation, evidence scope, correction policy, dates, OEM/qualified-person limits, and error-reporting channel are bilingual and neutral. |

Published guide source reachability checked with:

```bash
for url in \
  'https://shop.precitec.com/media/0f/3c/ef/1741683061/TD_Optik-HB_EN.pdf' \
  'https://www.osha.gov/otm/section-3-health-hazards/chapter-6' \
  'https://www.osha.gov/sites/default/files/publications/OSHA3120.pdf' \
  'https://www.bystronic.com/zaf/en/news/maintenance-tips-your-bystronic-fiber-laser-cutter'; do
  curl -L -sS --max-time 20 -o /dev/null -w '%{http_code} %{content_type} %{url_effective}\n' "$url"
done
```

Precitec PDF and Bystronic page returned 200. OSHA returned 403 to non-browser `curl` (bot policy); the URLs remain authoritative citations, but this CLI status is recorded as an environment limitation rather than treated as content support beyond their stated safety scope.

## Browser acceptance

### Server and browser setup

The production build was created and served only from this worktree:

```bash
cd /Users/joe/Projects/sagemro.com/.worktrees/seo-technical-main/frontend
npm run build

cd /Users/joe/Projects/sagemro.com/.worktrees/seo-technical-main/.superpowers/sdd/acceptance
node static-server.mjs
```

The bundled Playwright wrapper was attempted first but its temporary npm cache lacked `playwright-core/browsers.json`. A clean CLI was isolated under the ignored acceptance directory, without changing project dependencies:

```bash
npm install --no-save --no-package-lock --prefix .pwcli @playwright/cli@latest
.pwcli/node_modules/.bin/playwright-cli -s=t8 open http://localhost:4179/services
.pwcli/node_modules/.bin/playwright-cli -s=t8 snapshot
```

`localhost:4179` exercised EN. Requests to `http://sagemro.cn:4179` were routed to the same isolated server inside Playwright so `window.location.hostname.endsWith('.cn')` exercised the supported zh-CN locale path. Auth-session and funnel requests were stubbed with unauthenticated JSON responses and matching CORS headers; this removed local-origin CORS noise without changing page behavior.

### Matrix

25 browser checks were run:

- EN desktop 1440×900: all 11 required routes.
- zh-CN mobile 390×844: the same 11 required routes.
- Reverse-viewport spot checks: EN mobile press-brake service, EN mobile protective-lens guide, zh-CN desktop metal-weight tool.

Required routes:

```text
/services
/services/laser-cutting-machine-repair
/services/press-brake-repair
/services/remote-diagnostics
/services/preventive-maintenance
/insights/laser-protective-lens-burning
/insights/laser-cutting-machine-maintenance-checklist
/insights/press-brake-angle-inaccuracy
/tools/metal-weight-calculator
/tools/laser-cutting-speed-reference
/about/technical-review
```

The batch was executed through the real-browser CLI as:

```bash
.pwcli/node_modules/.bin/playwright-cli -s=t8 run-code "async (page) => { /* route the two local hosts and API stubs; visit the 22 required locale/viewport cases plus 3 reverse-viewport cases; assert status, html lang, robots, schema type, NotFound state, overflow, console/page errors, and responsive guide presentation */ }"
```

Results:

- All published routes returned 200; the draft returned 404 in EN and zh-CN.
- `html[lang]`, H1 language, robots, and hydrated schema matched each locale/page type.
- Published pages were `index,follow`; the chosen direct noindex tool and draft were `noindex,nofollow,noarchive` only.
- No horizontal overflow remained after the H1 fix.
- No page errors or unexpected console errors remained. The browser reports the expected failed main-document resource entry for deliberate HTTP 404 navigation.
- The diagnostic comparison table is visible at 1440×900; the three semantic mobile cards replace it at 390×844.
- Representative service focus order was logical: brand → primary navigation → breadcrumb → related guide links → subsequent CTA/related/footer controls.
- `Prepare service information` opened the established service-request modal without submitting anything.
- `Request service review` navigated to AI chat with no message bubble and a disabled send button; no request was auto-sent.

Focused browser commands included:

```bash
.pwcli/node_modules/.bin/playwright-cli -s=t8 resize 1440 900
.pwcli/node_modules/.bin/playwright-cli -s=t8 goto http://localhost:4179/services/laser-cutting-machine-repair
.pwcli/node_modules/.bin/playwright-cli -s=t8 snapshot
.pwcli/node_modules/.bin/playwright-cli -s=t8 click f192e76
.pwcli/node_modules/.bin/playwright-cli -s=t8 snapshot
.pwcli/node_modules/.bin/playwright-cli -s=t8 click f192e92
.pwcli/node_modules/.bin/playwright-cli -s=t8 snapshot
.pwcli/node_modules/.bin/playwright-cli -s=t8 click f192e75
.pwcli/node_modules/.bin/playwright-cli -s=t8 snapshot
```

Screenshots (ignored; not tracked):

- `.superpowers/sdd/acceptance/en-desktop-service-detail.png`
- `.superpowers/sdd/acceptance/zh-mobile-guide-cards.png`
- `.superpowers/sdd/acceptance/zh-mobile-tool-wrapped-heading.png`
- `.superpowers/sdd/acceptance/zh-mobile-draft-404.png`

## Raw/static HTML and schema

Commands:

```bash
curl -sS -o /dev/null -w 'published-guide status=%{http_code}\n' \
  http://localhost:4179/insights/laser-protective-lens-burning
curl -sS -o /dev/null -w 'draft-guide status=%{http_code}\n' \
  http://localhost:4179/insights/press-brake-angle-inaccuracy
curl -sS http://localhost:4179/insights/press-brake-angle-inaccuracy \
  | rg -o 'noindex,nofollow,noarchive|404 — This page doesn&#39;t exist' | sort -u
```

Results:

- Published guide: HTTP 200; raw HTML contains the direct answer, prerendered body, client entry, and JSON-LD before client execution.
- Schema primaries are correct: `Service` for service detail, `Article` for published guide, `WebApplication` for indexable and direct noindex tools.
- Direct noindex tool pages contain `noindex,nofollow,noarchive` and `WebApplication` schema while remaining absent from sitemap/manifest discovery.
- Press-brake tonnage now has the same direct noindex behavior.
- `frontend/dist/insights/press-brake-angle-inaccuracy/index.html` does not exist.
- Draft request: HTTP 404; raw `404.html` is noindex, visibly NotFound, and schema-free; hydrated EN and zh-CN remain HTTP 404, noindex, schema-free NotFound pages.

## TDD and verification

Red/green commands for the evidence downgrade, mobile wrapping, and static 404 were run before/after their minimal implementations:

```bash
cd /Users/joe/Projects/sagemro.com/.worktrees/seo-technical-main/frontend
node --test tests/industry-tools-calculations.test.mjs
node --test tests/public-build-output.test.mjs
node --test tests/industry-tools-calculations.test.mjs tests/public-seo-routes.test.mjs tests/public-build-output.test.mjs tests/diagnostic-guides.test.mjs tests/service-pages.test.mjs
```

Final fresh verification:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Results: 335/335 frontend tests passed; ESLint passed with no output; production build completed; `git diff --check` passed.

## Defects, fixes, and remaining concerns

| Evidence | Fix | Retest |
| --- | --- | --- |
| Implementation identifier and self-reference presented as press-brake tonnage evidence | Set bilingual `seoEvidence.indexable` to false and removed the incomplete evidence block | Removed from public manifest; present as direct noindex WebApplication page |
| zh-CN tool H1 overflow of 80 px / 193 px at 390×844 | `break-keep` → `break-words` on tool hub/detail H1 | Both representative tools measured 0 px overflow |
| `_redirects` referenced missing `404.html` | Generate localized, noindex, schema-free static 404 shell | Raw curl 404; hydrated EN/zh-CN 404; draft route file remains absent |

Remaining concern: OSHA blocks the non-browser source-status probe with HTTP 403. No publication claim was expanded based on that probe, and the guide safety language stays within the cited OSHA topic and OEM/manual boundaries.
