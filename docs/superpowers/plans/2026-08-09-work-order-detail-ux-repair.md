# Work Order Detail UX Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Admin work-order detail drawer as a summary-first, bilingual, responsive experience that presents only the currently relevant service gate as blocking.

**Architecture:** Keep all backend lifecycle enforcement unchanged. Add a small pure view-model module for current-gate and default-expansion rules, add accessible disclosure/navigation primitives, then reorganize the existing drawer around those primitives. The service-standard panel consumes the pure current-gate selector and presents future and historical controls as neutral audit information.

**Tech Stack:** React 18, Vite 6, Tailwind CSS 4 utility classes, Node.js `node:test`, Cloudflare Pages Admin build.

## Global Constraints

- Apply the same component structure and state rules to international and China Admin deployments.
- Every new or touched static drawer string must exist in English and Simplified Chinese dictionaries.
- Do not change service-standard definitions, server gate enforcement, payment rules, database schema, workflow states, or customer-authored content.
- Preserve existing stale-request guards and mutation handlers.
- Use one vertical scrolling surface in the drawer; do not add a nested vertical scroll to messages.
- Orange communicates the current action/current blocker only; historical and future states are neutral.
- All implementation changes follow red-green-refactor: run each new test and observe it fail before production edits.

---

## File map

- Create `admin/src/pages/workOrderDetailView.js`: pure status-to-gate, current-action, and default-section helpers.
- Create `admin/src/pages/workOrderDetailView.test.mjs`: executable behavior tests for the pure helpers.
- Create `admin/src/components/WorkOrderDetailSection.jsx`: accessible disclosure and sticky shortcut navigation primitives.
- Create `admin/src/components/WorkOrderDetailSection.test.mjs`: source/markup contracts for disclosure, section IDs, keyboard semantics, and scroll behavior.
- Modify `admin/src/components/ServiceStandardAdminPanel.jsx`: current-gate-only warnings, compact progress summary, neutral legacy state, stage disclosures, contextual override.
- Modify `admin/src/components/ServiceStandardAdminPanel.test.mjs`: regression contracts for current gate and override visibility.
- Modify `admin/src/pages/WorkOrdersPage.jsx`: summary-first ordering, shortcuts, grouped sections, bilingual static strings, single message scroll surface.
- Modify `admin/src/pages/WorkOrdersPage.review-flow.test.mjs`: drawer structure, locale, no-duplicate, and no-nested-scroll contracts.
- Modify `admin/package.json`: include the two new test files in `npm test`.

---

### Task 1: Pure work-order detail presentation model

**Files:**
- Create: `admin/src/pages/workOrderDetailView.js`
- Create: `admin/src/pages/workOrderDetailView.test.mjs`
- Modify: `admin/package.json`

**Interfaces:**
- Produces: `currentServiceGateForStatus(status: string): 'start' | 'resolve' | 'handover' | null`
- Produces: `currentWorkOrderActionKey(detail: object): string`
- Produces: `defaultOpenWorkOrderSections(detail: object, options?: { hasCurrentGateBlockers?: boolean }): string[]`
- Consumes: no application state or browser APIs.

- [ ] **Step 1: Add the failing pure behavior tests**

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  currentServiceGateForStatus,
  currentWorkOrderActionKey,
  defaultOpenWorkOrderSections,
} from './workOrderDetailView.js';

test('only the lifecycle transition that can happen next is presented as current', () => {
  assert.equal(currentServiceGateForStatus('payment_review'), 'start');
  assert.equal(currentServiceGateForStatus('in_service'), 'resolve');
  assert.equal(currentServiceGateForStatus('resolved'), 'handover');
  assert.equal(currentServiceGateForStatus('pending_review'), 'handover');
  for (const status of ['pending', 'pending_dispatch', 'assigned', 'in_progress', 'pricing', 'pending_payment', 'completed', 'rejected', 'cancelled']) {
    assert.equal(currentServiceGateForStatus(status), null, status);
  }
});

test('default sections expose the current operator task without expanding the entire record', () => {
  assert.deepEqual(defaultOpenWorkOrderSections({ status: 'pending_dispatch' }), ['overview', 'dispatch']);
  assert.deepEqual(defaultOpenWorkOrderSections({ status: 'payment_review' }), ['overview', 'quote']);
  assert.deepEqual(
    defaultOpenWorkOrderSections({ status: 'in_service' }, { hasCurrentGateBlockers: true }),
    ['overview', 'service-controls'],
  );
  assert.deepEqual(defaultOpenWorkOrderSections({ status: 'completed' }), ['overview']);
});

test('current action keys are locale-independent', () => {
  assert.equal(currentWorkOrderActionKey({ status: 'pending_dispatch' }), 'dispatch');
  assert.equal(currentWorkOrderActionKey({ status: 'payment_review' }), 'approvePaymentStart');
  assert.equal(currentWorkOrderActionKey({ status: 'completed' }), 'complete');
});
```

- [ ] **Step 2: Run the new test and observe RED**

Run: `cd admin && node --test src/pages/workOrderDetailView.test.mjs`
Expected: FAIL because `workOrderDetailView.js` does not exist.

- [ ] **Step 3: Implement the pure helpers**

```js
const CURRENT_GATE_BY_STATUS = Object.freeze({
  payment_review: 'start',
  in_service: 'resolve',
  resolved: 'handover',
  pending_review: 'handover',
});

const ACTION_BY_STATUS = Object.freeze({
  pending: 'dispatch',
  pending_dispatch: 'dispatch',
  assigned: 'dispatch',
  pricing: 'quoteReview',
  pending_payment: 'paymentFollowup',
  payment_review: 'approvePaymentStart',
  in_service: 'monitorService',
  resolved: 'handover',
  pending_review: 'handover',
  completed: 'complete',
});

export function currentServiceGateForStatus(status) {
  return CURRENT_GATE_BY_STATUS[status] || null;
}

export function currentWorkOrderActionKey(detail = {}) {
  return ACTION_BY_STATUS[detail.status] || 'none';
}

export function defaultOpenWorkOrderSections(detail = {}, { hasCurrentGateBlockers = false } = {}) {
  const open = ['overview'];
  if (['pending', 'pending_dispatch', 'assigned'].includes(detail.status)) open.push('dispatch');
  if (detail.pricing?.status === 'pending_review' || ['pricing', 'pending_payment', 'payment_review'].includes(detail.status)) open.push('quote');
  if (hasCurrentGateBlockers) open.push('service-controls');
  return [...new Set(open)];
}
```

- [ ] **Step 4: Register and run the tests GREEN**

Add `src/pages/workOrderDetailView.test.mjs` to the Admin `test` script, then run:

`cd admin && node --test src/pages/workOrderDetailView.test.mjs`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the presentation model**

```bash
git add admin/src/pages/workOrderDetailView.js admin/src/pages/workOrderDetailView.test.mjs admin/package.json
git commit -m "feat(admin): model work-order detail presentation"
```

---

### Task 2: Contextual service-standard presentation

**Files:**
- Modify: `admin/src/components/ServiceStandardAdminPanel.jsx`
- Modify: `admin/src/components/ServiceStandardAdminPanel.test.mjs`

**Interfaces:**
- Consumes: `currentServiceGateForStatus(workOrderStatus)` from Task 1.
- Consumes prop: `workOrderStatus: string` from `WorkOrdersPage`.
- Produces callback: `onBlockerStateChange({ gate: string | null, count: number }): void` so the parent can open the section when current blockers exist.

- [ ] **Step 1: Write failing service-standard panel contracts**

Append tests that require the current-gate selector, forbid flattening all gate blockers, and require contextual override behavior:

```js
test('Admin service controls warn only for the gate relevant to the work-order status', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');
  assert.match(panel, /currentServiceGateForStatus\(workOrderStatus\)/);
  assert.match(panel, /currentGate \? currentSnapshot\?\.gates\?\.\[currentGate\]\?\.blocking_items/);
  assert.doesNotMatch(panel, /GATE_KEYS\.flatMap/);
  assert.match(panel, /onBlockerStateChange/);
});

test('gate overrides are limited to the writable blocked current gate', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');
  assert.match(panel, /!readOnly && currentGate && blockers\.length > 0/);
  assert.match(panel, /overrideAdminWorkOrderServiceStandardGate\(workOrderId, currentGate, trimmedReason\)/);
  assert.doesNotMatch(panel, /<select value=\{gate\}/);
});

test('historical states and future stages use neutral audit presentation', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');
  assert.match(panel, /legacy_not_recorded/);
  assert.match(panel, /historicalHint/);
  assert.match(panel, /<details/);
});
```

- [ ] **Step 2: Run the panel test and observe RED**

Run: `cd admin && node --test src/components/ServiceStandardAdminPanel.test.mjs`
Expected: the new current-gate and contextual-override assertions fail.

- [ ] **Step 3: Replace all-gate flattening with current-gate derivation**

Import the pure selector and derive blockers without changing API data:

```js
import { currentServiceGateForStatus } from '../pages/workOrderDetailView';

export function ServiceStandardAdminPanel({
  workOrderId,
  workOrderStatus,
  readOnly = false,
  onRefresh,
  onBlockerStateChange,
}) {
  const currentGate = currentServiceGateForStatus(workOrderStatus);
  const blockers = useMemo(
    () => currentGate
      ? (currentSnapshot?.gates?.[currentGate]?.blocking_items || [])
      : [],
    [currentGate, currentSnapshot],
  );

  useEffect(() => {
    onBlockerStateChange?.({ gate: currentGate, count: blockers.length });
  }, [blockers.length, currentGate, onBlockerStateChange]);
}
```

- [ ] **Step 4: Build compact progress and stage disclosures**

Use the existing `steps` array and `stateTone`. Render a six-segment summary and native accessible stage disclosures. Only current blockers receive amber warning rows. Add matching dictionary keys to both locales:

```js
progressSummary: (recorded, total) => `${recorded}/${total} controls recorded`,
noCurrentGate: 'No service gate is active at this stage.',
historicalHint: 'Historical record — not required by the current gate.',
showAudit: 'Review controls',
```

```js
progressSummary: (recorded, total) => `已记录 ${recorded}/${total} 项控制`,
noCurrentGate: '当前阶段没有生效中的服务关卡。',
historicalHint: '历史记录——不属于当前关卡要求。',
showAudit: '查看控制项',
```

Each stage uses:

```jsx
<details key={step.key} open={step.index === currentSnapshot?.currentStepIndex}>
  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-3">
    <span>{index + 1}. {t.stages[index] || itemLabel(step.key)}</span>
    <span className="text-xs text-[var(--color-text-muted)]">{recordedCount}/{step.items.length}</span>
  </summary>
  <div className="space-y-2 border-t border-[var(--color-border)] p-4">…</div>
</details>
```

- [ ] **Step 5: Restrict override to the current blocked gate**

Remove local `gate` selection state. Submit `currentGate` and render the form only under:

```jsx
{!readOnly && currentGate && blockers.length > 0 && (
  <form onSubmit={submitOverride}>…</form>
)}
```

Keep the existing reason validation, operation epoch guard, refresh behavior, and override audit list unchanged.

- [ ] **Step 6: Run focused tests and build**

Run:

```bash
cd admin
node --test src/pages/workOrderDetailView.test.mjs src/components/ServiceStandardAdminPanel.test.mjs
npm run build
```

Expected: focused tests pass and Vite build exits 0.

- [ ] **Step 7: Commit service control presentation**

```bash
git add admin/src/components/ServiceStandardAdminPanel.jsx admin/src/components/ServiceStandardAdminPanel.test.mjs
git commit -m "fix(admin): show only current service gate blockers"
```

---

### Task 3: Accessible detail disclosures and shortcuts

**Files:**
- Create: `admin/src/components/WorkOrderDetailSection.jsx`
- Create: `admin/src/components/WorkOrderDetailSection.test.mjs`
- Modify: `admin/package.json`

**Interfaces:**
- Produces: `WorkOrderDetailNav({ items, onNavigate })`.
- Produces: `WorkOrderDetailSection({ sectionKey, title, summary, open, onToggle, children })`.
- Section DOM IDs: `work-order-section-${sectionKey}` and `work-order-section-${sectionKey}-content`.

- [ ] **Step 1: Add failing component source contracts**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = () => readFile(new URL('./WorkOrderDetailSection.jsx', import.meta.url), 'utf8');

test('detail navigation uses buttons and stable section targets', async () => {
  const component = await source();
  assert.match(component, /export function WorkOrderDetailNav/);
  assert.match(component, /type="button"/);
  assert.match(component, /onNavigate\(item\.key\)/);
  assert.match(component, /work-order-section-/);
});

test('detail sections expose disclosure semantics and a 44px control', async () => {
  const component = await source();
  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /aria-controls=\{contentId\}/);
  assert.match(component, /min-h-11/);
  assert.match(component, /hidden=\{!open\}/);
});
```

- [ ] **Step 2: Run the test and observe RED**

Run: `cd admin && node --test src/components/WorkOrderDetailSection.test.mjs`
Expected: FAIL because the component file does not exist.

- [ ] **Step 3: Implement the two primitives**

```jsx
import { ChevronDown } from 'lucide-react';

export function WorkOrderDetailNav({ items, onNavigate }) {
  return (
    <nav aria-label={items.ariaLabel} className="flex gap-2 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 sm:px-5">
      {items.links.map((item) => (
        <button key={item.key} type="button" onClick={() => onNavigate(item.key)} className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]">
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function WorkOrderDetailSection({ sectionKey, title, summary, open, onToggle, children }) {
  const sectionId = `work-order-section-${sectionKey}`;
  const contentId = `${sectionId}-content`;
  return (
    <section id={sectionId} className="scroll-mt-28 rounded-xl border border-[var(--color-border)]">
      <button type="button" aria-expanded={open} aria-controls={contentId} onClick={() => onToggle(sectionKey)} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span><span className="font-medium">{title}</span>{summary && <span className="ml-2 text-xs text-[var(--color-text-muted)]">{summary}</span>}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={contentId} hidden={!open} className="border-t border-[var(--color-border)] p-4">{children}</div>
    </section>
  );
}
```

- [ ] **Step 4: Register and run GREEN**

Add `src/components/WorkOrderDetailSection.test.mjs` to the Admin test script, then run:

`cd admin && node --test src/components/WorkOrderDetailSection.test.mjs`

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Commit disclosure primitives**

```bash
git add admin/src/components/WorkOrderDetailSection.jsx admin/src/components/WorkOrderDetailSection.test.mjs admin/package.json
git commit -m "feat(admin): add work-order detail disclosures"
```

---

### Task 4: Reorganize the work-order drawer and complete bilingual copy

**Files:**
- Modify: `admin/src/pages/WorkOrdersPage.jsx`
- Modify: `admin/src/pages/WorkOrdersPage.review-flow.test.mjs`

**Interfaces:**
- Consumes Task 1 helpers and Task 3 components.
- Passes `detail.status` and blocker-state callback to `ServiceStandardAdminPanel`.
- Keeps every existing API mutation handler and mutation dialog signature unchanged.

- [ ] **Step 1: Write failing drawer hierarchy contracts**

Add tests that assert the chosen Option A structure and reject known regressions:

```js
test('detail drawer is summary-first with bilingual shortcut navigation', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const drawer = source.slice(source.indexOf('{detailOpen &&'));
  assert.match(drawer, /<WorkOrderDetailNav/);
  assert.match(drawer, /<WorkOrderDetailSummary/);
  assert.ok(drawer.indexOf('<WorkOrderDetailSummary') < drawer.indexOf('<ServiceStandardAdminPanel'));
  for (const key of ['overview', 'quote', 'dispatch', 'serviceControls', 'filesReport', 'reviewsMessages']) {
    assert.match(source, new RegExp(`${key}:`));
  }
});

test('shortcut navigation expands and scrolls to a detail section', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /function navigateToDetailSection\(sectionKey\)/);
  assert.match(source, /setOpenDetailSections/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
});

test('reviews and messages render once and messages do not create nested vertical scrolling', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  assert.equal(source.match(/\{t\.customerReviewTitle\}/g)?.length, 1);
  assert.equal(source.match(/\{t\.engineerReviewTitle\}/g)?.length, 1);
  assert.equal(source.match(/\{t\.messagesTitle\}/g)?.length, 1);
  assert.doesNotMatch(source, /max-h-72 space-y-2 overflow-y-auto/);
});

test('visible detail labels are localized instead of hard-coded English', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, />Engineer service payment</);
  assert.doesNotMatch(source, /label="Labor Fee"/);
  assert.match(source, /engineerPayoutTitle: 'Engineer service payment'/);
  assert.match(source, /engineerPayoutTitle: '工程师服务结算'/);
  assert.match(source, /laborFee: 'Labor fee'/);
  assert.match(source, /laborFee: '人工费'/);
});
```

- [ ] **Step 2: Run the drawer test and observe RED**

Run: `cd admin && node --test src/pages/WorkOrdersPage.review-flow.test.mjs`
Expected: new summary/navigation/localization contracts fail.

- [ ] **Step 3: Add localized navigation, summary, action, and touched detail copy**

Add equivalent keys to `TEXT.en` and `TEXT['zh-CN']`:

```js
detailNav: {
  ariaLabel: 'Work-order detail sections', overview: 'Overview', quote: 'Quote', dispatch: 'Dispatch',
  serviceControls: 'Service controls', filesReport: 'Files & report', reviewsMessages: 'Reviews & messages',
},
summaryLabels: { customer: 'Customer', engineer: 'Engineer', quote: 'Quote', payment: 'Payment' },
currentActions: {
  dispatch: 'Assign the regional lead or engineer.', quoteReview: 'Review the quote before it is sent.',
  paymentFollowup: 'Follow up the confirmed payment method.', approvePaymentStart: 'Confirm receipt before service starts.',
  monitorService: 'Service is in progress.', handover: 'Review service handover and customer acceptance.',
  complete: 'Service and customer acceptance are complete.', none: 'No Admin action is required now.',
},
sectionEmpty: 'Not available',
engineerPayoutTitle: 'Engineer service payment',
laborFee: 'Labor fee', partsFee: 'Parts fee', travelFee: 'Travel fee', otherFees: 'Other fees',
```

```js
detailNav: {
  ariaLabel: '工单详情分区', overview: '概览', quote: '报价清单', dispatch: '派单',
  serviceControls: '服务标准', filesReport: '附件与报告', reviewsMessages: '评价与沟通',
},
summaryLabels: { customer: '客户', engineer: '工程师', quote: '报价', payment: '付款' },
currentActions: {
  dispatch: '请分配区域负责人或工程师。', quoteReview: '请审核报价后再发送给客户。',
  paymentFollowup: '请跟进客户已确认的付款方式。', approvePaymentStart: '请确认收款后批准开工。',
  monitorService: '服务正在进行中。', handover: '请核对服务交接和客户验收。',
  complete: '服务及客户验收已完成。', none: '当前无需管理员处理。',
},
sectionEmpty: '暂无',
engineerPayoutTitle: '工程师服务结算',
laborFee: '人工费', partsFee: '配件费', travelFee: '差旅费', otherFees: '其他费用',
```

Replace every touched hard-coded drawer label with its `t` key. Do not translate dynamic `aiCheck.reason`, notes, descriptions, or messages.

- [ ] **Step 4: Add summary and detail section state**

At page state level:

```js
const [openDetailSections, setOpenDetailSections] = useState(() => new Set(['overview']));
const detailSectionRefs = useRef(new Map());
const [serviceBlockerState, setServiceBlockerState] = useState({ gate: null, count: 0 });
```

When opening a different order, reset from `defaultOpenWorkOrderSections(wo)`. When blocker state arrives for the still-open order, add `service-controls` only when count is positive.

Navigation implementation:

```js
function navigateToDetailSection(sectionKey) {
  setOpenDetailSections((current) => new Set([...current, sectionKey]));
  requestAnimationFrame(() => {
    document.getElementById(`work-order-section-${sectionKey}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
```

- [ ] **Step 5: Render summary before all action/detail modules**

Create a focused local `WorkOrderDetailSummary` in `WorkOrdersPage.jsx` because it is used only once. It renders four facts and `PaymentIndicators`, followed by the localized current-action text from `currentWorkOrderActionKey(detail)`. Do not add mutation behavior to the summary.

Pass navigation items as:

```jsx
<WorkOrderDetailNav
  items={{
    ariaLabel: t.detailNav.ariaLabel,
    links: [
      ['overview', t.detailNav.overview],
      ['quote', t.detailNav.quote],
      ['dispatch', t.detailNav.dispatch],
      ['service-controls', t.detailNav.serviceControls],
      ['files-report', t.detailNav.filesReport],
      ['reviews-messages', t.detailNav.reviewsMessages],
    ].map(([key, label]) => ({ key, label })),
  }}
  onNavigate={navigateToDetailSection}
/>
```

- [ ] **Step 6: Move existing content into the approved six groups**

Wrap, without rewriting their handlers:

- `overview`: summary and current contextual action cards.
- `quote`: `QuoteExecutionAdminPanel`, legacy quote details, payment/balance actions, payout details.
- `dispatch`: regional lead and engineer controls.
- `service-controls`: `ServiceStandardAdminPanel` with `workOrderStatus={detail.status}` and `onBlockerStateChange`.
- `files-report`: AI service summary, field operations, attachments, repair report.
- `reviews-messages`: customer rating, engineer internal review, message timeline, internal note composer.

Each group uses `WorkOrderDetailSection`; the overview summary remains visible and uses the overview ID as its scroll target. Delete the message list's `max-h-72 overflow-y-auto` classes so the drawer body is the only vertical scrolling surface.

- [ ] **Step 7: Run focused Admin tests and build in both locale modes**

Run:

```bash
cd admin
npm test
npm run build
VITE_MARKET=cn VITE_API_URL=https://api.sagemro.cn npm run build
```

Expected: all Admin tests pass and both builds exit 0.

- [ ] **Step 8: Commit the drawer reorganization**

```bash
git add admin/src/pages/WorkOrdersPage.jsx admin/src/pages/WorkOrdersPage.review-flow.test.mjs
git commit -m "fix(admin): reorganize work-order detail drawer"
```

---

### Task 5: Browser and repository-level verification

**Files:**
- Modify only if a verification failure proves an implementation defect in a file already in scope.

**Interfaces:**
- Consumes the completed Admin drawer from Tasks 1–4.
- Produces no new runtime API.

- [ ] **Step 1: Run the complete repository test command used by CI**

Read `.github/workflows/deploy.yml` and run the same Worker, frontend, and Admin checks locally in the same order. Expected: every command exits 0. Do not substitute partial tests for the workflow commands.

- [ ] **Step 2: Run a production Admin build and preview**

Run:

```bash
cd admin
npm run build
npm run preview -- --host 127.0.0.1
```

Expected: Vite preview starts and the Admin application loads without console render errors.

- [ ] **Step 3: Verify desktop behavior**

At approximately 1440×900, open a work order representing each relevant status where fixture/session data permits:

- `payment_review`: Quote opens; only Start blockers warn.
- `in_service`: Service controls opens only if Resolve blockers exist.
- `resolved` or `pending_review`: only Handover blockers warn.
- `pending_payment`: no service gate warning; quote/payment context is prominent.

Confirm each shortcut expands and scrolls to its target, every detail section appears once, and internal note submission remains functional.

- [ ] **Step 4: Verify narrow behavior**

At approximately 390×844, confirm readable two/one-column summary, horizontal shortcut scrolling, 44px disclosure controls, usable quote table overflow, and exactly one vertical scroll surface.

- [ ] **Step 5: Verify both locales**

Build/preview once with international runtime defaults and once with `VITE_MARKET=cn VITE_API_URL=https://api.sagemro.cn`. Confirm all static drawer labels change language while dynamic messages remain verbatim.

- [ ] **Step 6: Inspect the final diff**

Run:

```bash
git diff origin/main...HEAD --check
git diff origin/main...HEAD --stat
git status --short
```

Expected: no whitespace errors, only planned files changed, and no uncommitted production changes.

- [ ] **Step 7: Commit any verification-only corrections**

Only if Steps 1–6 exposed an in-scope defect:

```bash
git add <the already-in-scope corrected files>
git commit -m "test(admin): verify work-order detail experience"
```

Do not create an empty commit when no correction is required.
