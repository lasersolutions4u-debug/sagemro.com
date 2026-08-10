# Work Order Detail Section Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Admin work-order Messages and Reviews into independent sections and present all detail sections in the confirmed service-workflow order in English and Simplified Chinese.

**Architecture:** Keep the existing `WorkOrderDetailNav` and `WorkOrderDetailSection` components. Make a surgical change to the locale dictionaries, navigation item array, JSX section boundaries, and the default-expansion helper; use existing tests to lock down names, order, uniqueness, stable keys, and removal of the combined legacy key. Port the verified commit from the international branch to `china-edition` and retain China-only logic.

**Tech Stack:** React, Vite, Node.js built-in test runner, Git branches/worktrees.

## Global Constraints

- Exact order: Overview, Messages, Dispatch, Quote, Service Controls, Service Operations, Reviews.
- Exact Chinese order: 概览、沟通记录、派工、报价清单、服务标准、作业管理、服务评价.
- No workflow, API, schema, permission, message-storage, or review-storage changes.
- Customer review, engineer review, and message timeline render exactly once.
- No deployment in this implementation pass.

---

### Task 1: Split and reorder international Admin detail sections

**Files:**
- Modify: `admin/src/pages/WorkOrdersPage.review-flow.test.mjs`
- Modify: `admin/src/pages/WorkOrdersPage.jsx`
- Modify: `admin/src/pages/workOrderDetailView.test.mjs`
- Modify: `admin/src/pages/workOrderDetailView.js`

**Interfaces:**
- Consumes: existing `WorkOrderDetailNav`, `WorkOrderDetailSection`, `openDetailSections`, `toggleDetailSection`, `detailMessages`, and review fields on `detail`.
- Produces: stable section keys `overview`, `messages`, `dispatch`, `quote`, `service-controls`, `service-operations`, and `reviews`; locale keys `messages` and `reviews` replace `reviewsMessages`.

- [ ] **Step 1: Write the failing source-contract test**

Add a test that extracts the `WorkOrderDetailNav` block and the ordered `WorkOrderDetailSection` keys, then asserts:

```js
assert.deepEqual(
  [...nav.matchAll(/\['([^']+)', t\.detailNav\.[A-Za-z]+\]/g)].map((match) => match[1]),
  ['overview', 'messages', 'dispatch', 'quote', 'service-controls', 'service-operations', 'reviews'],
);
assert.deepEqual(
  [...drawer.matchAll(/sectionKey="([^"]+)"/g)].map((match) => match[1]),
  ['overview', 'messages', 'dispatch', 'quote', 'service-controls', 'service-operations', 'reviews'],
);
assert.match(source, /messages: 'Messages'/);
assert.match(source, /messages: '沟通记录'/);
assert.match(source, /reviews: 'Reviews'/);
assert.match(source, /reviews: '服务评价'/);
assert.doesNotMatch(source, /reviewsMessages|reviews-messages/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd admin && node --test src/pages/WorkOrdersPage.review-flow.test.mjs
```

Expected: FAIL because the source still contains `reviewsMessages`, `reviews-messages`, and the old navigation/section order.

- [ ] **Step 3: Apply the minimal locale and navigation change**

Replace each locale's combined label with independent labels:

```js
messages: 'Messages',
reviews: 'Reviews',
```

```js
messages: '沟通记录',
reviews: '服务评价',
```

Set the shortcut items to:

```js
[
  ['overview', t.detailNav.overview],
  ['messages', t.detailNav.messages],
  ['dispatch', t.detailNav.dispatch],
  ['quote', t.detailNav.quote],
  ['service-controls', t.detailNav.serviceControls],
  ['service-operations', t.detailNav.filesReport],
  ['reviews', t.detailNav.reviews],
]
```

- [ ] **Step 4: Split and move the existing JSX without changing its business logic**

Create an independent Messages disclosure immediately after Overview:

```jsx
<WorkOrderDetailSection
  sectionKey="messages"
  title={t.detailNav.messages}
  open={openDetailSections.has('messages')}
  onToggle={toggleDetailSection}
>
  <section>{/* Move the current message timeline and note composer here verbatim. */}</section>
</WorkOrderDetailSection>
```

Keep Dispatch before Quote in source order. Rename the former `files-report` section key to `service-operations` while retaining the established Service Operations / 作业管理 labels. End with an independent Reviews disclosure:

```jsx
<WorkOrderDetailSection
  sectionKey="reviews"
  title={t.detailNav.reviews}
  open={openDetailSections.has('reviews')}
  onToggle={toggleDetailSection}
>
  <section>{/* Move the current customer review card here verbatim. */}</section>
  <section>{/* Move the current engineer review card here verbatim. */}</section>
</WorkOrderDetailSection>
```

Update the field-work default expansion to the new stable key:

```js
if (detail.status === 'in_service' && detail.field_plan?.site_timezone) open.push('service-operations');
```

Update `workOrderDetailView.test.mjs` to assert that an in-service field plan opens `service-operations` and does not return the retired `files-report` key.

- [ ] **Step 5: Run focused and full Admin verification**

Run:

```bash
cd admin && node --test src/pages/WorkOrdersPage.review-flow.test.mjs
cd admin && npm test
cd admin && npm run build
```

Expected: all tests pass and Vite production build exits 0.

- [ ] **Step 6: Commit the verified international change**

```bash
git add admin/src/pages/WorkOrdersPage.jsx admin/src/pages/WorkOrdersPage.review-flow.test.mjs admin/src/pages/workOrderDetailView.js admin/src/pages/workOrderDetailView.test.mjs
git commit -m "fix(admin): separate work-order messages and reviews"
```

### Task 2: Port and verify the China edition

**Files:**
- Modify by cherry-pick: `admin/src/pages/WorkOrdersPage.jsx`
- Modify by cherry-pick: `admin/src/pages/WorkOrdersPage.review-flow.test.mjs`
- Modify by cherry-pick: `admin/src/pages/workOrderDetailView.js`
- Modify by cherry-pick: `admin/src/pages/workOrderDetailView.test.mjs`

**Interfaces:**
- Consumes: Task 1 commit and existing China-only currency, invoice, address, payout, and service-detail behavior.
- Produces: the same seven section keys and bilingual labels on `codex/rename-service-operations-cn` without changing China-only behavior.

- [ ] **Step 1: Switch to the prepared China branch and cherry-pick Task 1**

```bash
git switch codex/rename-service-operations-cn
git cherry-pick <task-1-commit>
```

Expected: either a clean cherry-pick or a localized conflict inside the two touched files. If a conflict occurs, preserve all China-only code and apply only the locale/navigation/section-boundary changes from Task 1.

- [ ] **Step 2: Run China Admin tests and build**

Run:

```bash
cd admin && npm test
cd admin && npm run build -- --mode cn
```

Expected: all tests pass and the China Vite production build exits 0.

- [ ] **Step 3: Verify branch scope and working-tree cleanliness**

Run:

```bash
git diff origin/china-edition...HEAD -- admin/src/pages/WorkOrdersPage.jsx admin/src/pages/WorkOrdersPage.review-flow.test.mjs docs/superpowers
git status --short --branch
```

Expected: only the approved detail-navigation work plus the already approved Service Operations / 作业管理 rename and its documents are ahead of `origin/china-edition`; the working tree is clean.
