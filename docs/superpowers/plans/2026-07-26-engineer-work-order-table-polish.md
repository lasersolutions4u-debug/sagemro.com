# Engineer Work Order Table Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the desktop work-order grid and deliver a compact, aligned eight-column table with readable task and equipment text.

**Architecture:** Keep the existing responsive component structure. Change only the explicit desktop grid template and cell wrapping rules, then enforce the template through the existing source-contract test. Preserve mobile markup, events, data flow, and detail behavior.

**Tech Stack:** React, Tailwind CSS arbitrary grid templates, Node test runner, ESLint, Vite.

---

### Task 1: Lock the eight-column desktop contract

**Files:**
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`

- [ ] **Step 1: Write the failing test**

Replace the current seven-column grid assertion with an eight-column template assertion:

```js
assert.match(list, /grid-cols-\[132px_minmax\(240px,1\.55fr\)_minmax\(110px,\.75fr\)_minmax\(260px,1\.55fr\)_minmax\(120px,\.8fr\)_minmax\(150px,\.9fr\)_118px_36px\]/);
assert.match(list, /line-clamp-2 text-\[15px\]/);
assert.match(list, /whitespace-nowrap text-xs text-\[#697386\]/);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
cd frontend
node --test --test-name-pattern="engineer list keeps key fields readable" tests/engineer-work-order-experience-contract.test.mjs
```

Expected: FAIL because the component still defines only seven explicit columns.

### Task 2: Implement the compact eight-column row

**Files:**
- Modify: `frontend/src/components/Engineer/EngineerWorkOrderList.jsx`

- [ ] **Step 1: Define all eight columns in header and row**

Use this template for both desktop header and desktop row:

```text
132px minmax(240px,1.55fr) minmax(110px,.75fr) minmax(260px,1.55fr) minmax(120px,.8fr) minmax(150px,.9fr) 118px 36px
```

- [ ] **Step 2: Balance wrapping and alignment**

Apply these rules:

```jsx
<strong className="min-w-0 line-clamp-2 text-[15px] leading-5 text-[#18202b]">...</strong>
<span className="min-w-0 line-clamp-2 text-[13px] leading-5 text-[#697386]">...</span>
<span className="min-w-0 truncate text-xs text-[#697386]">...</span>
<span className="whitespace-nowrap text-xs text-[#697386]">...</span>
```

Keep the row `items-center`, set `min-h-[84px]`, and retain the fixed arrow cell as the eighth child.

- [ ] **Step 3: Run the focused test to verify it passes**

Run the Task 1 command again. Expected: PASS.

### Task 3: Verify both release variants

**Files:**
- Modify: `frontend/src/components/Engineer/EngineerWorkOrderList.jsx` on `china-edition`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs` on `china-edition`

- [ ] **Step 1: Apply the identical focused changes to the China release branch**

Copy only the component grid/wrapping changes and the matching contract assertions.

- [ ] **Step 2: Run frontend verification in both worktrees**

Run in each `frontend/` directory:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Capture visual evidence**

Run the local Engineer portal with the existing review fixtures, capture desktop at 2048×768 and mobile at 390×844, and verify:

- one visual row per work order;
- arrow remains in the far-right column;
- updated time remains one line;
- task and equipment show up to two lines;
- mobile cards do not regress.

### Task 4: Release

**Files:**
- No additional source files.

- [ ] **Step 1: Inspect and commit each release branch**

```bash
git diff --check
git status --short
git add frontend/src/components/Engineer/EngineerWorkOrderList.jsx frontend/tests/engineer-work-order-experience-contract.test.mjs
git commit -m "fix(engineer): align work-order table"
```

- [ ] **Step 2: Push and deploy**

Push the international commit to `main`, push the China commit to `china-edition`, monitor `deploy.yml`, then trigger `aliyun-cn-deploy.yml` for the real China production release.

- [ ] **Step 3: Smoke check production**

Confirm HTTP 200 from both Engineer hosts and both API health endpoints.
