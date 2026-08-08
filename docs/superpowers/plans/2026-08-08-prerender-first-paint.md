# Prerender First-Paint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-default public prerender paint with a small branded, crawlable first screen on both public domains.

**Architecture:** Extend the existing static document renderer with namespaced critical CSS and structured shell classes. Keep the current React replacement lifecycle and all SEO-visible content intact.

**Tech Stack:** Node.js ES modules, generated HTML, CSS, Node test runner, Vite.

## Global Constraints

- No new dependency or runtime request.
- Do not hide, remove, or change crawlable page content.
- Do not alter React startup, public copy, metadata, schema, routing, or deployment configuration.
- Use `/sagemro-logo.png` as the only shell logo.

---

### Task 1: Lock the first-paint contract

**Files:**
- Modify: `frontend/tests/public-seo-routes.test.mjs`

**Interfaces:**
- Consumes: `renderPublicDocument(template, route, locale)`.
- Produces: assertions for the critical style, branded shell classes, approved logo, visible content, and forbidden hiding rules.

- [ ] **Step 1: Write the failing test**

Add assertions that generated HTML contains `data-seo-shell-critical`, `seo-static-shell__brand`, `seo-static-shell__resources`, `/sagemro-logo.png`, and no shell hiding declarations.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/public-seo-routes.test.mjs`

Expected: FAIL because the renderer does not emit the critical style or structured shell classes.

### Task 2: Render the branded crawlable shell

**Files:**
- Modify: `frontend/scripts/publicPageRenderer.mjs`

**Interfaces:**
- Consumes: the existing route body model.
- Produces: the same public HTML document contract plus namespaced critical CSS and shell classes.

- [ ] **Step 1: Add minimal renderer markup and critical CSS**

Emit a single namespaced critical style in `<head>`. Structure the existing content into brand, copy, and resource areas without changing its text.

- [ ] **Step 2: Run focused tests**

Run: `node --test tests/public-seo-routes.test.mjs tests/seo-contract.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 3: Build and inspect generated documents**

Run: `npm run build && node --test tests/public-bundle-contract.test.mjs`

Expected: build exits 0 and the public bundle contract passes.

### Task 3: Regression and cold-paint verification

**Files:**
- Verify only; no additional production files.

**Interfaces:**
- Consumes: built English and Chinese documents.
- Produces: evidence that both generated entry documents carry the visible branded shell contract.

- [ ] **Step 1: Run the full frontend test and lint gate**

Run: `npm run lint --if-present && npm test && npm run build`

Expected: exit 0 with no failed tests.

- [ ] **Step 2: Confirm the diff is surgical**

Run: `git diff --check && git status --short`

Expected: only the renderer, its tests, and these planning documents are changed.

- [ ] **Step 3: Deploy both markets and inspect production**

After the normal `main` and `china-edition` merge/deploy flows, fetch each homepage with JavaScript disabled or throttled and verify that the branded shell appears without browser-default text.
