# Three-Role E2E Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated Playwright baseline that validates SAGEMRO engineer onboarding and the complete customer/Admin/engineer service-order lifecycle.

**Architecture:** A standalone `e2e/` package starts local Vite applications and a local Wrangler Worker backed by dedicated persisted D1/KV/R2 state. A development-only, secret-protected mailbox captures activation email content without weakening production behavior.

**Tech Stack:** Playwright Test, React/Vite, Cloudflare Wrangler, local D1/KV/R2, Node.js.

---

### Task 1: Development-Only Activation Mailbox

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/tests/engineer-account-activation.test.mjs`

- [ ] Add failing unit tests proving E2E email capture works only with the development-mode flags and proving mailbox reads require the matching secret.
- [ ] Run the focused Worker test and confirm failures are caused by missing mailbox behavior.
- [ ] Add the minimal KV mailbox capture and guarded route.
- [ ] Run focused and full Worker tests.
- [ ] Commit the mailbox behavior.

### Task 2: Isolated Local E2E Runtime

**Files:**
- Create: `e2e/package.json`
- Create: `e2e/playwright.config.mjs`
- Create: `e2e/scripts/prepare-local-env.mjs`
- Create: `e2e/support/runtime.mjs`
- Modify: `.gitignore`

- [ ] Add a failing runtime contract test for loopback-only URLs and required test secrets.
- [ ] Implement environment preparation, local schema initialization, and server commands.
- [ ] Verify a fresh local Worker returns health successfully and contains the expected schema.
- [ ] Commit the isolated runtime.

### Task 3: Engineer Onboarding Browser Journey

**Files:**
- Create: `e2e/tests/engineer-onboarding.spec.mjs`
- Create: `e2e/support/api.mjs`

- [ ] Write the browser journey before adding any UI test hooks.
- [ ] Run it and capture the first missing or ambiguous selector as the expected failure.
- [ ] Add only the stable accessibility label or `data-testid` required by that failure.
- [ ] Repeat until public application, Admin qualification/account creation, mailbox activation, and engineer login pass.
- [ ] Run the scenario twice from clean state to prove repeatability.
- [ ] Commit the onboarding journey.

### Task 4: Service-Order Lifecycle Browser Journey

**Files:**
- Create: `e2e/tests/service-order-lifecycle.spec.mjs`
- Modify only the affected UI components when stable selectors are missing.

- [ ] Register a customer through the browser using the development verification code.
- [ ] Create a service request and record its order number.
- [ ] Assign the activated engineer in Admin.
- [ ] Accept and price the request in the engineer workspace.
- [ ] Confirm quote and payment method as the customer.
- [ ] Confirm advance payment in Admin.
- [ ] Submit the service record as the engineer.
- [ ] Rate the completed service as the customer.
- [ ] Record the payout as Admin and assert the terminal state.
- [ ] Run both journeys twice from clean state.
- [ ] Commit the lifecycle journey.

### Task 5: CI Gate and Documentation

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `DEPLOY.md`
- Modify: `TECH-SPEC.md`

- [ ] Add an E2E CI job with browser caching and failure artifacts.
- [ ] Make production deployment jobs depend on E2E only after both journeys are stable.
- [ ] Document local execution, isolation guarantees, and troubleshooting.
- [ ] Run Worker tests, frontend lint/tests/build, Admin tests/build, and the complete E2E suite.
- [ ] Commit and publish through the normal deployment process.
