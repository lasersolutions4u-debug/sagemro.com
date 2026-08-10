# Private Route Noindex and D1 Migration Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep public SAGEMRO acquisition pages indexable while reliably excluding private workflow URLs, and block Worker releases when a required shared CN migration is absent.

**Architecture:** Cloudflare Pages uses path-specific `X-Robots-Tag` rules, while China ECS extends its existing host-and-path nginx header map. The current explicit CN shared-migration gate remains in place and gains the three omitted versions. Both protected branches receive PR test events, while all deploy jobs remain push-only.

**Tech Stack:** GitHub Actions, Cloudflare Pages `_headers`, nginx `map`, Node.js test runner, Vite/React static assets, Wrangler D1 migration checks.

## Global Constraints

- Keep the unauthenticated engineer recruitment homepage crawlable.
- Mark `/work-orders/*`, `/activate`, `/activate/*`, and `/engineer/*` as `noindex, nofollow, noarchive, nosnippet, noimageindex`.
- Preserve the existing host-wide noindex policy for both Admin sites.
- Add only `041_quote_execution_baseline`, `044_service_standard_progress`, and `045_service_guidance_cache` to the CN migration gate.
- PRs targeting `main` and `china-edition` run tests but never deploy.
- Do not modify application authorization, database contents, D1 schema, Wrangler configuration, Pages project names, or production Secrets.
- Implement international and China branch changes separately because the branches have materially different deployment workflows.

---

### Task 1: Main branch workflow gates

**Files:**
- Modify: `e2e/tests/ci-gate-contract.test.mjs`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: protected branches `main` and `china-edition`, existing `Test & Build Verify` job, existing `CN_REQUIRED` shell list.
- Produces: PR test events for both production branches and a CN migration allowlist containing versions 038, 039, 040, 041, 043, 044, and 045.

- [ ] **Step 1: Add failing workflow contract assertions**

Extend `e2e/tests/ci-gate-contract.test.mjs` with these expectations:

```js
test('Cloudflare test workflow covers pull requests to both protected branches', () => {
  const workflow = read('.github/workflows/deploy.yml');
  assert.match(workflow, /pull_request:\s+branches: \[main, china-edition\]/);
});
```

Add the omitted versions to the existing migration-gate test:

```js
for (const version of [
  '038_material_requisitions_and_staff',
  '039_field_workdays',
  '040_field_evidence_cleanup_queue',
  '041_quote_execution_baseline',
  '043_engineer_service_readiness',
  '044_service_standard_progress',
  '045_service_guidance_cache',
]) {
  assert.match(workerJob, new RegExp(version));
}
```

- [ ] **Step 2: Run the contract test and observe the intended failure**

Run:

```bash
cd e2e
node --test tests/ci-gate-contract.test.mjs
```

Expected: FAIL because the PR trigger contains only `main`, and the CN list lacks 041, 044, and 045.

- [ ] **Step 3: Make the minimal workflow change**

Change the workflow trigger to:

```yaml
pull_request:
  branches: [main, china-edition]
```

Change the explicit shared list to:

```bash
CN_REQUIRED="038_material_requisitions_and_staff 039_field_workdays 040_field_evidence_cleanup_queue 041_quote_execution_baseline 043_engineer_service_readiness 044_service_standard_progress 045_service_guidance_cache"
```

Do not change any deploy-job `if:` expression.

- [ ] **Step 4: Verify the targeted workflow tests pass**

Run:

```bash
cd e2e
node --test tests/ci-gate-contract.test.mjs
```

Expected: all tests in the file PASS with zero failures.

- [ ] **Step 5: Commit the workflow gate**

```bash
git add .github/workflows/deploy.yml e2e/tests/ci-gate-contract.test.mjs
git commit -m "fix(ci): cover protected branches and CN migrations"
```

### Task 2: International private-route indexing controls

**Files:**
- Modify: `frontend/tests/static-security-headers.test.mjs`
- Modify: `frontend/tests/seo-contract.test.mjs`
- Modify: `frontend/public/_headers`
- Modify: `frontend/public/robots.txt`

**Interfaces:**
- Consumes: Cloudflare Pages `_headers` path matching and the existing hydrated React `noindex,nofollow,noarchive` metadata.
- Produces: full `X-Robots-Tag` responses for private path families while public roots keep their existing index policy.

- [ ] **Step 1: Add failing path-header tests**

Add to `frontend/tests/static-security-headers.test.mjs`:

```js
test('frontend private route families return a complete noindex header', () => {
  const headers = read('frontend/public/_headers');
  for (const route of ['/work-orders/*', '/activate', '/activate/*', '/engineer/*']) {
    const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      headers,
      new RegExp(`^${escapedRoute}\\n  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex$`, 'm'),
    );
  }
});
```

Add to `frontend/tests/seo-contract.test.mjs`:

```js
test('crawlable private shells expose noindex instead of hiding it behind robots exclusion', async () => {
  const robots = await read('frontend/public/robots.txt');
  for (const path of ['/work-orders/', '/activate', '/engineer/']) {
    assert.doesNotMatch(robots, new RegExp(`Disallow: ${path.replace('/', '\\/')}`));
  }
});
```

- [ ] **Step 2: Run the targeted frontend tests and observe failure**

Run:

```bash
cd frontend
node --test tests/static-security-headers.test.mjs tests/seo-contract.test.mjs
```

Expected: FAIL because frontend `_headers` has only the global security stanza and `robots.txt` still excludes the private paths.

- [ ] **Step 3: Add the Cloudflare path headers**

Append to `frontend/public/_headers`:

```text
/work-orders/*
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex

/activate
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex

/activate/*
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex

/engineer/*
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex
```

Do not add a rule for `/` on the engineer hostname.

- [ ] **Step 4: Let index-capable crawlers observe the noindex response**

Remove the exact private-path `Disallow` lines for `/work-orders/`, `/activate`, and `/engineer/` from the Googlebot, Bingbot, OAI-SearchBot, and general `User-agent: *` sections. Keep `/api/` and `/admin/` exclusions, and keep the existing complete exclusions for GPTBot, Google-Extended, ClaudeBot, and CCBot.

- [ ] **Step 5: Verify targeted tests and the frontend build**

Run:

```bash
cd frontend
node --test tests/static-security-headers.test.mjs tests/seo-contract.test.mjs
npm run build
```

Expected: both test files PASS and Vite build exits 0.

- [ ] **Step 6: Commit the international controls**

```bash
git add frontend/public/_headers frontend/public/robots.txt frontend/tests/static-security-headers.test.mjs frontend/tests/seo-contract.test.mjs
git commit -m "fix(seo): noindex private frontend routes"
```

### Task 3: Main branch complete verification and integration

**Files:**
- Verify only; no new production files expected.

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: a reviewed main PR and a verified international production response.

- [ ] **Step 1: Install dependencies in the isolated worktree**

Run `npm install --no-audit --no-fund` in `worker`, `frontend`, `admin`, and `e2e`.

- [ ] **Step 2: Run the complete repository gates**

Run the same commands represented by `Test & Build Verify`:

```bash
cd worker && npm test
cd ../frontend && npm run lint --if-present && npm test && npm run build
cd ../admin && npm test && npm run build
cd ../e2e && npm test
```

Expected: every command exits 0 with zero test failures.

- [ ] **Step 3: Push and create a main PR**

```bash
git push -u origin codex/private-noindex-migration-gate
gh pr create --base main --head codex/private-noindex-migration-gate --title "fix: harden private indexing and deployment gates" --body $'## Summary\n- add response-level noindex controls for private frontend routes\n- require CN migrations 041, 044, and 045 before Worker deployment\n- run PR tests for both protected branches without deploying from PR events'
```

The PR body must list the private path rules, the migration versions, and the fact that PR events never deploy.

- [ ] **Step 4: Wait for `Test & Build Verify`, then merge**

Run `gh pr checks --watch` and merge only after the required check succeeds. Use the existing merge-commit convention.

- [ ] **Step 5: Approve and verify the main production deployment**

Approve the pending `production` deployment as the configured repository owner. Wait for the main deploy workflow to finish. If the new migration gate reports a missing CN migration, stop without deploying the Worker and request explicit production-migration authorization.

- [ ] **Step 6: Verify international production headers**

Run:

```bash
curl -fsSI https://sagemro.com/work-orders/SEO-PRIVATE-CHECK
curl -fsSI https://engineer.sagemro.com/
curl -fsSI https://admin.sagemro.com/
```

Expected: the work-order and Admin responses include the full noindex value; engineer root does not include `X-Robots-Tag: noindex`.

### Task 4: China branch path controls and PR bootstrap

**Files:**
- Modify on a branch based on `origin/china-edition`: `frontend/tests/static-security-headers.test.mjs`
- Modify on a branch based on `origin/china-edition`: `frontend/tests/seo-contract.test.mjs`
- Modify on a branch based on `origin/china-edition`: `frontend/public/_headers`
- Modify on a branch based on `origin/china-edition`: `frontend/public/robots.txt`
- Modify on a branch based on `origin/china-edition`: `.github/workflows/deploy.yml`
- Modify on a branch based on `origin/china-edition`: `.github/workflows/aliyun-cn-deploy.yml`

**Interfaces:**
- Consumes: the China ECS nginx `$sagemro_robots_tag` map and rollback-safe deployment workflow.
- Produces: path-specific noindex headers on `.cn`, an indexable engineer recruitment root, and future PR test events for `china-edition`.

- [ ] **Step 1: Create a second ignored worktree**

Create `codex/cn-private-noindex` from `origin/china-edition` at `.worktrees/cn-private-noindex`. Verify `.worktrees/` is ignored and the new worktree starts clean.

- [ ] **Step 2: Add failing China contract tests**

Extend the nginx test in `frontend/tests/static-security-headers.test.mjs` to require:

```js
assert.match(workflow, /map "\$host:\$uri" \$sagemro_robots_tag/);
assert.match(workflow, /work-orders\|activate\|engineer/);
assert.match(workflow, /curl -fsSI[^\n]*sagemro\.cn\/work-orders\/SEO-PRIVATE-CHECK/);
assert.match(workflow, /engineer\.sagemro\.cn\//);
```

Add the same frontend `_headers` and robots assertions from Task 2. Add a workflow assertion requiring:

```js
assert.match(deployWorkflow, /pull_request:\s+branches: \[main, china-edition\]/);
```

- [ ] **Step 3: Run the China targeted tests and observe failure**

Run:

```bash
cd frontend
node --test tests/static-security-headers.test.mjs tests/seo-contract.test.mjs
```

Expected: FAIL because the nginx map is host-only, private Cloudflare header rules are absent, robots still excludes the paths, and China PR events are not enabled.

- [ ] **Step 4: Implement the shared static changes and PR trigger**

Apply the exact `_headers` and `robots.txt` changes from Task 2. Change `.github/workflows/deploy.yml` to `branches: [main, china-edition]` under `pull_request`, leaving deploy `if:` expressions unchanged.

- [ ] **Step 5: Extend the China nginx header map**

Replace the host-only map with:

```nginx
map "$host:$uri" $sagemro_robots_tag {
  default "";
  ~^admin\.sagemro\.cn: "noindex, nofollow, noarchive, nosnippet, noimageindex";
  ~^((www\.)?sagemro\.cn|engineer\.sagemro\.cn):/(work-orders|activate|engineer)(/|$) "noindex, nofollow, noarchive, nosnippet, noimageindex";
}
```

Retain the existing `add_header X-Robots-Tag $sagemro_robots_tag always;` and nginx rollback behavior.

- [ ] **Step 6: Add post-deploy header assertions**

After the existing endpoint health checks, fetch headers for `/work-orders/SEO-PRIVATE-CHECK`, engineer root, and Admin root. Fail unless private work-order and Admin responses contain the full noindex value; fail if engineer root contains a noindex header.

- [ ] **Step 7: Verify targeted tests and China builds**

Run:

```bash
cd frontend
node --test tests/static-security-headers.test.mjs tests/seo-contract.test.mjs
npm run lint --if-present
npm test
npm run build
cd ../admin
npm test
npm run build
```

Expected: all tests and builds exit 0.

- [ ] **Step 8: Commit the China controls**

```bash
git add .github/workflows/deploy.yml .github/workflows/aliyun-cn-deploy.yml frontend/public/_headers frontend/public/robots.txt frontend/tests/static-security-headers.test.mjs frontend/tests/seo-contract.test.mjs
git commit -m "fix(cn): noindex private workflow routes"
```

- [ ] **Step 9: Bootstrap the first protected China PR**

Push `codex/cn-private-noindex` and open a PR to `china-edition`. Because the base branch does not yet emit PR checks for China, use the repository owner's documented admin bypass for this one PR only after local tests pass and the diff is reviewed. Future China PRs must receive `Test & Build Verify` normally.

- [ ] **Step 10: Run and approve the China ECS deployment**

Manually dispatch `aliyun-cn-deploy.yml` from the merged `china-edition` commit, approve its production environment if requested, and wait for all nginx validation, health, and rollback-safe activation steps.

- [ ] **Step 11: Verify China production headers**

Run:

```bash
curl -fsSI https://sagemro.cn/work-orders/SEO-PRIVATE-CHECK
curl -fsSI https://engineer.sagemro.cn/
curl -fsSI https://admin.sagemro.cn/
```

Expected: the work-order and Admin responses include the full noindex value; engineer root does not include `X-Robots-Tag: noindex`.

### Task 5: Final cross-market audit

**Files:**
- Verify only; update the ignored local audit notes if needed.

**Interfaces:**
- Consumes: merged and deployed main/China changes.
- Produces: a fresh evidence record for branch rules, workflows, migration gate, and six public HTTP responses.

- [ ] **Step 1: Re-read both branch protection rules**

Use the GitHub API to confirm `main` and `china-edition` require strict `Test & Build Verify`, disallow force pushes/deletions, and retain zero required external approvals.

- [ ] **Step 2: Re-read the production environment**

Confirm protected branches are the only deployment source and the owner remains the required reviewer with self-review allowed.

- [ ] **Step 3: Confirm PR and push workflow behavior**

Confirm the main PR ran only tests, the China bootstrap exception is documented, subsequent China PR triggers are present, and both production deployments completed only after approved push events.

- [ ] **Step 4: Run the six-response header matrix**

Check private work-order, engineer root, and Admin root for COM and CN. Record status code and `X-Robots-Tag` only; do not log private page bodies.

- [ ] **Step 5: Report remaining risk accurately**

State that noindex controls search visibility, not authorization. Record any deployment or migration blocker instead of claiming completion.
