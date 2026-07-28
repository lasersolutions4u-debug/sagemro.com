# SAGEMRO Customer Service Promise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SAGEMRO's service advantage visible before selection and provable during service through the AI start page, About SAGEMRO, and customer work-order milestones.

**Architecture:** Keep one bilingual frontend copy source for the public brand framework, derive customer milestones on the Worker from verified progress only, and render a compact promise section on the start page plus a full explanation in About. Customer work-order detail receives a deliberately restricted `public_service_milestones` projection.

**Tech Stack:** React 19, Vite, Tailwind CSS, Cloudflare Workers/D1, Node.js 24 tests, Playwright.

## Global Constraints

- This plan depends on `2026-07-29-sagemro-service-standard-core.md`.
- Customer-visible completion state must come only from persisted progress, customer confirmation, Admin confirmation, or system business events.
- Never send internal item ownership, blocking logic, AI observations, payment follow-up, override reasons, internal notes, or protected media references to customer clients.
- Use the approved promise: “每一次服务，都有准备、有依据、有验证、有交付。” / “Every service is prepared, evidence-based, verified, and clearly delivered.”
- The start-page promise module appears after the current AI hero and before public resources.
- About remains a modal; do not introduce a new router or public page in this release.
- Use one data module for English/Chinese names and value statements.

---

## File Structure

- Create `frontend/src/data/servicePromise.js`: bilingual six-step names, promise, and four customer values.
- Create `frontend/src/components/Customer/ServicePromiseSection.jsx`: compact start-page “Why SAGEMRO.”
- Create `frontend/src/components/WorkOrder/CustomerServiceMilestones.jsx`: customer six-step progress.
- Modify `frontend/src/components/Chat/WelcomePage.jsx`: approved promise placement.
- Modify `frontend/src/components/common/AboutModal.jsx`: complete Precision Service Loop explanation.
- Modify `worker/src/index.js`: role-specific public milestone projection in work-order detail.
- Create `worker/tests/service-standard-public-api.test.mjs`: customer data-minimization contract.
- Create `frontend/tests/service-promise-contract.test.mjs`: placement/copy/visibility contracts.
- Modify `e2e/tests/service-order-lifecycle.spec.mjs`: customer-facing milestone flow.

### Task 1: Shared Bilingual Promise Content

**Files:**
- Create: `frontend/src/data/servicePromise.js`
- Create: `frontend/tests/service-promise-contract.test.mjs`

**Interfaces:**
- Produces: `getServicePromiseCopy(isCn)` with `promise`, `values`, and `steps`.
- Consumes: no API state.

- [ ] **Step 1: Write a failing copy contract**

```js
test('service promise exposes one approved bilingual six-step framework', async () => {
  const { getServicePromiseCopy } = await import('../src/data/servicePromise.js');
  const zh = getServicePromiseCopy(true);
  const en = getServicePromiseCopy(false);
  assert.equal(zh.steps.length, 6);
  assert.equal(en.steps.length, 6);
  assert.equal(zh.promise, '每一次服务，都有准备、有依据、有验证、有交付。');
  assert.equal(en.promise, 'Every service is prepared, evidence-based, verified, and clearly delivered.');
  assert.deepEqual(zh.steps.map((step) => step.key), en.steps.map((step) => step.key));
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

```bash
cd frontend
node --test tests/service-promise-contract.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the shared copy source**

```js
const STEP_KEYS = [
  'task_alignment',
  'risk_control',
  'one_visit_readiness',
  'evidence_execution',
  'recovery_verification',
  'transparent_handover',
];

const COPY = {
  zh: {
    promise: '每一次服务，都有准备、有依据、有验证、有交付。',
    values: [
      { key: 'risk', title: '更早发现风险', detail: 'AI 整理事实，专业人员确认边界。' },
      { key: 'ready', title: '更充分地准备', detail: '减少信息缺失和不必要的重复上门。' },
      { key: 'evidence', title: '每一步有证据', detail: '诊断、处理和验证过程可追溯。' },
      { key: 'asset', title: '让服务形成资产', detail: '报告进入持续关联的设备服务档案。' },
    ],
    steps: [
      ['任务对齐', '到场前，把问题说清楚'],
      ['风险锁定', '动手前，把风险控住'],
      ['一次备齐', '出发前，把资源准备充分'],
      ['循证执行', '服务中，每一步都有依据'],
      ['恢复验证', '交付前，用结果证明恢复'],
      ['透明交付', '完工后，让服务形成闭环'],
    ],
  },
  en: {
    promise: 'Every service is prepared, evidence-based, verified, and clearly delivered.',
    values: [
      { key: 'risk', title: 'See risk earlier', detail: 'AI organizes facts; qualified people confirm the boundary.' },
      { key: 'ready', title: 'Prepare more completely', detail: 'Reduce missing information and avoidable repeat visits.' },
      { key: 'evidence', title: 'Keep evidence at every step', detail: 'Diagnosis, actions, and verification remain traceable.' },
      { key: 'asset', title: 'Turn service into an asset', detail: 'Reports stay connected to the equipment service record.' },
    ],
    steps: [
      ['Task Alignment', 'Clarify the issue before arrival'],
      ['Risk Control', 'Control risk before action'],
      ['One-Visit Readiness', 'Prepare resources before departure'],
      ['Evidence-Based Execution', 'Keep evidence for every action'],
      ['Recovery Verification', 'Prove the result before handover'],
      ['Transparent Handover', 'Close the loop with a clear record'],
    ],
  },
};

export function getServicePromiseCopy(isCn) {
  const copy = isCn ? COPY.zh : COPY.en;
  return {
    ...copy,
    steps: copy.steps.map(([title, detail], index) => ({
      key: STEP_KEYS[index],
      number: index + 1,
      title,
      detail,
    })),
  };
}
```

- [ ] **Step 4: Run the test and commit**

```bash
cd frontend
node --test tests/service-promise-contract.test.mjs
```

Expected: PASS.

```bash
git add frontend/src/data/servicePromise.js frontend/tests/service-promise-contract.test.mjs
git commit -m "feat(frontend): define customer service promise"
```

### Task 2: Start-Page “Why SAGEMRO”

**Files:**
- Create: `frontend/src/components/Customer/ServicePromiseSection.jsx`
- Modify: `frontend/src/components/Chat/WelcomePage.jsx:1-76`
- Modify: `frontend/tests/service-promise-contract.test.mjs`

**Interfaces:**
- Consumes: `getServicePromiseCopy`.
- Produces: compact four-value module and `onOpenAbout` action.

- [ ] **Step 1: Add a failing placement contract**

```js
assert.match(welcome, /<ServicePromiseSection/);
assert.match(welcome, /<ServicePromiseSection[\s\S]*t\.resourceTitle/);
assert.match(chatArea, /<WelcomePage onOpenAbout=\{onOpenAbout\}/);
```

- [ ] **Step 2: Implement the compact section**

Props:

```js
{ isCn, onOpenAbout }
```

Render:

- heading `为什么选择 SAGEMRO` / `Why choose SAGEMRO`;
- approved promise;
- four value cards;
- button `了解六步服务标准` / `Explore our six-step standard`.

Use existing CSS variables and Lucide icons already installed; do not add a dependency.

- [ ] **Step 3: Thread the About callback**

Change:

```jsx
<WelcomePage onOpenAbout={onOpenAbout} />
```

and render `ServicePromiseSection` after the hero text and before the existing public-resource container.

- [ ] **Step 4: Verify responsive layout**

The four values use one column on narrow screens and two columns at `sm`. The About button must remain a native button with visible focus styles.

- [ ] **Step 5: Run frontend verification and commit**

```bash
cd frontend
npm run lint
node --test tests/service-promise-contract.test.mjs
npm run build
```

Expected: all commands exit 0.

```bash
git add frontend/src/components/Customer/ServicePromiseSection.jsx frontend/src/components/Chat/WelcomePage.jsx frontend/src/components/Chat/ChatArea.jsx frontend/tests/service-promise-contract.test.mjs
git commit -m "feat(frontend): explain why customers choose SAGEMRO"
```

### Task 3: Full About SAGEMRO Explanation

**Files:**
- Modify: `frontend/src/components/common/AboutModal.jsx:1-175`
- Modify: `frontend/tests/service-promise-contract.test.mjs`

**Interfaces:**
- Consumes: `getServicePromiseCopy`.
- Produces: full six-step customer explanation without duplicating copy.

- [ ] **Step 1: Add a failing About contract**

```js
assert.match(about, /getServicePromiseCopy/);
assert.match(about, /servicePromise\.steps\.map/);
assert.match(about, /SAGEMRO Precision Service Loop/);
assert.doesNotMatch(about, /engineer_role|blocking_items|override_reason/);
```

- [ ] **Step 2: Add the Precision Service Loop section**

Place it after “How It Works” and before the current AI capabilities section. Render:

- section eyebrow `OUR SERVICE STANDARD`;
- localized title;
- approved promise;
- six numbered steps with title and customer-value detail.

- [ ] **Step 3: Clarify AI and human responsibilities**

Retain the current AI-boundary copy and add one localized sentence:

```js
zh: 'AI 帮助整理信息和提示风险；工程师、Admin 与客户的实际确认构成服务记录。',
en: 'AI helps organize information and flag risk; actual confirmations by engineers, Admin, and customers form the service record.',
```

- [ ] **Step 4: Run focused tests and commit**

```bash
cd frontend
node --test tests/service-promise-contract.test.mjs
npm run lint
npm run build
```

Expected: all commands exit 0.

```bash
git add frontend/src/components/common/AboutModal.jsx frontend/tests/service-promise-contract.test.mjs
git commit -m "feat(frontend): add precision service loop to About"
```

### Task 4: Customer-Safe Public Milestone API

**Files:**
- Modify: `worker/src/index.js:5834-6110`
- Create: `worker/tests/service-standard-public-api.test.mjs`
- Modify: `worker/package.json`

**Interfaces:**
- Consumes: core-plan `loadServiceStandardSnapshot` and `buildPublicServiceMilestones`.
- Produces: `public_service_milestones` on customer work-order detail only.

- [ ] **Step 1: Write a failing customer data-minimization test**

```js
const customerDetail = await api(env, '/api/workorders/wo-1', {
  userId: 'customer-1', userType: 'customer',
});
assert.equal(customerDetail.response.status, 200);
assert.equal(customerDetail.json.public_service_milestones.length, 6);
assert.deepEqual(Object.keys(customerDetail.json.public_service_milestones[0]).sort(), [
  'key', 'state',
]);
for (const forbidden of [
  'service_standard', 'blocking_items', 'owner_type', 'confirmed_by_id',
  'not_applicable_reason', 'overrides', 'guidance',
]) {
  assert.equal(forbidden in customerDetail.json, false);
}
```

- [ ] **Step 2: Run the test and verify milestones are missing**

```bash
cd worker
node --test tests/service-standard-public-api.test.mjs
```

Expected: FAIL because `public_service_milestones` is absent.

- [ ] **Step 3: Add the projection at the API boundary**

In `handleGetWorkOrder`, derive an explicit role boundary:

```js
const isCustomerDetail = request._auth?.userType === 'customer';
const publicServiceMilestones = isCustomerDetail
  ? buildPublicServiceMilestones(await loadServiceStandardSnapshot(env, workOrder))
  : null;
```

Add to `detail` only through:

```js
...(isCustomerDetail ? { public_service_milestones: publicServiceMilestones } : {}),
```

Do not attach the internal snapshot to `detail`.

- [ ] **Step 4: Test legacy and active work orders**

Assert:

- an active new work order has one `current` milestone;
- previous legacy stages are `legacy_not_recorded`, never `completed`;
- completed historical work orders do not fabricate verification;
- another customer receives 403 and no milestone data.

- [ ] **Step 5: Run tests and commit**

```bash
cd worker
node --test tests/service-standard-public-api.test.mjs tests/service-standard-api.test.mjs
```

Expected: all tests PASS.

Add the public API test to `worker/package.json`.

```bash
git add worker/src/index.js worker/tests/service-standard-public-api.test.mjs worker/package.json
git commit -m "feat(worker): expose customer-safe service milestones"
```

### Task 5: Customer Work-Order Milestones

**Files:**
- Create: `frontend/src/components/WorkOrder/CustomerServiceMilestones.jsx`
- Modify: `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`
- Modify: `frontend/tests/service-promise-contract.test.mjs`

**Interfaces:**
- Consumes: `milestones` and `getServicePromiseCopy`.
- Produces: customer-only six-step rail and current milestone message.

- [ ] **Step 1: Add failing render contracts**

```js
assert.match(detailModal, /<CustomerServiceMilestones/);
assert.match(detailModal, /userType === 'customer'/);
assert.match(detailModal, /public_service_milestones/);
assert.doesNotMatch(milestones, /blocking_items|owner_type|guidance/);
```

- [ ] **Step 2: Implement the milestone component**

Props:

```js
{ isCn, milestones }
```

States:

- `completed`: green check;
- `current`: orange active step;
- `upcoming`: neutral;
- `legacy_not_recorded`: neutral with localized “Earlier service records were not itemized” explanation.

Do not infer completed steps from work-order status in React.

- [ ] **Step 3: Place it in customer detail**

Render immediately below the work-order status/header summary and above internal detail tabs. Do not render for engineers or Admin.

In `WorkOrderDetailModal`, pass the role-safe projection explicitly:

```jsx
{userType === 'customer' && (
  <CustomerServiceMilestones
    isCn={isCnLocale()}
    milestones={detail.public_service_milestones || []}
  />
)}
```

The current-step panel may show:

- localized stage title and value statement;
- existing public work-order status;
- a generic “Check Messages for any information SAGEMRO needs from you” link/action.

Do not show raw AI questions until a human sends them as a normal work-order message.

- [ ] **Step 4: Run frontend checks and commit**

```bash
cd frontend
npm run lint
npm test
npm run build
```

Expected: all commands exit 0.

```bash
git add frontend/src/components/WorkOrder/CustomerServiceMilestones.jsx frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx frontend/tests/service-promise-contract.test.mjs
git commit -m "feat(frontend): show verified customer service milestones"
```

### Task 6: Customer Journey E2E and Release Verification

**Files:**
- Modify: `e2e/tests/service-order-lifecycle.spec.mjs`
- Modify: `e2e/tests/quote-execution-visual.spec.mjs`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: public-promise and customer-milestone release evidence.

- [ ] **Step 1: Test the public start-page promise**

Assert English and Chinese hosts show:

- “Why choose SAGEMRO” / “为什么选择 SAGEMRO”;
- the approved promise;
- four value cards;
- About opens to the six-step section.

- [ ] **Step 2: Test customer milestones through one lifecycle**

Use the existing service-order journey:

1. customer creates a work order;
2. engineer confirms required items;
3. Admin approves start;
4. engineer records execution and verification;
5. customer sees the public milestone advance.

At each point, query D1 and compare the persisted progress with the UI milestone state.

- [ ] **Step 3: Test absence of internal data**

Capture the customer detail API response and assert serialized JSON does not contain:

```text
blocking_items
confirmed_by_id
not_applicable_reason
trigger_reason
guidance_json
review_json
```

- [ ] **Step 4: Capture desktop and mobile visuals**

Capture:

- start-page promise section;
- About six-step explanation;
- active customer milestone rail;
- legacy-work-order explanation.

- [ ] **Step 5: Run focused E2E**

```bash
cd e2e
npm run prepare:local
E2E_TEST_SECRET=local-e2e-secret-32-characters \
  npx playwright test tests/service-order-lifecycle.spec.mjs tests/quote-execution-visual.spec.mjs
```

Expected: both specs PASS.

- [ ] **Step 6: Run complete repository verification**

```bash
cd worker && npm test
cd ../frontend && npm run lint && npm test && npm run build
cd ../admin && npm test && npm run build
cd ../e2e && npm test
git diff --check
```

Expected: every command exits 0 and `git diff --check` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add e2e/tests/service-order-lifecycle.spec.mjs e2e/tests/quote-execution-visual.spec.mjs
git commit -m "test(e2e): verify customer service promise journey"
```
