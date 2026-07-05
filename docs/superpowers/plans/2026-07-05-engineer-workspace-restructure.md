# Engineer Workspace Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the engineer homepage into a personal work overview and restructure work-order details into the operational center for customer issue, device, AI summary, safety, parts, payment, and service confirmation.

**Architecture:** Keep this as a frontend-first change. Extract state-derivation helpers into small model files with Node tests, then update `EngineerWorkspace.jsx` and `WorkOrderDetailModal.jsx` to consume those helpers. Do not change Worker APIs, D1 schema, deployment config, or payment mechanics in this batch.

**Tech Stack:** React 19, Vite, Node `node:test`, existing SAGEMRO service API wrappers, lucide-react icons, existing CSS variables/Tailwind utility style.

## Global Constraints

- Use existing API/data first: `getEngineerTickets(engineerId)`, `getWorkOrder(workOrderId)`, and optionally `getWorkOrderPayment(workOrderId)`.
- Do not add D1 migrations or Worker route changes in this batch.
- Do not add wallet, withdrawal, automatic revenue split, bidding, rankings, or marketplace wording.
- The engineer homepage must not display global `AI 诊断摘要` or `客户设备档案` placeholder cards.
- Payment status is service-progress information only: quote status, customer confirmation, payment status, service completion, and operations settlement status.
- Keep region lead assignment behavior and conflict warnings intact.
- Keep existing quote, service report, messages, attachments, and review tabs intact.
- Use Chinese copy for the China engineer workspace and avoid `官方审核`, `抢单`, `钱包`, `提现`.

---

## File Structure

- `frontend/src/components/Engineer/engineerWorkspaceModel.js`
  - New pure helpers for grouping tickets, sorting work queue, deriving action labels, and deriving payment badges from work-order status.
- `frontend/tests/engineer-workspace-model.test.mjs`
  - Node tests for homepage metrics and task badges.
- `frontend/src/components/Engineer/EngineerWorkspace.jsx`
  - Update homepage structure to use model helpers, remove global AI/device placeholders, add payment/workflow badges.
- `frontend/src/components/WorkOrder/workOrderDetailModel.js`
  - New pure helpers for detail sections: AI summary parsing, safety stage, payment/confirmation summary.
- `frontend/tests/work-order-detail-model.test.mjs`
  - Node tests for detail payment summary, AI parsing, and safety derivation.
- `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`
  - Rebuild the `详情` tab internals into structured sections while preserving existing tabs and actions.

---

### Task 1: Engineer Workspace Model Helpers

**Files:**
- Create: `frontend/src/components/Engineer/engineerWorkspaceModel.js`
- Create: `frontend/tests/engineer-workspace-model.test.mjs`

**Interfaces:**
- Produces:
  - `groupEngineerTickets(tickets, isRegionalLead = false): { today, pending, active, pricing, reports, customerConfirm, payment, completedThisMonth, parts }`
  - `derivePaymentBadge(ticket): { label, tone, visible }`
  - `deriveWorkOrderActionLabel(ticket): { label, tone }`
  - `sortEngineerWorkQueue(tickets): Array`

- [ ] **Step 1: Write failing tests**

Create `frontend/tests/engineer-workspace-model.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  derivePaymentBadge,
  deriveWorkOrderActionLabel,
  groupEngineerTickets,
  sortEngineerWorkQueue,
} from '../src/components/Engineer/engineerWorkspaceModel.js';

test('groups engineer tickets into operational homepage metrics', () => {
  const tickets = [
    { id: 'wo-assigned', status: 'assigned' },
    { id: 'wo-progress', status: 'in_progress' },
    { id: 'wo-service', status: 'in_service' },
    { id: 'wo-pricing', status: 'pricing' },
    { id: 'wo-resolved', status: 'resolved' },
    { id: 'wo-review', status: 'pending_review' },
    { id: 'wo-payment', status: 'pending_payment' },
    { id: 'wo-done', status: 'completed', completed_at: new Date().toISOString() },
    { id: 'wo-parts', status: 'assigned', description: '需要配件保护镜片' },
  ];

  const grouped = groupEngineerTickets(tickets);

  assert.deepEqual(grouped.today.map((item) => item.id), ['wo-assigned', 'wo-progress', 'wo-service', 'wo-parts']);
  assert.deepEqual(grouped.pending.map((item) => item.id), ['wo-assigned', 'wo-parts']);
  assert.deepEqual(grouped.active.map((item) => item.id), ['wo-progress', 'wo-service']);
  assert.deepEqual(grouped.pricing.map((item) => item.id), ['wo-pricing']);
  assert.deepEqual(grouped.reports.map((item) => item.id), ['wo-resolved', 'wo-review']);
  assert.deepEqual(grouped.customerConfirm.map((item) => item.id), ['wo-resolved', 'wo-review']);
  assert.deepEqual(grouped.payment.map((item) => item.id), ['wo-payment']);
  assert.deepEqual(grouped.completedThisMonth.map((item) => item.id), ['wo-done']);
  assert.deepEqual(grouped.parts.map((item) => item.id), ['wo-parts']);
});

test('derives payment and action labels without wallet wording', () => {
  assert.deepEqual(derivePaymentBadge({ status: 'pending_payment' }), {
    label: '待回款',
    tone: 'amber',
    visible: true,
  });
  assert.deepEqual(derivePaymentBadge({ status: 'completed' }), {
    label: '已完成',
    tone: 'green',
    visible: true,
  });
  assert.equal(JSON.stringify(derivePaymentBadge({ status: 'pending_payment' })).includes('钱包'), false);
  assert.equal(JSON.stringify(derivePaymentBadge({ status: 'pending_payment' })).includes('提现'), false);

  assert.deepEqual(deriveWorkOrderActionLabel({ status: 'pricing' }), {
    label: '待报价',
    tone: 'purple',
  });
  assert.deepEqual(deriveWorkOrderActionLabel({ status: 'resolved' }), {
    label: '待客户确认',
    tone: 'teal',
  });
});

test('sorts engineer work queue by operational urgency', () => {
  const sorted = sortEngineerWorkQueue([
    { id: 'completed', status: 'completed' },
    { id: 'payment', status: 'pending_payment' },
    { id: 'critical', status: 'assigned', urgency: 'critical' },
    { id: 'pricing', status: 'pricing' },
    { id: 'progress', status: 'in_progress' },
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ['critical', 'payment', 'pricing', 'progress', 'completed']);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node --test frontend/tests/engineer-workspace-model.test.mjs
```

Expected: FAIL because `engineerWorkspaceModel.js` does not exist.

- [ ] **Step 3: Implement minimal helpers**

Create `frontend/src/components/Engineer/engineerWorkspaceModel.js`:

```js
const PAYMENT_STATUSES = new Set(['pending_payment']);
const ACTIVE_STATUSES = new Set(['in_progress', 'in_service']);
const PENDING_STATUSES = new Set(['pending', 'pending_dispatch', 'assigned']);
const TODAY_STATUSES = new Set(['assigned', 'in_progress', 'in_service']);
const REPORT_STATUSES = new Set(['resolved', 'pending_review']);
const PRICING_STATUSES = new Set(['pricing']);

function isCurrentMonth(dateValue) {
  if (!dateValue) return false;
  const value = new Date(dateValue);
  if (Number.isNaN(value.getTime())) return false;
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
}

function mentionsParts(ticket) {
  return /parts|备件|配件|物料/i.test(`${ticket.type || ''} ${ticket.description || ''}`);
}

export function groupEngineerTickets(tickets = [], isRegionalLead = false) {
  const list = Array.isArray(tickets) ? tickets : [];
  return {
    today: list.filter((ticket) => TODAY_STATUSES.has(ticket.status)),
    pending: list.filter((ticket) => PENDING_STATUSES.has(ticket.status)),
    active: list.filter((ticket) => ACTIVE_STATUSES.has(ticket.status)),
    pricing: list.filter((ticket) => PRICING_STATUSES.has(ticket.status)),
    reports: list.filter((ticket) => REPORT_STATUSES.has(ticket.status)),
    customerConfirm: list.filter((ticket) => REPORT_STATUSES.has(ticket.status)),
    payment: list.filter((ticket) => PAYMENT_STATUSES.has(ticket.status)),
    completedThisMonth: list.filter((ticket) => ticket.status === 'completed' && isCurrentMonth(ticket.completed_at)),
    parts: list.filter(mentionsParts),
    regionalPending: isRegionalLead ? list.filter((ticket) => ticket.status === 'pending_dispatch') : [],
  };
}

export function derivePaymentBadge(ticket = {}) {
  if (ticket.status === 'pending_payment') return { label: '待回款', tone: 'amber', visible: true };
  if (ticket.status === 'completed') return { label: '已完成', tone: 'green', visible: true };
  if (ticket.status === 'in_service') return { label: '客户已确认报价', tone: 'blue', visible: true };
  return { label: '回款待运营记录', tone: 'slate', visible: false };
}

export function deriveWorkOrderActionLabel(ticket = {}) {
  const status = ticket.status;
  if (status === 'assigned') return { label: '待确认派工', tone: 'amber' };
  if (status === 'pricing') return { label: '待报价', tone: 'purple' };
  if (status === 'pending_payment') return { label: '待回款', tone: 'amber' };
  if (status === 'resolved' || status === 'pending_review') return { label: '待客户确认', tone: 'teal' };
  if (status === 'in_progress' || status === 'in_service') return { label: '服务中', tone: 'blue' };
  if (status === 'completed') return { label: '已完成', tone: 'green' };
  return { label: status || '待处理', tone: 'slate' };
}

const STATUS_PRIORITY = {
  assigned: 10,
  pending_dispatch: 20,
  pending_payment: 30,
  pricing: 40,
  in_progress: 50,
  in_service: 60,
  resolved: 70,
  pending_review: 80,
  completed: 900,
};

export function sortEngineerWorkQueue(tickets = []) {
  return [...tickets].sort((a, b) => {
    const urgencyDelta = (b.urgency === 'critical' ? 100 : b.urgency === 'urgent' ? 50 : 0)
      - (a.urgency === 'critical' ? 100 : a.urgency === 'urgent' ? 50 : 0);
    if (urgencyDelta !== 0) return urgencyDelta;
    return (STATUS_PRIORITY[a.status] || 500) - (STATUS_PRIORITY[b.status] || 500);
  });
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
node --test frontend/tests/engineer-workspace-model.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit task**

```bash
git add frontend/src/components/Engineer/engineerWorkspaceModel.js frontend/tests/engineer-workspace-model.test.mjs
git commit -m "test(frontend): add engineer workspace state model"
```

---

### Task 2: Engineer Homepage Structure

**Files:**
- Modify: `frontend/src/components/Engineer/EngineerWorkspace.jsx`
- Test: `frontend/tests/engineer-workspace-model.test.mjs`

**Interfaces:**
- Consumes from Task 1:
  - `groupEngineerTickets`
  - `derivePaymentBadge`
  - `deriveWorkOrderActionLabel`
  - `sortEngineerWorkQueue`

- [ ] **Step 1: Write failing contract test for homepage source copy**

Append to `frontend/tests/engineer-workspace-model.test.mjs`:

```js
import { readFileSync } from 'node:fs';

test('engineer homepage source keeps AI and customer device details out of global sidebar', () => {
  const source = readFileSync(new URL('../src/components/Engineer/EngineerWorkspace.jsx', import.meta.url), 'utf8');

  assert.equal(source.includes('<h2 className="mb-3 font-semibold">AI 诊断摘要</h2>'), false);
  assert.equal(source.includes('<h2 className="mb-3 font-semibold">客户设备档案</h2>'), false);
  assert.match(source, /待回款/);
  assert.match(source, /工程师工具箱/);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node --test frontend/tests/engineer-workspace-model.test.mjs
```

Expected: FAIL because current `EngineerWorkspace.jsx` still contains the two global placeholder cards and does not yet contain the final toolbox/payment structure.

- [ ] **Step 3: Update homepage imports and grouped data**

In `frontend/src/components/Engineer/EngineerWorkspace.jsx`, import helper functions:

```js
import {
  derivePaymentBadge,
  deriveWorkOrderActionLabel,
  groupEngineerTickets,
  sortEngineerWorkQueue,
} from './engineerWorkspaceModel';
```

Replace the local `groupTickets` function usage with:

```js
const grouped = groupEngineerTickets(tickets, isRegionalLead);
const sortedTickets = sortEngineerWorkQueue(tickets);
const metrics = [
  ...(isRegionalLead ? [{ icon: ClipboardCheck, label: '区域待分配', value: grouped.regionalPending.length }] : []),
  { icon: ClipboardCheck, label: '今日派工', value: grouped.today.length },
  { icon: AlertTriangle, label: '待确认派工', value: grouped.pending.length },
  { icon: Wrench, label: '服务中', value: grouped.active.length },
  { icon: FileText, label: '待报价', value: grouped.pricing.length },
  { icon: FileText, label: '待报告', value: grouped.reports.length },
  { icon: ShieldCheck, label: '待客户确认', value: grouped.customerConfirm.length },
  { icon: Package, label: '待回款', value: grouped.payment.length },
  { icon: ClipboardCheck, label: '本月完成', value: grouped.completedThisMonth.length },
];
```

- [ ] **Step 4: Update task cards**

Inside the ticket card render, before the existing status label, derive badges:

```jsx
const action = deriveWorkOrderActionLabel(ticket);
const paymentBadge = derivePaymentBadge(ticket);
```

Render:

```jsx
<div className="mt-3 flex flex-wrap gap-2">
  <span className={`rounded-lg px-2 py-1 text-xs font-medium ${toneClass(action.tone)}`}>
    {action.label}
  </span>
  {paymentBadge.visible && (
    <span className={`rounded-lg px-2 py-1 text-xs font-medium ${toneClass(paymentBadge.tone)}`}>
      {paymentBadge.label}
    </span>
  )}
</div>
```

Add local `toneClass(tone)` near the top of the component file:

```js
function toneClass(tone) {
  const tones = {
    amber: 'bg-amber-500/10 text-amber-600',
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-600',
    purple: 'bg-purple-500/10 text-purple-600',
    teal: 'bg-teal-500/10 text-teal-600',
    slate: 'bg-[var(--color-surface)] text-[var(--color-text-muted)]',
  };
  return tones[tone] || tones.slate;
}
```

- [ ] **Step 5: Replace sidebar placeholders with toolbox**

Remove the two cards headed `AI 诊断摘要` and `客户设备档案`. Replace them with a single toolbox card:

```jsx
<div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
  <h2 className="mb-3 font-semibold">工程师工具箱</h2>
  <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
    <div className="rounded-xl bg-[var(--color-surface-elevated)] px-3 py-2">服务报告规范：诊断、处理动作、配件更换和后续建议需完整记录。</div>
    <div className="rounded-xl bg-[var(--color-surface-elevated)] px-3 py-2">物料申请：找不到合适配件时，在工单报价或服务报告中提交新增物料申请。</div>
    <div className="rounded-xl bg-[var(--color-surface-elevated)] px-3 py-2">回款跟进：回款状态由运营维护，工程师端仅作为服务进度参考。</div>
  </div>
</div>
```

- [ ] **Step 6: Run test and build**

Run:

```bash
node --test frontend/tests/engineer-workspace-model.test.mjs
npm run build --prefix frontend
```

Expected: PASS.

- [ ] **Step 7: Commit task**

```bash
git add frontend/src/components/Engineer/EngineerWorkspace.jsx frontend/tests/engineer-workspace-model.test.mjs
git commit -m "feat(frontend): restructure engineer workspace overview"
```

---

### Task 3: Work Order Detail Model Helpers

**Files:**
- Create: `frontend/src/components/WorkOrder/workOrderDetailModel.js`
- Create: `frontend/tests/work-order-detail-model.test.mjs`

**Interfaces:**
- Produces:
  - `parseAiSummary(aiSummary): object | null`
  - `deriveSafetyStage(workOrder, aiSummary): { label, tone, description }`
  - `derivePaymentSummary(workOrder, payment): Array<{ label, value, tone }>`

- [ ] **Step 1: Write failing tests**

Create `frontend/tests/work-order-detail-model.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  derivePaymentSummary,
  deriveSafetyStage,
  parseAiSummary,
} from '../src/components/WorkOrder/workOrderDetailModel.js';

test('parses AI summary only when valid content is available', () => {
  assert.deepEqual(parseAiSummary(JSON.stringify({ summary: '激光报警', required_specialties: ['laser'] })), {
    summary: '激光报警',
    required_specialties: ['laser'],
  });
  assert.equal(parseAiSummary('not-json'), null);
  assert.equal(parseAiSummary(null), null);
});

test('derives safety stage from urgency without overstating official diagnosis', () => {
  assert.deepEqual(deriveSafetyStage({ urgency: 'critical' }, null), {
    label: '高风险',
    tone: 'red',
    description: '到场前确认断电、激光、电气和现场防护条件。',
  });
  assert.deepEqual(deriveSafetyStage({ urgency: 'urgent' }, null), {
    label: '需优先处理',
    tone: 'amber',
    description: '建议提前确认现场联系人、停机窗口和必要备件。',
  });
});

test('derives payment summary as service progress without wallet wording', () => {
  const summary = derivePaymentSummary({ status: 'pending_payment', quote_review_status: 'approved' }, { payment: { status: 'pending' } });

  assert.deepEqual(summary.map((item) => [item.label, item.value]), [
    ['报价状态', '已通过运营复核'],
    ['客户确认', '待客户确认'],
    ['付款状态', '待回款'],
    ['服务完成', '服务处理中'],
    ['运营结算', '运营确认中'],
  ]);
  assert.equal(JSON.stringify(summary).includes('钱包'), false);
  assert.equal(JSON.stringify(summary).includes('提现'), false);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node --test frontend/tests/work-order-detail-model.test.mjs
```

Expected: FAIL because `workOrderDetailModel.js` does not exist.

- [ ] **Step 3: Implement helpers**

Create `frontend/src/components/WorkOrder/workOrderDetailModel.js`:

```js
export function parseAiSummary(aiSummary) {
  if (!aiSummary) return null;
  if (typeof aiSummary === 'object') return aiSummary;
  try {
    const parsed = JSON.parse(aiSummary);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function deriveSafetyStage(workOrder = {}, aiSummary = null) {
  if (workOrder.urgency === 'critical') {
    return {
      label: '高风险',
      tone: 'red',
      description: '到场前确认断电、激光、电气和现场防护条件。',
    };
  }
  if (workOrder.urgency === 'urgent') {
    return {
      label: '需优先处理',
      tone: 'amber',
      description: '建议提前确认现场联系人、停机窗口和必要备件。',
    };
  }
  if (aiSummary?.safety_risks?.length) {
    return {
      label: '需现场复核',
      tone: 'amber',
      description: 'AI 摘要包含安全风险提示，请到场前复核。',
    };
  }
  return {
    label: '常规',
    tone: 'green',
    description: '按常规现场服务流程确认环境、设备状态和防护要求。',
  };
}

function quoteStatus(workOrder = {}) {
  if (workOrder.quote_review_status === 'approved') return '已通过运营复核';
  if (workOrder.quote_review_status === 'pending_review') return '待运营复核';
  if (workOrder.status === 'pricing') return '待报价';
  return '未报价';
}

function customerStatus(workOrder = {}) {
  if (['in_service', 'resolved', 'pending_review', 'completed'].includes(workOrder.status)) return '已确认';
  return '待客户确认';
}

function paymentStatus(workOrder = {}, payment = null) {
  const status = payment?.payment?.status || payment?.status;
  if (status === 'paid' || workOrder.status === 'completed') return '已回款';
  if (workOrder.status === 'pending_payment' || status === 'pending') return '待回款';
  return '暂无付款记录';
}

function serviceStatus(workOrder = {}) {
  if (workOrder.status === 'completed') return '已完成';
  if (workOrder.status === 'resolved' || workOrder.status === 'pending_review') return '待客户确认';
  return '服务处理中';
}

export function derivePaymentSummary(workOrder = {}, payment = null) {
  return [
    { label: '报价状态', value: quoteStatus(workOrder), tone: 'blue' },
    { label: '客户确认', value: customerStatus(workOrder), tone: 'teal' },
    { label: '付款状态', value: paymentStatus(workOrder, payment), tone: workOrder.status === 'pending_payment' ? 'amber' : 'slate' },
    { label: '服务完成', value: serviceStatus(workOrder), tone: 'green' },
    { label: '运营结算', value: workOrder.status === 'completed' ? '已记录' : '运营确认中', tone: 'slate' },
  ];
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
node --test frontend/tests/work-order-detail-model.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit task**

```bash
git add frontend/src/components/WorkOrder/workOrderDetailModel.js frontend/tests/work-order-detail-model.test.mjs
git commit -m "test(frontend): add work order detail state model"
```

---

### Task 4: Work Order Detail Sections

**Files:**
- Modify: `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`
- Test: `frontend/tests/work-order-detail-model.test.mjs`

**Interfaces:**
- Consumes from Task 3:
  - `parseAiSummary`
  - `deriveSafetyStage`
  - `derivePaymentSummary`

- [ ] **Step 1: Write failing source contract test**

Append to `frontend/tests/work-order-detail-model.test.mjs`:

```js
import { readFileSync } from 'node:fs';

test('work order detail source contains engineer operational sections', () => {
  const source = readFileSync(new URL('../src/components/WorkOrder/WorkOrderDetailModal.jsx', import.meta.url), 'utf8');

  assert.match(source, /客户问题|Customer Issue/);
  assert.match(source, /设备信息|Device Information/);
  assert.match(source, /安全风险|Safety Risk/);
  assert.match(source, /配件准备|Parts Preparation/);
  assert.match(source, /回款与确认|Payment & Confirmation/);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node --test frontend/tests/work-order-detail-model.test.mjs
```

Expected: FAIL because `WorkOrderDetailModal.jsx` does not yet contain all operational section labels.

- [ ] **Step 3: Import helpers**

In `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`, add:

```js
import {
  derivePaymentSummary,
  deriveSafetyStage,
  parseAiSummary,
} from './workOrderDetailModel';
```

Inside the component after status variables:

```js
const parsedAiSummary = parseAiSummary(detail?.ai_summary);
const safetyStage = deriveSafetyStage(detail || workOrder, parsedAiSummary);
const paymentSummary = derivePaymentSummary(detail || workOrder, detail?.payment || null);
```

- [ ] **Step 4: Add small section components inside the modal file**

Add before `renderInfoTab`:

```jsx
const renderSection = (title, children) => (
  <section className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
    <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
    {children}
  </section>
);
```

- [ ] **Step 5: Replace `renderInfoTab` inner structure**

Keep existing action buttons and logs, but reorganize the top of `renderInfoTab` into sections:

```jsx
{renderSection(isCn ? '客户问题' : 'Customer Issue', (
  <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
    <div>{isCn ? '问题类型：' : 'Issue Type: '}{localizedTypeLabels[workOrder.type] || workOrder.type}</div>
    <div className="rounded-lg bg-[var(--color-surface)] p-3 text-[var(--color-text-primary)]">{workOrder.description || '-'}</div>
  </div>
))}

{renderSection(isCn ? '设备信息' : 'Device Information', (
  <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
    <div>{isCn ? '设备类别：' : 'Equipment Category: '}{localizedCategoryConfig[workOrder.category_l1]?.label || workOrder.category_l1 || (isCn ? '待补充' : 'Pending')}</div>
    <div>{workOrder.category_l2 && workOrder.category_l2 !== 'other' ? (localizedCategoryL2Labels[workOrder.category_l2] || workOrder.category_l2) : (isCn ? '设备型号与历史记录待补充' : 'Model and service history pending')}</div>
  </div>
))}

{parsedAiSummary && renderSection(isCn ? 'AI 初诊摘要' : 'AI Analysis', (
  <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
    {parsedAiSummary.summary && <p className="text-[var(--color-text-primary)]">{parsedAiSummary.summary}</p>}
    {parsedAiSummary.required_specialties?.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {parsedAiSummary.required_specialties.map((item, index) => (
          <span key={`${item}-${index}`} className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">{item}</span>
        ))}
      </div>
    )}
  </div>
))}

{renderSection(isCn ? '安全风险' : 'Safety Risk', (
  <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
    <div className="font-medium text-[var(--color-text-primary)]">{safetyStage.label}</div>
    <div>{safetyStage.description}</div>
  </div>
))}

{renderSection(isCn ? '派工信息' : 'Dispatch Information', (
  <div className="grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
    <div>{isCn ? '客户：' : 'Customer: '}{detail?.customer_name || '-'}</div>
    <div>{isCn ? '工程师：' : 'Engineer: '}{detail?.engineer_name || '-'}</div>
    <div>{isCn ? '提交时间：' : 'Submitted: '}{workOrder.created_at ? new Date(workOrder.created_at).toLocaleString(isCn ? 'zh-CN' : 'en-US') : '-'}</div>
    <div>{isCn ? '地区：' : 'Region: '}{detail?.customer_region || '-'}</div>
  </div>
))}

{renderSection(isCn ? '配件准备' : 'Parts Preparation', (
  <p className="text-sm text-[var(--color-text-secondary)]">
    {isCn ? '报价或服务报告中可引用物料库；找不到合适物料时，工程师可提交新增物料申请。' : 'Use material references in quote or service report. If a part is missing, submit a material request from the work order.'}
  </p>
))}

{renderSection(isCn ? '回款与确认' : 'Payment & Confirmation', (
  <div className="grid gap-2 sm:grid-cols-2">
    {paymentSummary.map((item) => (
      <div key={item.label} className="rounded-lg bg-[var(--color-surface)] px-3 py-2">
        <div className="text-xs text-[var(--color-text-muted)]">{item.label}</div>
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{item.value}</div>
      </div>
    ))}
  </div>
))}
```

- [ ] **Step 6: Preserve existing action buttons and logs**

Move the existing engineer `标记服务完成`, customer cancel/rating buttons, engineer review block, and logs below the new sections without changing their API calls.

- [ ] **Step 7: Run tests and build**

Run:

```bash
node --test frontend/tests/work-order-detail-model.test.mjs
npm run build --prefix frontend
```

Expected: PASS.

- [ ] **Step 8: Commit task**

```bash
git add frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx frontend/tests/work-order-detail-model.test.mjs
git commit -m "feat(frontend): restructure work order detail sections"
```

---

### Task 5: Final Verification And Integration

**Files:**
- Verify only unless failures require a focused fix.

- [ ] **Step 1: Run frontend tests**

Run:

```bash
npm test --prefix frontend
```

Expected: PASS.

- [ ] **Step 2: Run frontend lint**

Run:

```bash
npm run lint --prefix frontend
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run:

```bash
npm run build --prefix frontend
```

Expected: PASS.

- [ ] **Step 4: Run existing copy/asset contracts explicitly**

Run:

```bash
node --test frontend/tests/cn-copy-contract.test.mjs frontend/tests/brand-assets-contract.test.mjs
```

Expected: PASS and no forbidden China-market wording.

- [ ] **Step 5: Run diff hygiene check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 6: Review changed files**

Run:

```bash
git diff --stat
git diff -- frontend/src/components/Engineer/EngineerWorkspace.jsx frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx
```

Expected: only scoped frontend and test changes.

- [ ] **Step 7: Commit verification fixes if needed**

If verification required any small follow-up fixes:

```bash
git add frontend/src/components frontend/tests
git commit -m "fix(frontend): polish engineer workspace restructure"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: Tasks cover homepage metrics, removal of global AI/device placeholders, task workflow/payment badges, detail sections, payment and confirmation summary, and no Worker/D1 change.
- Placeholder scan: No TBD/TODO/fill-in-later steps remain.
- Type consistency: Helper names in Tasks 2 and 4 match interfaces introduced in Tasks 1 and 3.
- Scope check: The plan is one frontend-first implementation slice and does not include payment mechanics, wallet, withdrawal, or route migration.
