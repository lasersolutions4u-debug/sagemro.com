# AI Subdomain Migration and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the customer workspace to `ai.sagemro.com` and `ai.sagemro.cn` while keeping public content on the main domains, preserving customer sessions, and preventing AI workspace indexing.

**Architecture:** Build the same frontend source in two explicit modes: `public` creates prerendered indexable pages; `portal` creates a noindex SPA for customer/engineer workflows. Deploy the international portal build to a proposed dedicated Cloudflare Pages project (`sagemro-ai`) and package the China portal build separately for the Aliyun ECS release. Add `ai.*` as customer origins in Worker CORS/portal-role logic, then perform DNS and production cutover only after backups, migrations, and smoke tests pass.

**Tech Stack:** React/Vite, Node build scripts, Cloudflare Pages/Workers/D1, GitHub Actions, Aliyun ECS, nginx, DNS, Playwright/curl smoke checks.

---

## Mandatory approval gates

- The proposed Cloudflare Pages project name `sagemro-ai` must be approved before editing deployment configuration or creating the project.
- DNS creation for `ai.sagemro.com` and `ai.sagemro.cn` requires explicit production confirmation.
- Aliyun nginx changes require backup of the active config, `nginx -t`, a documented rollback path, and explicit production confirmation.
- Migration `047_structured_service_request_intake.sql` must be backed up, applied, and verified on both `sagemro-db` and `sagemro-db-cn` before deploying Worker code that reads it.
- No workflow push, Cloudflare deploy, Aliyun workflow run, DNS write, or production smoke is authorized by this plan alone.

## File map

- Create `frontend/scripts/buildPortalPages.mjs` — portal-only crawl controls and SPA redirects.
- Modify `frontend/package.json` — separate `build:public` and `build:portal` commands while retaining `build` as the public default.
- Modify `frontend/vite.config.js` — read `SAGEMRO_BUILD_TARGET` and select output directory/compile-time mode.
- Modify `frontend/index.html` and `frontend/src/App.jsx` — runtime selection and portal metadata.
- Add frontend build-target tests.
- Modify `worker/src/lib/session.js`, `worker/src/index.js`, and tests — allow `ai.*` as customer portals.
- Modify `.github/workflows/deploy.yml` — build/deploy the proposed international AI Pages project after approval.
- Modify `.github/workflows/aliyun-cn-deploy.yml` — package separate public and AI builds and activate `/current/ai` after approval.
- Modify `DEPLOY.md` and `TECH-SPEC.md` — document domain ownership, release order, and rollback.
- Extend E2E/smoke checks for both AI hosts.

### Task 1: Define two deterministic frontend build targets

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.js`
- Create: `frontend/scripts/buildPortalPages.mjs`
- Create: `frontend/tests/build-target-contract.test.mjs`

- [ ] **Step 1: Write the failing build-target test**

The test must spawn both builds into temporary directories or use exported helpers and assert:

```js
// public build
assert.match(publicIndex, /name="robots" content="index, follow"/);
assert.match(publicIndex, /rel="canonical" href="https:\/\/sagemro\.com\//);
assert.ok(publicFiles.includes('sitemap.xml'));

// portal build
assert.match(portalIndex, /name="robots" content="noindex,nofollow,noarchive"/);
assert.doesNotMatch(portalIndex, /rel="canonical" href="https:\/\/sagemro\.(com|cn)\//);
assert.equal(portalFiles.includes('sitemap.xml'), false);
assert.match(portalRobots, /User-agent: \*\nDisallow: \//);
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/build-target-contract.test.mjs`

Expected: FAIL because only one public build exists.

- [ ] **Step 3: Add explicit scripts**

Use cross-platform Node environment setup rather than shell-only variable syntax:

```json
{
  "scripts": {
    "build": "npm run build:public",
    "build:public": "node scripts/runBuild.mjs public",
    "build:portal": "node scripts/runBuild.mjs portal"
  }
}
```

Create `scripts/runBuild.mjs` if needed to set `SAGEMRO_BUILD_TARGET`, invoke Vite, and run either `buildPublicPages.mjs` or `buildPortalPages.mjs` without adding a dependency.

- [ ] **Step 4: Configure output directories and compile-time mode**

`vite.config.js` must use:

```js
const target = process.env.SAGEMRO_BUILD_TARGET === 'portal' ? 'portal' : 'public';
build: {
  outDir: target === 'portal' ? 'dist-portal' : 'dist',
  // preserve all existing build options
},
define: {
  __SAGEMRO_BUILD_TARGET__: JSON.stringify(target),
},
```

Add a global-safe fallback in application code for tests that do not inject the constant.

- [ ] **Step 5: Generate portal crawl controls**

`buildPortalPages.mjs` must overwrite the built index metadata to `noindex,nofollow,noarchive`, write `robots.txt` with `Disallow: /`, write SPA `_redirects` for `/service-request`, `/work-orders/*`, `/activate`, and `/engineer`, and ensure no `sitemap.xml` or `llms.txt` exists.

- [ ] **Step 6: Run both build tests**

Run: `cd frontend && node --test tests/build-target-contract.test.mjs tests/public-build-output.test.mjs`

Expected: PASS; public and portal artifacts are distinct.

- [ ] **Step 7: Commit after user authorizes implementation commits**

```bash
git add frontend/package.json frontend/vite.config.js frontend/scripts/runBuild.mjs frontend/scripts/buildPortalPages.mjs frontend/tests/build-target-contract.test.mjs
git commit -m "build: separate public and AI portal artifacts"
```

### Task 2: Route public and portal builds without duplicating application logic

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/index.html`
- Create: `frontend/src/utils/portalTarget.js`
- Create: `frontend/tests/portal-target-routing.test.mjs`

- [ ] **Step 1: Write failing route-selection tests**

Lock these decisions:

```js
assert.equal(resolvePortalTarget({ buildTarget: 'public', hostname: 'sagemro.com' }), 'public');
assert.equal(resolvePortalTarget({ buildTarget: 'portal', hostname: 'ai.sagemro.com' }), 'customer');
assert.equal(resolvePortalTarget({ buildTarget: 'portal', hostname: 'ai.sagemro.cn' }), 'customer');
assert.equal(resolvePortalTarget({ buildTarget: 'public', hostname: 'engineer.sagemro.cn' }), 'engineer');
assert.equal(resolvePortalTarget({ buildTarget: 'public', hostname: 'engineer.sagemro.com' }), 'engineer');
```

Unknown production hostnames must fail to the public/no-session surface rather than assume customer access.

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/portal-target-routing.test.mjs`

Expected: FAIL because `portalTarget.js` does not exist.

- [ ] **Step 3: Implement pure host/build selection**

Export `resolvePortalTarget({ buildTarget, hostname })`. In `App.jsx`, select:

- `PublicHomePage` and public routes for `public`.
- Existing customer workspace plus `/service-request` for `customer`.
- Existing engineer recruiting/workspace behavior for `engineer`.

Do not fork `App.jsx` into two copied applications.

- [ ] **Step 4: Remove public SEO metadata from portal startup**

The portal build's initial HTML and runtime metadata must remain `noindex`. Customer workspace navigation must never set a main-domain canonical.

- [ ] **Step 5: Run focused tests**

Run: `cd frontend && node --test tests/portal-target-routing.test.mjs tests/seo-contract.test.mjs tests/engineer-recruiting-page.test.mjs`

Expected: PASS; engineer host behavior remains unchanged.

- [ ] **Step 6: Commit after authorization**

```bash
git add frontend/src/App.jsx frontend/index.html frontend/src/utils/portalTarget.js frontend/tests/portal-target-routing.test.mjs
git commit -m "feat: route public and AI portal builds"
```

### Task 3: Recognize AI hosts as isolated customer portals

**Files:**
- Modify: `worker/src/lib/session.js`
- Modify: `worker/src/index.js`
- Modify: `worker/tests/auth.test.mjs`
- Modify: `worker/tests/request-auth.test.mjs`
- Modify: `frontend/tests/cookie-auth-contract.test.mjs`

- [ ] **Step 1: Write failing origin tests**

Add:

```js
assert.equal(expectedPortalRole('https://ai.sagemro.com'), 'customer');
assert.equal(expectedPortalRole('https://ai.sagemro.cn'), 'customer');
assert.equal(expectedPortalRole('https://ai.attacker.example'), null);
```

Assert preflight responses echo each approved AI origin with `Access-Control-Allow-Credentials: true` and reject unlisted lookalike origins.

- [ ] **Step 2: Run and verify failure**

Run: `cd worker && node --test tests/auth.test.mjs tests/request-auth.test.mjs`

Expected: FAIL because AI origins are absent from role and CORS lists.

- [ ] **Step 3: Add exact origins**

Add only:

```js
'https://ai.sagemro.com'
'https://ai.sagemro.cn'
```

to production CORS. Map only those exact hostnames to `customer` in `expectedPortalRole`. Do not allow wildcard subdomains.

- [ ] **Step 4: Update wrong-portal redirects**

Customer redirect targets must use `https://ai.sagemro.com` or `https://ai.sagemro.cn` after migration. Public `sagemro.*` remains a marketing destination, not the authenticated customer portal.

- [ ] **Step 5: Verify session continuity**

Keep the session cookie host-only on `api.sagemro.*`. Add a test demonstrating that login from an AI origin receives a valid customer session and that restore-session accepts the same API-host cookie. Do not add a `Domain=` cookie attribute.

- [ ] **Step 6: Run focused tests**

Run:

```bash
cd worker && node --test tests/auth.test.mjs tests/request-auth.test.mjs tests/service-os-auth.test.mjs
cd ../frontend && node --test tests/cookie-auth-contract.test.mjs
```

Expected: PASS; customer, engineer, and admin isolation remains intact.

- [ ] **Step 7: Commit after authorization**

```bash
git add worker/src/lib/session.js worker/src/index.js worker/tests/auth.test.mjs worker/tests/request-auth.test.mjs frontend/tests/cookie-auth-contract.test.mjs
git commit -m "feat: authorize AI customer portal origins"
```

### Task 4: Prepare the international Cloudflare Pages deployment

**Approval checkpoint:** Confirm proposed Pages project name `sagemro-ai` before modifying `.github/workflows/deploy.yml` or creating any Cloudflare project/domain binding.

**Files:**
- Modify after approval: `.github/workflows/deploy.yml`
- Modify: `frontend/tests/deploy-workflow-contract.test.mjs`

- [ ] **Step 1: Write the failing workflow contract**

Assert the workflow builds the public artifact with `npm run build:public`, builds the portal artifact with `npm run build:portal`, deploys `frontend/dist` to `sagemro-com`, and deploys `frontend/dist-portal` to approved project `sagemro-ai`. Assert PR events never deploy either artifact.

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/deploy-workflow-contract.test.mjs`

Expected: FAIL because the AI deployment job does not exist.

- [ ] **Step 3: Add the gated AI deployment job**

The job must:

- depend on the existing `test` job;
- run only on `push` to `main`;
- use `environment: production`;
- deploy `frontend/dist-portal` to `sagemro-ai`;
- reuse existing Cloudflare secrets without printing them;
- leave PR behavior test-only.

- [ ] **Step 4: Run workflow contract and build commands**

Run:

```bash
cd frontend
npm run build:public
npm run build:portal
node --test tests/deploy-workflow-contract.test.mjs tests/build-target-contract.test.mjs
```

Expected: PASS; both artifact directories exist and are isolated.

- [ ] **Step 5: Commit after authorization**

```bash
git add .github/workflows/deploy.yml frontend/tests/deploy-workflow-contract.test.mjs
git commit -m "ci: deploy the international AI portal"
```

### Task 5: Prepare the China Aliyun dual-artifact release

**Approval checkpoint:** Confirm the server target `/var/www/sagemro-cn/current/ai`, back up the active nginx config, and approve production nginx work before running this task's deployment steps.

**Files:**
- Modify after approval: `.github/workflows/aliyun-cn-deploy.yml`
- Modify: `frontend/tests/aliyun-deploy-workflow-contract.test.mjs`

- [ ] **Step 1: Write the failing workflow contract**

Assert the workflow:

```text
builds frontend/dist with build:public
builds frontend/dist-portal with build:portal
packages release/frontend and release/ai separately
tests both index.html files
activates current/frontend -> release/frontend
activates current/engineer -> release/frontend
activates current/ai -> release/ai
health-checks https://ai.sagemro.cn/
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/aliyun-deploy-workflow-contract.test.mjs`

Expected: FAIL because the workflow packages one frontend artifact.

- [ ] **Step 3: Modify build/package/activation steps**

Preserve the current temporary security-group rule, SSH host-key handling, release directory, atomic symlink activation, `nginx -t`, reload, and always-run rule revocation. Add only the separate AI artifact and symlink.

- [ ] **Step 4: Add health checks**

Require 200 responses from public, AI, Admin, Engineer, and API hosts. Do not remove the existing checks.

- [ ] **Step 5: Run workflow contract**

Run: `cd frontend && node --test tests/aliyun-deploy-workflow-contract.test.mjs tests/build-target-contract.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit after authorization**

```bash
git add .github/workflows/aliyun-cn-deploy.yml frontend/tests/aliyun-deploy-workflow-contract.test.mjs
git commit -m "ci: package the China AI portal separately"
```

### Task 6: Document the domain map, release order, and rollback

**Files:**
- Modify: `DEPLOY.md`
- Modify: `TECH-SPEC.md`

- [ ] **Step 1: Update the domain tables**

Document:

```text
sagemro.com / sagemro.cn            public, indexable service sites
ai.sagemro.com / ai.sagemro.cn      customer portals, noindex
engineer.sagemro.com / .cn          engineer portals
admin.sagemro.com / .cn             admin portals
api.sagemro.com / .cn               shared Worker with market-specific D1
```

- [ ] **Step 2: Add the release sequence**

Document this exact order:

1. Run and verify COM/CN encrypted backups.
2. Apply migration `047` to COM and verify columns.
3. Apply migration `047` to CN and verify columns.
4. Deploy shared Worker from `main`.
5. Deploy COM public and portal builds.
6. Run COM smoke checks.
7. Synchronize reviewed client changes to `china-edition`.
8. Run the Aliyun China workflow.
9. Run CN smoke checks.
10. Submit updated main-domain sitemaps only after public pages are live.

- [ ] **Step 3: Add rollback instructions**

Rollback must preserve D1 columns, revert application/deployment commits, restore previous Pages deployment, and repoint Aliyun symlinks to the previous release. DNS rollback returns `ai.*` to the prior target or removes the new record; do not redirect private portal paths to public pages.

- [ ] **Step 4: Validate documentation links and commands**

Run: `rg -n "ai\.sagemro|047_structured|sagemro-ai|current/ai" DEPLOY.md TECH-SPEC.md`

Expected: both documents contain the full domain map and release gate; no secrets appear.

- [ ] **Step 5: Commit after authorization**

```bash
git add DEPLOY.md TECH-SPEC.md
git commit -m "docs: document AI portal deployment"
```

### Task 7: Local integration and noindex verification

**Files:**
- Modify: `e2e/tests/service-order-lifecycle.spec.mjs`
- Create: `e2e/tests/public-ai-domain-boundary.spec.mjs`

- [ ] **Step 1: Add domain-boundary E2E**

Test with local host aliases:

- public host `/` shows the service homepage and semantic public navigation;
- AI host `/` shows the customer workspace;
- AI host `/service-request` restores a draft and can authenticate;
- engineer host still shows engineer behavior;
- AI document and runtime metadata remain noindex;
- public sitemap contains no AI URL;
- public CTA enters the matching-market AI host without free-text query data.

- [ ] **Step 2: Run focused E2E**

Run: `cd e2e && npx playwright test tests/public-ai-domain-boundary.spec.mjs tests/service-order-lifecycle.spec.mjs`

Expected: PASS.

- [ ] **Step 3: Run the complete repository gate**

Run:

```bash
cd worker && npm test
cd ../frontend && npm run lint && npm test && npm run build:public && npm run build:portal
cd ../admin && npm test && npm run build
cd ../e2e && npm test
```

Expected: every command exits 0.

- [ ] **Step 4: Check the final diff**

Run: `git diff --check && git status --short`

Expected: only approved implementation files, tests, and documentation are modified; no build output, secrets, customer data, or production config backups are tracked.

### Task 8: Production rollout — execute only after explicit confirmation

**This task is intentionally a gated operational checklist, not authorization to run it.**

- [ ] **Step 1: Confirm prerequisites**

Record explicit confirmation for Pages project/domain work, DNS changes, nginx changes, migration execution, and deployment. Verify current production health before changing anything.

- [ ] **Step 2: Back up both D1 databases**

Run the existing `Production D1 Backup - COM and CN` workflow. Verify both encrypted artifacts and manifests before continuing.

- [ ] **Step 3: Apply and verify migration `047`**

Use the established Wrangler commands from `DEPLOY.md` for `sagemro-db` and `sagemro-db-cn`. Query `pragma_table_info('work_orders')` and confirm all thirteen new columns in both databases.

- [ ] **Step 4: Create/bind AI hosts**

After approval, bind `ai.sagemro.com` to the approved `sagemro-ai` Pages project and point `ai.sagemro.cn` to the Aliyun ECS host. Confirm TLS before exposing navigation links.

- [ ] **Step 5: Deploy in the documented order**

Worker first after migrations, then COM public/portal, then China client release. Do not cancel an in-progress Aliyun workflow; verify temporary SSH rule cleanup.

- [ ] **Step 6: Run production smoke checks**

Verify:

```text
https://sagemro.com/                 200, public service page, indexable
https://sagemro.cn/                  200, Chinese service page, indexable
https://ai.sagemro.com/              200, customer portal, noindex
https://ai.sagemro.cn/               200, customer portal, noindex
https://engineer.sagemro.com/        existing behavior
https://engineer.sagemro.cn/         existing behavior
https://api.sagemro.com/health       200
https://api.sagemro.cn/health        200
```

Create one test customer request per market with fictional data, verify one work order each, then remove only the test records through the existing approved cleanup path.

- [ ] **Step 7: Monitor and rollback if any gate fails**

Rollback on 5xx, auth-loop, CORS failure, missing draft, wrong canonical, indexable AI host, or broken engineer/admin access. Preserve database backups and migration columns; revert the application/deployment target rather than attempting destructive schema rollback.
