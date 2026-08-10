# China Page Load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Chinese portal startup time by restoring Admin route code splitting and reusing the Aliyun nginx connection to the Cloudflare API upstream.

**Architecture:** Keep the existing China hosting and API domain topology. Restore the proven `React.lazy`/`Suspense` page boundary used by the international Admin, then make the existing `api.sagemro.cn` reverse proxy use one named nginx upstream with a keepalive pool, SNI, and HTTP/1.1 instead of opening a fresh upstream TLS connection for every request.

**Tech Stack:** React 18, Vite 6, Node test runner, Python 3 nginx configuration transformer, GitHub Actions, Aliyun ECS nginx 1.18.

## Global Constraints

- Preserve every Chinese label, permission rule, and existing page behavior.
- Do not change API domains, databases, Cloudflare Worker code, secrets, or DNS.
- Fail closed if the deployed nginx API proxy shape is not recognized.
- Keep the nginx transformation idempotent and covered by rollback-safe tests.
- Run the complete repository deployment test surface before release.

---

### Task 1: Restore Admin Page Code Splitting

**Files:**
- Create: `admin/src/App.lazy-loading.test.mjs`
- Modify: `admin/package.json`
- Modify: `admin/src/App.jsx`

**Interfaces:**
- Consumes: Existing named page exports and `runtimeConfig` locale behavior.
- Produces: One eagerly loaded login shell plus lazy authenticated-page chunks behind `AdminPageLoading`.

- [x] **Step 1: Write the failing test**

Add a source contract requiring all authenticated pages to use `lazy(() => import(...))`, one `Suspense` boundary, and an eagerly imported login page. Add the test file to the Admin test command.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test src/App.lazy-loading.test.mjs`

Expected: FAIL because `App.jsx` statically imports authenticated pages.

- [x] **Step 3: Write minimal implementation**

Replace only the authenticated page imports with the existing named-export lazy wrappers, add `AdminPageLoading`, and wrap `renderPage()` with one `Suspense` boundary.

- [x] **Step 4: Run tests and build**

Run: `npm test && npm run build`

Expected: PASS; the entry chunk is below 500 kB and Vite emits separate page chunks.

### Task 2: Reuse the China API Upstream Connection

**Files:**
- Modify: `frontend/tests/nginx-public-routes.test.mjs`
- Modify: `ops/configure_public_routes.py`

**Interfaces:**
- Consumes: One recognized `api.sagemro.cn` TLS server with `proxy_pass https://api.sagemro.com;`.
- Produces: One named `sagemro_api_worker` upstream with `keepalive 32`, and an API location using HTTP/1.1, an empty `Connection` header, correct Host, and TLS SNI.

- [x] **Step 1: Write failing nginx tests**

Extend the existing production-shaped test to require the named upstream and proxy directives. Add rejection tests for missing or ambiguous API proxy locations and preserve the existing idempotency assertion.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/nginx-public-routes.test.mjs`

Expected: FAIL because the transformer currently preserves the direct proxy without keepalive directives.

- [x] **Step 3: Implement the minimal safe transformer**

Recognize exactly one API proxy, rewrite it to the named upstream, inject the upstream once at top-level, and refuse unknown API proxy shapes before any file write.

- [x] **Step 4: Run tests**

Run: `node --test tests/nginx-public-routes.test.mjs`

Expected: PASS, including a byte-identical second transformation.

### Task 3: Release Verification and Deployment

**Files:**
- Verify only: repository test/build outputs and production responses.

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: A tested China release on `china-edition` and measured production evidence.

- [x] **Step 1: Run the full local deployment test surface**

Run the same Worker, frontend lint/test/build, and Admin test/build commands used by `.github/workflows/deploy.yml` and `.github/workflows/aliyun-cn-deploy.yml`.

- [ ] **Step 2: Review the exact diff and commit**

Confirm every changed line maps to Admin code splitting, nginx API connection reuse, tests, or this plan. Commit on `codex/cn-performance-optimization`.

- [ ] **Step 3: Push and integrate**

Push the feature branch, merge it into `china-edition` without rewriting history, and wait for the China auxiliary deployment checks.

- [ ] **Step 4: Deploy Aliyun ECS**

Trigger `aliyun-cn-deploy.yml` from `china-edition`; require its build, nginx syntax check, reload, smoke checks, and rollback gate to pass.

- [ ] **Step 5: Verify production**

Confirm the Chinese Admin initial JS transfer is materially smaller, page chunks are emitted, all four China endpoints return 200, and repeated `api.sagemro.cn/health` timings no longer pay a fresh upstream TLS setup on every request.
