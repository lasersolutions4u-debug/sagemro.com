# Engineer Work Order Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the signed-in engineer portal's dense dashboard and work-order modal entry with a responsive structured work-order list and a full-width detail workspace that exposes task context, service preparation, a read-only service-standard checklist, existing work-order tools, and `support@sagemro.com`.

**Architecture:** Keep navigation local to `EngineerWorkspace`: `selectedTicket === null` renders the list, and a selected ticket renders the detail workspace without introducing a URL router. Split presentation into focused list and detail components, extract the existing work-order modal body into an embeddable `WorkOrderDetailContent`, and preserve the modal wrapper for customer and legacy callers. Reuse current APIs and action handlers; do not add Worker, schema, or persistence changes.

**Tech Stack:** React 19, JavaScript/JSX, Tailwind CSS 4, lucide-react, Node.js built-in test runner, ESLint, Vite.

## Global Constraints

- Apply only to the signed-in workspace on `engineer.sagemro.com` and `engineer.sagemro.cn`.
- Keep the public engineer recruiting page and customer-facing site unchanged.
- Do not add database tables, migrations, Worker endpoints, saved checklist state, or a new routing framework.
- Keep the checklist read-only; it must not render checkbox inputs or trigger network requests.
- Keep existing role and status permission checks for engineer and Regional Lead actions.
- Preserve English copy on `.com` and Chinese copy on `.cn`.
- Use `support@sagemro.com` as a working `mailto:` link in the list footer and detail action area.
- Use restrained neutral surfaces, borders, spacing, and typography; avoid decorative dashboard cards and gradients.
- Do not refactor `EngineerDashboard`, calendar behavior, authentication, or customer workflows unless a direct compile dependency requires a surgical change.
- Every code task follows red-green-refactor: add a focused failing contract test, confirm failure, implement the minimum change, and rerun the focused test.

---

## File structure

- Create `frontend/src/components/Engineer/engineerWorkOrderDisplay.js`: pure ordering and display helpers shared by list and detail.
- Create `frontend/src/components/Engineer/EngineerWorkOrderList.jsx`: structured list, compact status filters, loading/error/empty states, and Admin support footer.
- Create `frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx`: full-width detail shell, the three approved information sections, sticky action area, and embedded existing work-order tools.
- Modify `frontend/src/components/Engineer/EngineerWorkspace.jsx`: retain header, profile/logout, availability, calendar and role-aware action ownership; switch between list and detail states.
- Modify `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`: export an embeddable `WorkOrderDetailContent` while retaining the existing modal wrapper and customer behavior.
- Create `frontend/tests/engineer-work-order-experience-contract.test.mjs`: focused source contracts for structure, localization, read-only checklist, mail links, responsive action layout, and absence of new API/schema behavior.
- Modify `frontend/tests/cn-primary-ui-language-contract.test.mjs`: point engineer-workspace localization assertions at the new focused components.

---

### Task 1: Add deterministic work-order display helpers

**Files:**
- Create: `frontend/src/components/Engineer/engineerWorkOrderDisplay.js`
- Create: `frontend/tests/engineer-work-order-experience-contract.test.mjs`

**Interfaces:**
- Produces: `ACTION_PRIORITY: Record<string, number>`
- Produces: `sortEngineerWorkOrders(tickets: Array<object>): Array<object>` without mutating `tickets`
- Produces: `getEngineerWorkOrderTitle(ticket: object, isCn: boolean, fallback: string): string`
- Produces: `getEngineerScheduleLabel(ticket: object, locale: 'en-US' | 'zh-CN'): string`
- Consumes: no APIs or React state.

- [ ] **Step 1: Write failing tests for action priority and display fallbacks**

Create `frontend/tests/engineer-work-order-experience-contract.test.mjs` with:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('engineer work orders are sorted by required action without mutating input', async () => {
  const { sortEngineerWorkOrders } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');
  const tickets = [
    { id: 'done', status: 'completed', created_at: '2026-07-25T10:00:00Z' },
    { id: 'quote', status: 'pricing', created_at: '2026-07-24T10:00:00Z' },
    { id: 'assigned', status: 'assigned', created_at: '2026-07-23T10:00:00Z' },
  ];

  assert.deepEqual(sortEngineerWorkOrders(tickets).map((ticket) => ticket.id), ['assigned', 'quote', 'done']);
  assert.deepEqual(tickets.map((ticket) => ticket.id), ['done', 'quote', 'assigned']);
});

test('engineer work-order title and schedule helpers use existing fields only', async () => {
  const {
    getEngineerScheduleLabel,
    getEngineerWorkOrderTitle,
  } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');

  assert.equal(getEngineerWorkOrderTitle({ category_l2: 'other', description: 'Laser power drops after warm-up.' }, false, 'Service task'), 'Laser power drops after warm-up.');
  assert.equal(getEngineerWorkOrderTitle({}, true, '服务任务'), '服务任务');
  assert.equal(getEngineerScheduleLabel({ sla_deadline: '2026-07-25T06:00:00.000Z' }, 'zh-CN').length > 0, true);
  assert.equal(getEngineerScheduleLabel({}, 'en-US'), '');
});

test('engineer work-order redesign stays frontend-only', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');
  assert.doesNotMatch(workspace, /saveChecklist|updateChecklist|checklist_progress/);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run:

```bash
cd frontend && node --test tests/engineer-work-order-experience-contract.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `engineerWorkOrderDisplay.js`.

- [ ] **Step 3: Implement the pure helpers**

Create `frontend/src/components/Engineer/engineerWorkOrderDisplay.js`:

```js
export const ACTION_PRIORITY = {
  assigned: 0,
  pending_dispatch: 1,
  pricing: 2,
  pending_payment: 3,
  payment_review: 4,
  in_service: 5,
  in_progress: 6,
  pending: 7,
  resolved: 8,
  pending_review: 9,
  completed: 10,
};

export function sortEngineerWorkOrders(tickets = []) {
  return [...tickets].sort((left, right) => {
    const priority = (ACTION_PRIORITY[left.status] ?? 99) - (ACTION_PRIORITY[right.status] ?? 99);
    if (priority !== 0) return priority;
    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
  });
}

export function getEngineerWorkOrderTitle(ticket = {}, isCn = false, fallback = '') {
  const description = String(ticket.description || '').split(/[。.!?\n]/)[0].trim();
  return ticket.issue_title || ticket.title || description || fallback || (isCn ? '服务任务' : 'Service task');
}

export function getEngineerScheduleLabel(ticket = {}, locale = 'en-US') {
  const value = ticket.scheduled_at || ticket.service_window_start || ticket.sla_deadline;
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
```

Use only fields already returned by the current work-order API. Do not add a backend field to support the schedule label.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
cd frontend && node --test tests/engineer-work-order-experience-contract.test.mjs
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the helper slice**

```bash
git add frontend/src/components/Engineer/engineerWorkOrderDisplay.js frontend/tests/engineer-work-order-experience-contract.test.mjs
git commit -m "test(engineer): define work order display contracts"
```

---

### Task 2: Build the structured work-order list

**Files:**
- Create: `frontend/src/components/Engineer/EngineerWorkOrderList.jsx`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`

**Interfaces:**
- Consumes: `tickets`, `loading`, `error`, `isCn`, `statusLabels`, `getNextAction`, `getMachineLine`, `formatDescription`, `onSelectTicket`, `onRetry`.
- Produces: `EngineerWorkOrderList(props): JSX.Element`.
- Produces no API calls and owns no work-order mutation.

- [ ] **Step 1: Add failing source-contract tests for the approved list**

Append:

```js
test('engineer work-order list is a structured action-first list with support contact', () => {
  const list = read('frontend/src/components/Engineer/EngineerWorkOrderList.jsx');

  assert.match(list, /sortEngineerWorkOrders\(tickets\)/);
  assert.match(list, /getEngineerWorkOrderTitle/);
  assert.match(list, /getEngineerScheduleLabel/);
  assert.match(list, /copy\.nextStep/);
  assert.match(list, /onSelectTicket\(ticket\)/);
  assert.match(list, /href="mailto:support@sagemro\.com"/);
  assert.match(list, /support@sagemro\.com/);
  assert.doesNotMatch(list, /grid-cols-5|personalMetrics|regionalMetrics/);
});

test('engineer work-order list exposes retry, empty, and localized labels', () => {
  const list = read('frontend/src/components/Engineer/EngineerWorkOrderList.jsx');

  assert.match(list, /onRetry/);
  assert.match(list, /Failed to load service tasks/);
  assert.match(list, /服务任务加载失败/);
  assert.match(list, /No assigned service tasks yet/);
  assert.match(list, /暂无已分配服务任务/);
  assert.match(list, /View Details/);
  assert.match(list, /查看详情/);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing component failure**

Run the Task 1 focused command.

Expected: FAIL because `EngineerWorkOrderList.jsx` does not exist.

- [ ] **Step 3: Implement the list component with compact status filters**

Create the component with this public shape and copy object:

```jsx
import { ChevronRight, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  getEngineerScheduleLabel,
  getEngineerWorkOrderTitle,
  sortEngineerWorkOrders,
} from './engineerWorkOrderDisplay';

const COPY = {
  en: {
    title: 'Service Work Orders', note: 'Ordered by the next action you need to take.',
    all: 'All', needsAction: 'Needs action', active: 'Active', completed: 'Completed',
    nextStep: 'Next step', view: 'View Details', loading: 'Loading service tasks...',
    loadFailed: 'Failed to load service tasks', retry: 'Retry', empty: 'No assigned service tasks yet',
    support: 'Need Admin support?', regionFallback: 'Region pending', taskFallback: 'Service task',
  },
  cn: {
    title: '服务工单', note: '按照你需要处理的下一步排序。',
    all: '全部', needsAction: '待处理', active: '进行中', completed: '已完成',
    nextStep: '下一步', view: '查看详情', loading: '正在加载服务任务...',
    loadFailed: '服务任务加载失败', retry: '重试', empty: '暂无已分配服务任务',
    support: '需要 Admin 协助？', regionFallback: '地区待补充', taskFallback: '服务任务',
  },
};

const FILTERS = {
  needsAction: new Set(['assigned', 'pending_dispatch', 'pricing', 'pending_payment']),
  active: new Set(['in_progress', 'in_service', 'payment_review', 'resolved', 'pending_review']),
  completed: new Set(['completed']),
};

export function EngineerWorkOrderList({
  tickets, loading, error, isCn, statusLabels, getNextAction, getMachineLine,
  formatDescription, onSelectTicket, onRetry,
}) {
  const copy = isCn ? COPY.cn : COPY.en;
  const [filter, setFilter] = useState('all');
  const visibleTickets = useMemo(() => {
    const sorted = sortEngineerWorkOrders(tickets);
    return filter === 'all' ? sorted : sorted.filter((ticket) => FILTERS[filter].has(ticket.status));
  }, [filter, tickets]);

  const content = loading ? (
    <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">{copy.loading}</div>
  ) : error ? (
    <div className="rounded-xl border border-[var(--color-error)]/30 p-5 text-center">
      <p className="text-sm text-[var(--color-error)]">{error || copy.loadFailed}</p>
      <button onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
        <RefreshCw size={14} />{copy.retry}
      </button>
    </div>
  ) : visibleTickets.length === 0 ? (
    <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">{copy.empty}</div>
  ) : (
    <div className="space-y-2">
      {visibleTickets.map((ticket) => {
        const schedule = getEngineerScheduleLabel(ticket, isCn ? 'zh-CN' : 'en-US');
        return (
          <article key={ticket.id} className="rounded-xl border border-l-2 border-[var(--color-border)] border-l-[var(--color-primary)] bg-[var(--color-surface)] p-4">
            <div className="gap-4 sm:flex sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{getEngineerWorkOrderTitle(ticket, isCn, copy.taskFallback)}</h3>
                  <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)]">{statusLabels[ticket.status] || ticket.status}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{ticket.order_no || ticket.id} · {getMachineLine(ticket)} · {ticket.customer_region || copy.regionFallback}</p>
                {schedule && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{schedule}</p>}
                <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{formatDescription(ticket.description || '')}</p>
                <p className="mt-3 text-sm"><span className="font-semibold text-[var(--color-primary)]">{copy.nextStep}:</span> {getNextAction(ticket)}</p>
              </div>
              <button onClick={() => onSelectTicket(ticket)} className="mt-3 inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium sm:mt-0">
                {copy.view}<ChevronRight size={15} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div className="mb-4 gap-3 sm:flex sm:items-end sm:justify-between">
        <div><h2 className="text-lg font-semibold">{copy.title}</h2><p className="text-sm text-[var(--color-text-muted)]">{copy.note}</p></div>
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
          {['all', 'needsAction', 'active', 'completed'].map((value) => (
            <button key={value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === value ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'}`}>{copy[value]}</button>
          ))}
        </div>
      </div>
      {content}
      <footer className="mt-5 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-text-muted)]">
        {copy.support} <a className="font-medium text-[var(--color-primary)]" href="mailto:support@sagemro.com">support@sagemro.com</a>
      </footer>
    </section>
  );
}
```

Do not add confirm, return, or assignment controls to this component.

- [ ] **Step 4: Run focused tests and lint the new file**

Run:

```bash
cd frontend && node --test tests/engineer-work-order-experience-contract.test.mjs
npx eslint src/components/Engineer/EngineerWorkOrderList.jsx src/components/Engineer/engineerWorkOrderDisplay.js
```

Expected: tests PASS and ESLint exits 0.

- [ ] **Step 5: Commit the list component**

```bash
git add frontend/src/components/Engineer/EngineerWorkOrderList.jsx frontend/tests/engineer-work-order-experience-contract.test.mjs
git commit -m "feat(engineer): add structured work order list"
```

---

### Task 3: Make existing work-order tools embeddable without changing customer behavior

**Files:**
- Modify: `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`

**Interfaces:**
- Produces: `WorkOrderDetailContent({ workOrder, userType, userId, onRateSuccess, onConfirmed, initialTab = 'info', showInfoTab = true }): JSX.Element | null`.
- Preserves: `WorkOrderDetailModal({ isOpen, onClose, workOrder, userType, userId, onRateSuccess, onConfirmed }): JSX.Element | null` and all existing callers.
- The content component owns existing detail loading, tabs, messages, pricing, service report, machine lead, reviews, and related actions.

- [ ] **Step 1: Add failing contracts for an exported content component and preserved modal wrapper**

Append:

```js
test('existing work-order tools can render inline while the customer modal wrapper remains', () => {
  const detail = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(detail, /export function WorkOrderDetailContent/);
  assert.match(detail, /export function WorkOrderDetailModal/);
  assert.match(detail, /<WorkOrderDetailContent/);
  assert.match(detail, /<Modal isOpen=\{isOpen\}/);
  assert.match(detail, /showInfoTab/);
  assert.match(detail, /MessagePanel/);
  assert.match(detail, /EngineerPricingPanel/);
  assert.match(detail, /RepairRecordPanel/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails on the missing export**

Run the Task 1 focused command.

Expected: FAIL because `WorkOrderDetailContent` is not exported.

- [ ] **Step 3: Extract content without rewriting business logic**

Make these exact structural edits in `WorkOrderDetailModal.jsx`:

1. Rename the current declaration `export function WorkOrderDetailModal({ isOpen, onClose, workOrder, userType, userId, onRateSuccess, onConfirmed })` to `export function WorkOrderDetailContent({ workOrder, userType, userId, onRateSuccess, onConfirmed, initialTab = 'info', showInfoTab = true })`.
2. Change the existing `useState('info')` tab declaration to `useState(initialTab)`.
3. Change the initial `tabs` literal from `[{ key: 'info', label: copy.tabs.info }, { key: 'messages', label: copy.tabs.messages }]` to:

```js
const tabs = [
  ...(showInfoTab ? [{ key: 'info', label: copy.tabs.info }] : []),
  { key: 'messages', label: copy.tabs.messages },
];
```

4. Add this effect immediately after the existing load-detail effect:

```js
useEffect(() => {
  if (!showInfoTab && tab === 'info') setTab('messages');
}, [showInfoTab, tab]);
```

5. In the component's final return, delete only the opening `<Modal isOpen={isOpen} onClose={onClose} title={copy.modalTitle} size="2xl">` and its matching closing `</Modal>`. Keep the complete existing `<div className="min-h-0">` tab navigation and all conditional panels in place.
6. Append this wrapper after `WorkOrderDetailContent`:

```jsx
export function WorkOrderDetailModal({
  isOpen,
  onClose,
  workOrder,
  userType,
  userId,
  onRateSuccess,
  onConfirmed,
}) {
  if (!workOrder) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isCnLocale() ? '工单详情' : 'Work Order Details'} size="2xl">
      <WorkOrderDetailContent
        workOrder={workOrder}
        userType={userType}
        userId={userId}
        onRateSuccess={onRateSuccess}
        onConfirmed={onConfirmed}
      />
    </Modal>
  );
}
```

Keep customer automatic rating-tab behavior inside `WorkOrderDetailContent`. Do not change API calls, permission conditions, toast copy, or customer-visible markup beyond these six edits.

- [ ] **Step 4: Run focused and existing language contracts**

Run:

```bash
cd frontend && node --test tests/engineer-work-order-experience-contract.test.mjs tests/cn-primary-ui-language-contract.test.mjs tests/en-site-language-contract.test.mjs
npx eslint src/components/WorkOrder/WorkOrderDetailModal.jsx
```

Expected: all tests PASS and ESLint exits 0.

- [ ] **Step 5: Commit the compatibility extraction**

```bash
git add frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx frontend/tests/engineer-work-order-experience-contract.test.mjs
git commit -m "refactor(workorder): allow inline detail tools"
```

---

### Task 4: Build the full-width engineer work-order detail workspace

**Files:**
- Create: `frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`

**Interfaces:**
- Consumes: selected summary `ticket`, `engineerId`, `isRegionalLead`, `team`, `selectedEngineer`, `assigningId`, localized `statusLabels`, existing helpers, and callbacks `onBack`, `onConfirmAssignment`, `onReturnAssignment`, `onAssignEngineer`, `onEngineerSelectionChange`, `onWorkOrderChanged`.
- Consumes API: `getWorkOrder(ticket.id)` only, through existing `frontend/src/services/api.js`.
- Embeds: `WorkOrderDetailContent` for existing messages, quote, report, and other operational tools.
- Produces: `EngineerWorkOrderDetail(props): JSX.Element`.

- [ ] **Step 1: Add failing contracts for approved detail structure**

Append:

```js
test('engineer detail uses the approved three-section reading order and inline tools', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');
  const contextIndex = detail.indexOf('Current Task Context');
  const preparationIndex = detail.indexOf('Job Preparation');
  const checklistIndex = detail.indexOf('Service Standard Checklist');

  assert.ok(contextIndex > -1 && contextIndex < preparationIndex && preparationIndex < checklistIndex);
  assert.match(detail, /当前任务上下文/);
  assert.match(detail, /服务准备/);
  assert.match(detail, /服务标准检查清单/);
  assert.match(detail, /WorkOrderDetailContent/);
  assert.match(detail, /sticky/);
  assert.match(detail, /lg:grid-cols-\[minmax\(0,1fr\)_/);
  assert.match(detail, /href="mailto:support@sagemro\.com"/);
});

test('engineer checklist is read-only and detail failures are recoverable', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');

  assert.doesNotMatch(detail, /type="checkbox"/);
  assert.doesNotMatch(detail, /onChange=.*checklist|setChecklist|saveChecklist/);
  assert.match(detail, /getWorkOrder\(ticket\.id\)/);
  assert.match(detail, /onClick=\{loadDetail\}/);
  assert.match(detail, /Back to Work Orders/);
  assert.match(detail, /返回工单/);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing component failure**

Run the Task 1 focused command.

Expected: FAIL because `EngineerWorkOrderDetail.jsx` does not exist.

- [ ] **Step 3: Implement localized data loading and the three information sections**

Create the component with:

```jsx
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWorkOrder } from '../../services/api';
import { WorkOrderDetailContent } from '../WorkOrder/WorkOrderDetailModal';

const CHECKLIST = {
  en: [
    'Confirm customer issue, machine model, site contact, and arrival window',
    'Review the intake summary and flag safety risks',
    'Check tools, spare parts, consumables, and protective equipment',
    'Record nameplate, alarm screen, and fault area photos on site',
    'Document service actions, parts replacement, and follow-up recommendations',
    'Submit the service report for customer confirmation',
  ],
  cn: [
    '确认客户问题、设备型号、现场联系人和到场时间',
    '查看接单摘要，并标记安全风险',
    '检查备件、工具、耗材和防护用品',
    '现场记录铭牌、报警画面和故障区域照片',
    '记录服务动作、配件更换和后续建议',
    '提交服务报告给客户确认',
  ],
};

export function EngineerWorkOrderDetail(props) {
  const {
    ticket, engineerId, isCn, isRegionalLead, team, selectedEngineer,
    assigningId, statusLabels, getNextAction, getMachineLine, formatDescription,
    onBack, onConfirmAssignment, onReturnAssignment, onAssignEngineer,
    onEngineerSelectionChange, onWorkOrderChanged,
  } = props;
  const [detail, setDetail] = useState(ticket);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDetail(await getWorkOrder(ticket.id));
    } catch (requestError) {
      setError(requestError.message || (isCn ? '工单详情加载失败' : 'Failed to load work-order details'));
    } finally {
      setLoading(false);
    }
  }, [isCn, ticket.id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const copy = isCn ? {
    back: '返回工单', context: '当前任务上下文', preparation: '服务准备',
    checklist: '服务标准检查清单', tools: '工单处理工具', nextStep: '当前下一步',
    retry: '重试', loading: '工单详情加载中...', customerIssue: '客户问题',
    machine: '设备 / 服务类型', region: '客户 / 地区', risk: '安全 / 优先级',
    intake: '接单摘要', equipment: '客户设备档案', attachments: '附件',
    confirm: '确认派工', returning: '退回中', returnDispatch: '填写原因并退回',
    assign: '分配工程师', assigning: '派工中', selectEngineer: '选择团队工程师',
    support: '需要 Admin 协助？', loadFailed: '工单详情加载失败',
  } : {
    back: 'Back to Work Orders', context: 'Current Task Context', preparation: 'Job Preparation',
    checklist: 'Service Standard Checklist', tools: 'Work-Order Tools', nextStep: 'Current next step',
    retry: 'Retry', loading: 'Loading work-order details...', customerIssue: 'Customer issue',
    machine: 'Machine / Service Type', region: 'Customer / Region', risk: 'Safety / Priority',
    intake: 'Intake summary', equipment: 'Customer equipment record', attachments: 'Attachments',
    confirm: 'Confirm Assignment', returning: 'Returning', returnDispatch: 'Return with a reason',
    assign: 'Assign Engineer', assigning: 'Assigning', selectEngineer: 'Select team engineer',
    support: 'Need Admin support?', loadFailed: 'Failed to load work-order details',
  };
  const effectiveStatus = detail?.status || ticket.status;
  const aiSummary = useMemo(() => {
    const raw = detail?.ai_summary;
    if (!raw) return detail?.description || ticket.description || '-';
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed.summary || detail?.description || ticket.description || '-';
    } catch {
      return String(raw);
    }
  }, [detail, ticket.description]);

  const header = (
    <header className="mb-4 flex flex-col gap-3 border-b border-[var(--color-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)]"><ArrowLeft size={16} />{copy.back}</button>
      <div className="sm:text-right"><div className="font-semibold">{detail?.order_no || ticket.order_no || ticket.id}</div><div className="text-xs text-[var(--color-text-muted)]">{statusLabels[effectiveStatus] || effectiveStatus}</div></div>
    </header>
  );

  if (loading) return <section>{header}<div className="rounded-xl border p-8 text-center text-sm text-[var(--color-text-muted)]">{copy.loading}</div></section>;
  if (error) return (
    <section>{header}<div className="rounded-xl border border-[var(--color-error)]/30 p-6 text-center"><p className="text-sm text-[var(--color-error)]">{error || copy.loadFailed}</p><div className="mt-4 flex justify-center gap-2"><button onClick={loadDetail} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm text-white">{copy.retry}</button><button onClick={onBack} className="rounded-lg border px-3 py-2 text-sm">{copy.back}</button></div></div></section>
  );

  const sectionClass = 'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5';
  const actionPanel = (
    <>
      {!isRegionalLead && effectiveStatus === 'assigned' && (
        <div className="mt-4 grid gap-2">
          <button onClick={() => onConfirmAssignment(detail)} disabled={assigningId === `${detail.id}:accept`} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{copy.confirm}</button>
          <button onClick={() => onReturnAssignment(detail)} disabled={assigningId === `${detail.id}:reject`} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50">{assigningId === `${detail.id}:reject` ? copy.returning : copy.returnDispatch}</button>
        </div>
      )}
      {isRegionalLead && (
        <div className="mt-4 grid gap-2">
          <select value={selectedEngineer[detail.id] || detail.engineer_id || ''} onChange={(event) => onEngineerSelectionChange(detail.id, event.target.value)} className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
            <option value="">{copy.selectEngineer}</option>
            {team.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.name}{engineer.service_region ? ` / ${engineer.service_region}` : ''}</option>)}
          </select>
          <button onClick={() => onAssignEngineer(detail)} disabled={assigningId === detail.id} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{assigningId === detail.id ? copy.assigning : copy.assign}</button>
        </div>
      )}
    </>
  );
  return (
    <section>
      {header}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <main className="space-y-4">
          <section className={sectionClass}><div className="text-xs font-semibold text-[var(--color-primary)]">01 · {copy.context}</div><div className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><div className="text-xs text-[var(--color-text-muted)]">{copy.customerIssue}</div><p className="mt-1">{formatDescription(detail?.description || ticket.description || '-')}</p></div><div><div className="text-xs text-[var(--color-text-muted)]">{copy.machine}</div><p className="mt-1">{getMachineLine(detail)}</p></div><div><div className="text-xs text-[var(--color-text-muted)]">{copy.region}</div><p className="mt-1">{detail?.customer_name || '-'} / {detail?.customer_region || '-'}</p></div><div><div className="text-xs text-[var(--color-text-muted)]">{copy.risk}</div><p className="mt-1">{detail?.urgency || 'normal'}</p></div></div></section>
          <section className={sectionClass}><div className="text-xs font-semibold text-[var(--color-primary)]">02 · {copy.preparation}</div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-xl bg-[var(--color-surface-elevated)] p-3"><div className="text-xs text-[var(--color-text-muted)]">{copy.intake}</div><p className="mt-1">{formatDescription(aiSummary)}</p></div><div className="rounded-xl bg-[var(--color-surface-elevated)] p-3"><div className="text-xs text-[var(--color-text-muted)]">{copy.equipment}</div><p className="mt-1">{getMachineLine(detail)}</p></div><div className="rounded-xl bg-[var(--color-surface-elevated)] p-3 sm:col-span-2"><div className="text-xs text-[var(--color-text-muted)]">{copy.attachments}</div><p className="mt-1">{detail?.attachments?.length || 0}</p></div></div></section>
          <section className={sectionClass}><div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-primary)]"><ShieldCheck size={16} />03 · {copy.checklist}</div><ol className="mt-4 space-y-3">{CHECKLIST[isCn ? 'cn' : 'en'].map((item, index) => <li key={item} className="flex gap-3 text-sm text-[var(--color-text-secondary)]"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-semibold text-[var(--color-primary)]">{index + 1}</span><span>{item}</span></li>)}</ol></section>
          <section className={sectionClass}><h2 className="mb-4 font-semibold">{copy.tools}</h2><WorkOrderDetailContent workOrder={detail} userType="engineer" userId={engineerId} showInfoTab={false} initialTab="messages" onConfirmed={() => { loadDetail(); onWorkOrderChanged(); }} onRateSuccess={() => { loadDetail(); onWorkOrderChanged(); }} /></section>
        </main>
        <aside className="self-start rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:sticky lg:top-4"><div className="text-xs text-[var(--color-text-muted)]">{copy.nextStep}</div><p className="mt-1 text-sm font-semibold">{getNextAction(detail)}</p>{actionPanel}<div className="mt-4 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-text-muted)]">{copy.support} <a className="font-medium text-[var(--color-primary)]" href="mailto:support@sagemro.com">support@sagemro.com</a></div></aside>
      </div>
    </section>
  );
}
```

Do not invent recommended parts from category alone.

- [ ] **Step 4: Implement the role/status action panel by calling parent callbacks**

Use the same conditions currently present in `EngineerWorkspace`:

```jsx
{!isRegionalLead && effectiveStatus === 'assigned' && (
  <div className="mt-4 grid gap-2">
    <button onClick={() => onConfirmAssignment(detail)} disabled={assigningId === `${detail.id}:accept`} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{copy.confirm}</button>
    <button onClick={() => onReturnAssignment(detail)} disabled={assigningId === `${detail.id}:reject`} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50">{assigningId === `${detail.id}:reject` ? copy.returning : copy.returnDispatch}</button>
  </div>
)}

{isRegionalLead && (
  <div className="mt-4 grid gap-2">
    <select
      value={selectedEngineer[detail.id] || detail.engineer_id || ''}
      onChange={(event) => onEngineerSelectionChange(detail.id, event.target.value)}
      className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm"
    >
      <option value="">{copy.selectEngineer}</option>
      {team.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.name}{engineer.service_region ? ` / ${engineer.service_region}` : ''}</option>)}
    </select>
    <button onClick={() => onAssignEngineer(detail)} disabled={assigningId === detail.id} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{assigningId === detail.id ? copy.assigning : copy.assign}</button>
  </div>
)}
```

Display no action when the current status has no parent-owned action; the embedded tools still expose valid message, quote, report, and review workflows.

- [ ] **Step 5: Run focused tests and lint the detail component**

Run:

```bash
cd frontend && node --test tests/engineer-work-order-experience-contract.test.mjs
npx eslint src/components/Engineer/EngineerWorkOrderDetail.jsx
```

Expected: tests PASS and ESLint exits 0.

- [ ] **Step 6: Commit the detail workspace**

```bash
git add frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx frontend/tests/engineer-work-order-experience-contract.test.mjs
git commit -m "feat(engineer): add focused work order detail workspace"
```

---

### Task 5: Integrate list/detail navigation and simplify `EngineerWorkspace`

**Files:**
- Modify: `frontend/src/components/Engineer/EngineerWorkspace.jsx`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`
- Modify: `frontend/tests/cn-primary-ui-language-contract.test.mjs`

**Interfaces:**
- `EngineerWorkspace` remains called with `{ currentUser, onLogout, onOpenProfile }` from `App.jsx`.
- Owns: tickets, list error/loading, selected ticket, availability, calendar modal, Regional Lead team/assignment state, and mutation callbacks.
- Delegates list rendering to `EngineerWorkOrderList` and detail rendering to `EngineerWorkOrderDetail`.

- [ ] **Step 1: Add failing navigation and cleanup contracts**

Append to the focused contract:

```js
test('engineer workspace switches between focused list and detail without a modal', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  assert.match(workspace, /EngineerWorkOrderList/);
  assert.match(workspace, /EngineerWorkOrderDetail/);
  assert.match(workspace, /selectedTicket \?/);
  assert.match(workspace, /setSelectedTicket\(null\)/);
  assert.doesNotMatch(workspace, /<WorkOrderDetailModal/);
  assert.doesNotMatch(workspace, /personalMetrics|regionalMetrics|const metrics/);
  assert.doesNotMatch(workspace, /type="checkbox"/);
});
```

Update the CN engineer-workspace test to read all three files:

```js
const workspace = [
  read('frontend/src/components/Engineer/EngineerWorkspace.jsx'),
  read('frontend/src/components/Engineer/EngineerWorkOrderList.jsx'),
  read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx'),
].join('\n');
```

Keep assertions for `工程师工作台`, `区域负责人工作台`, `排期日历`, `服务任务`, `当前任务上下文`, `服务准备`, and `服务标准检查清单`. Remove the obsolete `任务概览` assertion because the decorative overview is intentionally removed.

- [ ] **Step 2: Run focused and CN tests and confirm they fail**

Run:

```bash
cd frontend && node --test tests/engineer-work-order-experience-contract.test.mjs tests/cn-primary-ui-language-contract.test.mjs
```

Expected: FAIL because `EngineerWorkspace` still renders the modal and metrics dashboard.

- [ ] **Step 3: Replace the dashboard body with list/detail delegation**

In `EngineerWorkspace.jsx`:

```jsx
import { EngineerWorkOrderDetail } from './EngineerWorkOrderDetail';
import { EngineerWorkOrderList } from './EngineerWorkOrderList';
```

Change `loadTickets` to preserve a recoverable list error:

```js
const [loadError, setLoadError] = useState('');

const loadTickets = useCallback(async () => {
  if (!engineerId) return;
  setLoading(true);
  setLoadError('');
  try {
    const data = await getEngineerTickets(engineerId);
    setTickets(data.work_orders || []);
  } catch (error) {
    setLoadError(error.message || copy.loadTasksFailed);
  } finally {
    setLoading(false);
  }
}, [engineerId, copy.loadTasksFailed]);
```

After successful assignment/confirm/return, synchronize detail navigation:

```js
const refreshTicketsAndSelection = useCallback(async () => {
  const data = await getEngineerTickets(engineerId);
  const nextTickets = data.work_orders || [];
  setTickets(nextTickets);
  setSelectedTicket((current) => current
    ? nextTickets.find((ticket) => ticket.id === current.id) || current
    : null);
}, [engineerId]);
```

Replace the existing metric/task/context/preparation/checklist grid with:

```jsx
{selectedTicket ? (
  <EngineerWorkOrderDetail
    ticket={selectedTicket}
    engineerId={engineerId}
    isCn={isCn}
    isRegionalLead={isRegionalLead}
    team={team}
    selectedEngineer={selectedEngineer}
    assigningId={assigningId}
    statusLabels={statusLabels}
    getNextAction={(ticket) => getNextAction(ticket, copy)}
    getMachineLine={(ticket) => getMachineLine(ticket, isCn, copy)}
    formatDescription={(value) => formatEngineerDescription(value, isCn)}
    onBack={() => setSelectedTicket(null)}
    onRetry={loadTickets}
    onConfirmAssignment={confirmAssignment}
    onReturnAssignment={returnAssignment}
    onAssignEngineer={assignToEngineer}
    onEngineerSelectionChange={(ticketId, value) => setSelectedEngineer((current) => ({ ...current, [ticketId]: value }))}
    onWorkOrderChanged={refreshTicketsAndSelection}
  />
) : (
  <EngineerWorkOrderList
    tickets={tickets}
    loading={loading}
    error={loadError}
    isCn={isCn}
    statusLabels={statusLabels}
    getNextAction={(ticket) => getNextAction(ticket, copy)}
    getMachineLine={(ticket) => getMachineLine(ticket, isCn, copy)}
    formatDescription={(value) => formatEngineerDescription(value, isCn)}
    onSelectTicket={setSelectedTicket}
    onRetry={loadTickets}
  />
)}
```

Keep the workspace header, availability controls and compact calendar entry above the delegated content. Remove metric cards, duplicated context/preparation/checklist aside, `activeTicket`, `activeAiSummary`, and the `WorkOrderDetailModal` import/render. Remove imports made unused by those deletions.

- [ ] **Step 4: Keep the calendar secondary and responsive**

Render the availability/calendar controls as one compact toolbar rather than the previous two-column dashboard. Keep the existing `EngineerAvailabilityCalendar` modal and preview data behavior unchanged. Verify the toolbar does not push the work-order list below a full viewport on a typical laptop.

- [ ] **Step 5: Run focused contracts and lint all touched engineer files**

Run:

```bash
cd frontend && node --test tests/engineer-work-order-experience-contract.test.mjs tests/cn-primary-ui-language-contract.test.mjs
npx eslint src/components/Engineer/EngineerWorkspace.jsx src/components/Engineer/EngineerWorkOrderList.jsx src/components/Engineer/EngineerWorkOrderDetail.jsx src/components/Engineer/engineerWorkOrderDisplay.js
```

Expected: all tests PASS and ESLint exits 0.

- [ ] **Step 6: Commit integration**

```bash
git add frontend/src/components/Engineer/EngineerWorkspace.jsx frontend/tests/engineer-work-order-experience-contract.test.mjs frontend/tests/cn-primary-ui-language-contract.test.mjs
git commit -m "feat(engineer): simplify work order workspace navigation"
```

---

### Task 6: Verify behavior, responsive layout, and production build

**Files:**
- Modify only if verification finds a defect directly caused by Tasks 1-5.

**Interfaces:**
- No new interface. This task validates the accepted design and existing workflows.

- [ ] **Step 1: Run the complete frontend test suite**

Run:

```bash
cd frontend && npm test
```

Expected: all Node tests PASS, including `engineer-work-order-experience-contract.test.mjs`, CN language contracts, and COM language contracts.

- [ ] **Step 2: Run complete frontend lint and build**

Run:

```bash
cd frontend && npm run lint
cd frontend && npm run build
```

Expected: both commands exit 0; Vite creates `frontend/dist` without unresolved imports or JSX errors.

- [ ] **Step 3: Run local visual and interaction checks on both hosts**

Start the built frontend with host-header access supported by the existing local workflow, then verify at desktop width (approximately 1440 px) and mobile width (approximately 390 px):

1. English engineer account opens a structured action-first list.
2. Chinese engineer account shows equivalent Chinese labels without mixed English operational headings.
3. Selecting a row opens the full-width detail state; Back restores the list.
4. Detail sections appear in Context → Preparation → Checklist order.
5. Checklist rows are non-interactive and contain no checkbox controls.
6. Desktop action panel remains visible without covering content; mobile action panel follows content in normal flow.
7. `support@sagemro.com` appears in the list footer and detail action panel; clicking it targets `mailto:support@sagemro.com`.
8. Engineer confirm/return actions still work for an assigned task.
9. Regional Lead engineer selection and assignment still work.
10. Messages, quote, service report, and other status-valid tools render inline, not in a modal.
11. Force a list request failure and a detail request failure; each state keeps context and exposes Retry.

- [ ] **Step 4: Inspect the final diff for surgical scope**

Run:

```bash
git diff --stat HEAD~4..HEAD
git diff --check HEAD~4..HEAD
git status --short
```

Expected: changes are limited to the files named in this plan; no Worker, migration, admin, recruiting-page, authentication, or unrelated formatting changes are present. Pre-existing user changes remain untouched.

- [ ] **Step 5: Commit any verification-only corrections**

If Step 3 finds a defect, add a focused failing contract first, make the minimum correction, rerun Steps 1-4, then commit only those files:

```bash
git add frontend/src/components/Engineer/EngineerWorkspace.jsx frontend/src/components/Engineer/EngineerWorkOrderList.jsx frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx frontend/src/components/Engineer/engineerWorkOrderDisplay.js frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx frontend/tests/engineer-work-order-experience-contract.test.mjs frontend/tests/cn-primary-ui-language-contract.test.mjs
git commit -m "fix(engineer): polish work order workspace behavior"
```

If no correction is required, do not create an empty commit.

---

## Completion checklist

- The list is the default engineer workspace and is ordered by required action.
- Every list row exposes status and a plain-language next step.
- Detail navigation is full-width local state, not a modal and not a new URL route.
- Current Task Context, Job Preparation, and Service Standard Checklist appear in the approved order.
- The checklist is read-only and has no persistence path.
- Existing messages, quote, service report, review and machine-lead tools remain available inline according to existing status/role rules.
- Engineer and Regional Lead dispatch actions retain existing API calls and permission checks.
- Admin support mail links work in both required locations.
- Loading, empty, list error, detail error and action error states preserve context and offer recovery.
- English/Chinese and desktop/mobile verification passes.
- Full frontend tests, lint and production build pass.
