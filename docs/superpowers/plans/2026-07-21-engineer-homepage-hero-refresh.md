# Engineer Homepage Hero Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Industrial Editorial hero layout, remove the standalone AI safety notice, and convert the cooperation summary into a responsive dark information band on both engineer production sites.

**Architecture:** Keep the change inside the existing bilingual `EngineerRecruitingPage` component. Update source-level contract tests first, then make a presentation-only JSX and Tailwind class change, verify the production build in a real browser, and apply the same shared files to `main` while retaining the China-only contract on `china-edition`.

**Tech Stack:** React 19, Tailwind CSS 4, Lucide React, Node test runner, Vite, Playwright CLI, GitHub Actions, Cloudflare Pages, Aliyun ECS.

---

## File Structure

- Modify `frontend/src/components/Engineer/EngineerRecruitingPage.jsx`: remove unused safety content and icon, rebuild the hero classes and workflow rail, and restyle the audience summary.
- Modify `frontend/tests/brand-assets-contract.test.mjs`: replace old safety and hero-card expectations with the approved editorial layout and dark-band contracts.
- Modify `frontend/tests/cn-primary-ui-language-contract.test.mjs`: remove China safety-copy expectations and retain localized audience and action checks. This file stays on `china-edition` only.
- Modify `frontend/tests/engineer-overview-video-contract.test.mjs`: remove the obsolete requirement that the recruiting page render `copy.safetyTitle`; retain the video position and detailed-content contracts.

No new runtime component or CSS file is required.

### Task 1: Lock The Approved Layout In Failing Contracts

**Files:**
- Modify: `frontend/tests/brand-assets-contract.test.mjs:506`
- Modify: `frontend/tests/cn-primary-ui-language-contract.test.mjs:172`
- Modify: `frontend/tests/engineer-overview-video-contract.test.mjs:51`

- [ ] **Step 1: Replace the old safety and hero-card expectations in the common contract**

In `frontend/tests/brand-assets-contract.test.mjs`, remove these assertions:

```js
assert.match(recruiting, /不要忽略的重要提示：内容为AI生成，仅供参考/);
assert.match(recruiting, /本页面文案均经人工审核确认/);
assert.match(recruiting, /Important notice: AI-generated content is for reference only/);
assert.match(recruiting, /All copy on this page has been reviewed and approved by people/);
assert.match(recruiting, /服务安全与责任边界/);
assert.match(recruiting, /Service safety and responsibility boundaries/);
assert.match(recruiting, /className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1"/);
```

Add exact contracts for the approved structure:

```js
assert.doesNotMatch(recruiting, /safetyLabel:|safetyTitle:|safetyText:|copy\.safetyTitle|ShieldCheck/);
assert.match(recruiting, /lg:grid-cols-\[minmax\(0,1\.4fr\)_minmax\(18rem,0\.6fr\)\]/);
assert.match(recruiting, /lg:border-l lg:border-t-0 lg:pl-6/);
assert.match(recruiting, /border-l-2 border-amber-500 pl-4/);
assert.match(recruiting, /bg-\[#17110c\] px-6 py-6 text-white/);
assert.match(recruiting, /md:grid-cols-3/);
assert.match(recruiting, /md:border-l md:border-t-0/);
assert.doesNotMatch(recruiting, /rounded-\[2rem\]|blur-2xl|rounded-bl-\[5rem\]/);
```

- [ ] **Step 2: Update the China language contract**

In `frontend/tests/cn-primary-ui-language-contract.test.mjs`, remove:

```js
assert.match(recruiting, /不要忽略的重要提示：内容为AI生成，仅供参考/);
assert.match(recruiting, /本页面文案均经人工审核确认/);
```

Add:

```js
assert.match(recruiting, /audienceTitle: '合作信息一览'/);
assert.match(recruiting, /激光及金属成型设备维保工程师/);
assert.doesNotMatch(recruiting, /safetyLabel:|safetyTitle:|safetyText:/);
```

- [ ] **Step 3: Remove the obsolete video integration assertion**

In `frontend/tests/engineer-overview-video-contract.test.mjs`, remove:

```js
assert.match(source, /copy\.safetyTitle/);
```

Keep the ordering assertion:

```js
assert.ok(source.indexOf('<EngineerOverviewVideo locale={locale} />') < source.indexOf('copy.audienceTitle'));
```

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```bash
cd frontend
node --test \
  tests/brand-assets-contract.test.mjs \
  tests/cn-primary-ui-language-contract.test.mjs \
  tests/engineer-overview-video-contract.test.mjs
```

Expected: FAIL because `EngineerRecruitingPage.jsx` still contains `ShieldCheck`, safety fields, the old rounded hero, and the old audience section.

### Task 2: Implement The Industrial Editorial Hero And Dark Information Band

**Files:**
- Modify: `frontend/src/components/Engineer/EngineerRecruitingPage.jsx:1`
- Modify: `frontend/src/components/Engineer/EngineerRecruitingPage.jsx:43`
- Modify: `frontend/src/components/Engineer/EngineerRecruitingPage.jsx:187`
- Modify: `frontend/src/components/Engineer/EngineerRecruitingPage.jsx:557`

- [ ] **Step 1: Remove the unused safety icon and localized fields**

Remove `ShieldCheck` from the `lucide-react` import.

Remove these three fields from both `COPY.cn` and `COPY.en`:

```js
safetyLabel: '...',
safetyTitle: '...',
safetyText: '...',
```

- [ ] **Step 2: Simplify the first-screen background**

Replace the decorative top background block:

```jsx
<div className="absolute inset-x-0 top-0 h-[520px] overflow-hidden bg-[#14100b]">
  ...
</div>
```

with one restrained field:

```jsx
<div className="absolute inset-x-0 top-0 h-[31rem] bg-[#17110c]" />
```

This removes the gradients, grid texture, blur spot, and curved cutout.

- [ ] **Step 3: Replace the hero panel and grid classes**

Use this outer structure:

```jsx
<section className="overflow-hidden rounded-lg border border-[#e6ded3] bg-white px-6 py-8 shadow-[0_18px_52px_rgba(35,24,14,0.12)] md:px-8 md:py-10 lg:px-10 lg:py-12">
  <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)] lg:items-center lg:gap-10">
```

Use a compact rectangular badge:

```jsx
<div className="inline-flex border border-amber-300 bg-[#fffaf0] px-3 py-2 text-xs font-semibold uppercase text-amber-800">
  {copy.badge}
</div>
```

Use a controlled headline:

```jsx
<h1 className="mt-6 max-w-[46rem] text-4xl font-semibold leading-[1.12] text-[#17110b] md:text-5xl">
  {copy.title}
</h1>
```

Use a readable paragraph width:

```jsx
<p className="mt-5 max-w-[44rem] text-base leading-8 text-[#76695d]">
  {copy.subtitle}
</p>
```

Keep the existing actions and handlers, but change both action radii to `rounded-lg` and add `whitespace-nowrap` to both controls.

- [ ] **Step 4: Replace the hero cards with one compact workflow rail**

Replace the bordered flow-card wrapper and connector arrows with:

```jsx
<div className="border-t border-[#e6d8c7] pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
  <div className="grid gap-5">
    {copy.heroFlow.map((item, index) => (
      <div key={item.role} className="border-l-2 border-amber-500 pl-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase text-amber-800">{item.role}</div>
          <div className="font-mono text-xs text-[#a68d70]">0{index + 1}</div>
        </div>
        <div className="mt-2 text-base font-semibold text-[#21160c]">{item.title}</div>
        <div className="mt-1 text-xs leading-5 text-[#7d6a56]">{item.text}</div>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 5: Delete the standalone safety section**

Delete the complete JSX section containing:

```jsx
{copy.safetyLabel}
{copy.safetyTitle}
{copy.safetyText}
```

- [ ] **Step 6: Replace the audience summary with the dark information band**

Use:

```jsx
<section className="mt-6 bg-[#17110c] px-6 py-6 text-white md:px-8">
  <h2 className="text-xs font-semibold uppercase text-amber-300">{copy.audienceTitle}</h2>
  <div className="mt-5 grid md:grid-cols-3">
    {copy.audienceItems.map((item, index) => (
      <div
        key={item.label}
        className={`border-t border-white/15 py-5 md:border-l md:border-t-0 md:px-6 md:py-1 ${index === 0 ? 'md:border-l-0 md:pl-0' : ''}`}
      >
        <div className="text-xs font-semibold uppercase text-amber-400">{item.label}</div>
        <p className="mt-2 text-sm leading-6 text-white/70">{item.value}</p>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
cd frontend
node --test \
  tests/brand-assets-contract.test.mjs \
  tests/cn-primary-ui-language-contract.test.mjs \
  tests/engineer-overview-video-contract.test.mjs
```

Expected: all focused tests PASS.

- [ ] **Step 8: Commit the China implementation**

Run:

```bash
git add \
  frontend/src/components/Engineer/EngineerRecruitingPage.jsx \
  frontend/tests/brand-assets-contract.test.mjs \
  frontend/tests/cn-primary-ui-language-contract.test.mjs \
  frontend/tests/engineer-overview-video-contract.test.mjs
git commit -m "feat(frontend): refine engineer homepage hero"
```

Expected: the commit contains only the component and three contract files.

### Task 3: Verify The Bilingual Production Build Visually

**Files:**
- No tracked files.
- Store local artifacts under ignored `output/playwright/engineer-hero-refresh/`.

- [ ] **Step 1: Run the complete local release gate**

Run in parallel where possible:

```bash
cd frontend && npm run lint && npm test && npm run build
cd worker && npm test
cd admin && npm run build
```

Expected:

- Frontend lint exits `0`.
- All frontend tests pass.
- Frontend production build exits `0`.
- Worker tests and Golden set pass.
- Admin production build exits `0`.

- [ ] **Step 2: Start a local production server**

Run:

```bash
cd frontend
python3 -m http.server 4175 --bind 0.0.0.0 --directory dist
```

Use a Playwright session configured with:

```json
{
  "browser": {
    "launchOptions": {
      "headless": true,
      "args": [
        "--host-resolver-rules=MAP engineer.sagemro.com 127.0.0.1,MAP engineer.sagemro.cn 127.0.0.1",
        "--no-proxy-server"
      ]
    }
  }
}
```

- [ ] **Step 3: Inspect English desktop and mobile**

Open `http://engineer.sagemro.com:4175` at `1440x1000` and `390x844`.

Verify with DOM measurements:

```js
({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  safetyNoticePresent: document.body.innerText.includes('AI-generated content is for reference only'),
  audiencePresent: document.body.innerText.includes('Cooperation at a glance'),
  heroButtons: [...document.querySelectorAll('button, a')]
    .filter((node) => ['Apply to Join', 'See How Cooperation Works'].includes(node.textContent.trim()))
    .map((node) => ({
      text: node.textContent.trim(),
      whiteSpace: getComputedStyle(node).whiteSpace,
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    })),
})
```

Expected: `overflow` and `safetyNoticePresent` are `false`; the audience band is present; button text uses `nowrap`; `scrollWidth <= clientWidth`.

Save hero and audience screenshots at both viewport widths.

- [ ] **Step 4: Inspect Chinese desktop and mobile**

Repeat Step 3 at `http://engineer.sagemro.cn:4175` and verify:

```js
({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  safetyNoticePresent: document.body.innerText.includes('不要忽略的重要提示'),
  audiencePresent: document.body.innerText.includes('合作信息一览'),
})
```

Expected: no overflow, no safety notice, and the dark cooperation band is present. Visually confirm the Chinese headline wraps cleanly without colliding with the workflow rail.

- [ ] **Step 5: Stop the local server and browser sessions**

Stop only the processes started for this task. Keep screenshots under ignored `output/`; do not stage them.

### Task 4: Synchronize Main, Deploy, And Smoke Test Production

**Files:**
- Modify on `main`: `frontend/src/components/Engineer/EngineerRecruitingPage.jsx`
- Modify on `main`: `frontend/tests/brand-assets-contract.test.mjs`
- Modify on `main`: `frontend/tests/engineer-overview-video-contract.test.mjs`

- [ ] **Step 1: Push the China implementation and design commits**

Run:

```bash
git push origin china-edition
```

Expected: `china-edition` pushes both the design-spec commit and implementation commit.

- [ ] **Step 2: Apply shared files to the clean main worktree**

In `/Users/joe/Projects/sagemro.com/.worktrees/beta-readiness-main`, apply only the shared component and common tests. Do not add `cn-primary-ui-language-contract.test.mjs` to `main`.

Verify:

```bash
git status --short --branch
git diff --check
git diff --stat
```

Expected: only the three shared files are modified.

- [ ] **Step 3: Verify and commit main**

Run:

```bash
cd frontend
npm run lint
npm test
npm run build
```

Expected: all commands exit `0`.

Then run:

```bash
git add \
  frontend/src/components/Engineer/EngineerRecruitingPage.jsx \
  frontend/tests/brand-assets-contract.test.mjs \
  frontend/tests/engineer-overview-video-contract.test.mjs
git commit -m "feat(frontend): refine engineer homepage hero"
git push origin main
```

- [ ] **Step 4: Wait for Cloudflare workflows**

Find the `deploy.yml` runs for both pushed SHAs and wait with:

```bash
gh run watch <run-id> --exit-status
```

Expected: both runs complete with `success`.

- [ ] **Step 5: Trigger and watch the China ECS deployment**

Run:

```bash
gh workflow run aliyun-cn-deploy.yml --ref china-edition
gh run watch <aliyun-run-id> --exit-status
```

Expected: build, upload, activation, health checks, and cleanup all succeed; rollback remains skipped.

- [ ] **Step 6: Verify production assets and health**

For each engineer host, resolve the current `EngineerRecruitingPage-*.js` chunk and assert:

```text
engineer.sagemro.com:
- contains "Cooperation at a glance"
- does not contain "Important notice: AI-generated content is for reference only."
- contains the approved editorial grid and dark-band class strings

engineer.sagemro.cn:
- contains "合作信息一览"
- does not contain "不要忽略的重要提示"
- contains the approved editorial grid and dark-band class strings
```

Also run:

```bash
curl -fsSL https://api.sagemro.com/health
curl -fsSL https://api.sagemro.cn/health
```

Expected: both return `{"status":"ok"}`.

- [ ] **Step 7: Confirm final worktree state**

Run:

```bash
git -C /Users/joe/Projects/sagemro.com/.worktrees/engineer-entry-links-cn status --short --branch
git -C /Users/joe/Projects/sagemro.com/.worktrees/beta-readiness-main status --short --branch
```

Expected: both tracked worktrees are synchronized with their remotes. The China worktree may retain only the pre-existing ignored local directories `.playwright-cli/`, `.superpowers/`, and `output/`.
