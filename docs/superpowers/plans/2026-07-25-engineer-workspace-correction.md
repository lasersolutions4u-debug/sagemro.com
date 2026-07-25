# Engineer Workspace Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the approved engineer dashboard, regional-team visibility, independent work-order pages, editable personal calendar, and strict host-language behavior without weakening execution permissions.

**Architecture:** Keep the existing React/Vite application and manual `history.pushState` routing. Add pure dashboard helpers and focused presentation components, extend the authenticated engineer ticket API with `scope=personal|team`, and introduce an async regional-team read guard while leaving execution mutations assigned-engineer-only. Reuse the existing work-order panels through a controlled single-tab interface instead of duplicating quote, payment, material, field-work, or report logic.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4, Cloudflare Workers, D1/SQLite, Node test runner, Playwright.

## Global Constraints

- Do not add a router dependency or database migration.
- Do not modify `wrangler.toml`, GitHub workflows, or Cloudflare Pages project names.
- `.com` engineer UI and system-generated content must be English; `.cn` must be Chinese.
- The authenticated engineer identity is authoritative; never trust `engineer_id` query/body input for self-service reads or writes.
- Regional leads receive management read/assignment access only; quote, material, field-service, and report mutations remain restricted to the executing engineer.
- Work-order-backed calendar events are read-only in the personal calendar; only personal calendar events can be updated or deleted.
- Preserve existing quote, payment, material requisition, field-work, service-report, profile, and dispatch workflows.

---

## File structure

- Create `frontend/src/components/Engineer/engineerWorkOrderMetrics.js`: pure eight-metric and team-group derivation.
- Create `frontend/src/components/Engineer/EngineerMetricOverview.jsx`: synchronized personal/team scope switch and eight metric cards.
- Create `frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx`: unassigned queue, lead, and subordinate groups.
- Create `frontend/src/components/Engineer/engineerWorkOrderContent.js`: locale-safe customer/original-content presentation helpers.
- Modify `frontend/src/components/Engineer/EngineerWorkspace.jsx`: dashboard-only composition, scope loading, calendar, profile, and URL navigation.
- Modify `frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx`: URL-driven page shell and six high-level tabs.
- Modify `frontend/src/components/Engineer/EngineerWorkOrderList.jsx`: concise rows that navigate to detail URLs.
- Modify `frontend/src/components/Engineer/EngineerAvailabilityCalendar.jsx`: personal-event edit mode and protected scheduled events.
- Modify `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`: controlled single-tool rendering while retaining existing modal behavior.
- Modify `frontend/src/components/WorkOrder/MessagePanel.jsx`: locale system messages and labelled customer-original content.
- Modify `frontend/src/App.jsx`: recognize `/work-orders/:workOrderId` on the engineer host.
- Modify `frontend/src/services/api.js`: scoped ticket reads and calendar PATCH.
- Modify `worker/src/index.js`: scoped ticket query, async team-read checks, read-endpoint usage, calendar PATCH/delete protection.
- Modify `worker/src/lib/guards.js`: keep the current synchronous ownership guard and add pure relation classification helpers only.
- Create `worker/tests/engineer-workspace-access.test.mjs`: ticket scopes, team reads, mutation denial, and calendar ownership regression coverage.
- Modify `frontend/tests/engineer-work-order-experience-contract.test.mjs`: corrected layout/routing/language contracts.
- Modify `frontend/tests/brand-assets-contract.test.mjs`: remove assertions for the rejected stacked design and assert the restored metrics.
- Modify the three lifecycle Playwright specs to follow URLs/tabs and verify browser refresh/back.

### Task 1: Worker ticket scopes and ownership metadata

**Files:**
- Create: `worker/tests/engineer-workspace-access.test.mjs`
- Modify: `worker/src/index.js`
- Modify: `worker/package.json`

**Interfaces:**
- Consumes: authenticated `request._auth.userId`, `engineers.engineer_role`, and `engineers.regional_lead_id`.
- Produces: `GET /api/engineers/tickets?scope=personal|team` returning `{ scope, is_regional_lead, work_orders, team }`; each work order has `ownership_relation` equal to `personal`, `current_team_member`, `regional_queue`, or `historical_supervision`.

- [ ] **Step 1: Write failing API tests**

Create a SQLite-backed fixture that inserts one lead, one direct subordinate, one outsider, the lead's personal work order, the subordinate's order, a lead queue order, and an unrelated order. Assert:

```js
assert.deepEqual(personal.work_orders.map((row) => row.id), ['wo-lead']);
assert.deepEqual(
  team.work_orders.map((row) => [row.id, row.ownership_relation]),
  [
    ['wo-queue', 'regional_queue'],
    ['wo-lead', 'personal'],
    ['wo-member', 'current_team_member'],
  ],
);
assert.equal(normalEngineerTeam.response.status, 403);
assert.equal(team.work_orders.some((row) => row.id === 'wo-outsider'), false);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/engineer-workspace-access.test.mjs`

Expected: FAIL because `scope=team` does not include subordinate orders and ownership metadata is absent.

- [ ] **Step 3: Implement authenticated scope selection**

In `handleGetEngineerTickets`, ignore the query-string `engineer_id`, default to `personal`, reject `team` for ordinary engineers, and use bound SQL conditions:

```js
const auth = request._auth;
if (!auth || auth.userType !== 'engineer') return errorResponse('需要工程师权限', 403);
const requestedScope = url.searchParams.get('scope') === 'team' ? 'team' : 'personal';
const engineer = await env.DB.prepare(
  'SELECT id, name, engineer_role FROM engineers WHERE id = ?'
).bind(auth.userId).first();
const isRegionalLead = engineer?.engineer_role === 'regional_lead';
if (requestedScope === 'team' && !isRegionalLead) return errorResponse('仅区域负责人可查看团队工单', 403);
```

For team scope, load current members once and classify rows in JavaScript using authoritative IDs. The query must cover the lead, current subordinate IDs, and retained `assigned_regional_lead_id`; classification priority is queue, personal, current member, historical supervision.

- [ ] **Step 4: Add the new test to the Worker full test script**

Append `tests/engineer-workspace-access.test.mjs` to `worker/package.json` `test` and `test:unit` commands.

- [ ] **Step 5: Run focused and Worker pretests**

Run: `node --test tests/engineer-workspace-access.test.mjs && npm run pretest`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.js worker/tests/engineer-workspace-access.test.mjs worker/package.json
git commit -m "feat(engineer): add personal and regional team work scopes"
```

### Task 2: Regional-team read access without execution mutation access

**Files:**
- Modify: `worker/tests/engineer-workspace-access.test.mjs`
- Modify: `worker/src/index.js`
- Modify: `worker/src/lib/guards.js`

**Interfaces:**
- Consumes: work order `{ engineer_id, assigned_regional_lead_id }` and authenticated engineer ID.
- Produces: `getEngineerWorkOrderReadRelation(env, auth, workOrder)` returning the same ownership relation or `null`; `assertEngineerWorkOrderReadAccess(...)` throws `GuardError` when relation is absent.

- [ ] **Step 1: Write failing read/mutation boundary tests**

Assert that a direct subordinate's lead can read the subordinate work-order detail, messages, pricing, and material-requisition status, while an unrelated lead cannot. Also assert that the same lead receives `403` when submitting a quote, creating/submitting a material requisition, saving field work, or submitting a service report for the subordinate.

```js
assert.equal(subordinateDetail.response.status, 200);
assert.equal(subordinateMessages.response.status, 200);
assert.equal(unrelatedLeadDetail.response.status, 403);
assert.equal(leadQuoteMutation.response.status, 403);
assert.equal(leadMaterialMutation.response.status, 403);
assert.equal(leadFieldMutation.response.status, 403);
assert.equal(leadReportMutation.response.status, 403);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/engineer-workspace-access.test.mjs`

Expected: subordinate read requests fail because `assertWorkOrderAccess` only knows explicit work-order participants.

- [ ] **Step 3: Add the asynchronous management read guard**

Implement a DB-aware helper in `worker/src/index.js`:

```js
async function getEngineerWorkOrderReadRelation(env, auth, workOrder) {
  if (auth?.userType !== 'engineer' || !workOrder) return null;
  if (workOrder.engineer_id === auth.userId) return 'personal';
  if (!workOrder.engineer_id && workOrder.assigned_regional_lead_id === auth.userId) return 'regional_queue';
  const lead = await env.DB.prepare(
    "SELECT id FROM engineers WHERE id = ? AND engineer_role = 'regional_lead'"
  ).bind(auth.userId).first();
  if (!lead) return workOrder.assigned_regional_lead_id === auth.userId ? 'historical_supervision' : null;
  if (workOrder.engineer_id) {
    const member = await env.DB.prepare(
      'SELECT id FROM engineers WHERE id = ? AND regional_lead_id = ?'
    ).bind(workOrder.engineer_id, auth.userId).first();
    if (member) return 'current_team_member';
  }
  return workOrder.assigned_regional_lead_id === auth.userId ? 'historical_supervision' : null;
}
```

Use it only in the relevant GET/read handlers. Retain the existing `assertWorkOrderAccess` or explicit executing-engineer checks on mutations.

- [ ] **Step 4: Run focused tests and existing guard/API suites**

Run: `node --test tests/engineer-workspace-access.test.mjs tests/guards.test.mjs tests/work-order-messages.test.mjs tests/quote-execution-api.test.mjs tests/material-requisitions.test.mjs`

Expected: all pass, including mutation denials.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.js worker/src/lib/guards.js worker/tests/engineer-workspace-access.test.mjs
git commit -m "fix(engineer): separate regional read and execution permissions"
```

### Task 3: Editable personal calendar with scheduled-event protection

**Files:**
- Modify: `worker/tests/engineer-workspace-access.test.mjs`
- Modify: `worker/src/index.js`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/components/Engineer/EngineerAvailabilityCalendar.jsx`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`

**Interfaces:**
- Produces: `PATCH /api/engineers/calendar-events/:eventId` and `updateEngineerCalendarEvent(eventId, payload)`.
- Calendar rows with `work_order_id` render as scheduled/read-only and expose no edit/delete controls.

- [ ] **Step 1: Write failing calendar API and frontend contract tests**

```js
assert.equal(updateOwnPersonal.response.status, 200);
assert.equal(updateOtherEngineer.response.status, 404);
assert.equal(updateWorkOrderEvent.response.status, 409);
assert.equal(deleteWorkOrderEvent.response.status, 409);
assert.equal(deleteOwnPersonal.response.status, 200);
```

Frontend contracts must match `updateEngineerCalendarEvent`, an edit button for personal events, and a `work_order_id` read-only guard.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/engineer-workspace-access.test.mjs && npm test -- --test-name-pattern="calendar"`

Expected: PATCH route/helper/edit UI are missing; DELETE currently removes scheduled events.

- [ ] **Step 3: Implement PATCH and protected DELETE**

Load the event with both `id` and authenticated `engineer_id`; return `409` when `work_order_id` is non-null. Update only `event_type`, `title`, `start_at`, `end_at`, `timezone`, `region`, `city`, and `notes`, using the same validation as create.

Route PATCH before DELETE:

```js
if (path.startsWith('/api/engineers/calendar-events/') && request.method === 'PATCH') {
  return handleUpdateEngineerCalendarEvent(request, env);
}
```

- [ ] **Step 4: Add calendar edit mode**

Use one form for create/edit. Selecting Edit copies a personal event into the form; submit calls PATCH and reloads. For `work_order_id` rows show localized `Scheduled from work order`/`工单排期` text and hide edit/delete buttons.

- [ ] **Step 5: Run focused Worker/frontend tests**

Run: `node --test tests/engineer-workspace-access.test.mjs && npm test`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.js worker/tests/engineer-workspace-access.test.mjs frontend/src/services/api.js frontend/src/components/Engineer/EngineerAvailabilityCalendar.jsx frontend/tests/engineer-work-order-experience-contract.test.mjs
git commit -m "feat(engineer): edit personal calendar safely"
```

### Task 4: Eight synchronized metrics and team grouping

**Files:**
- Create: `frontend/src/components/Engineer/engineerWorkOrderMetrics.js`
- Create: `frontend/src/components/Engineer/EngineerMetricOverview.jsx`
- Create: `frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx`
- Modify: `frontend/src/components/Engineer/EngineerWorkspace.jsx`
- Modify: `frontend/src/components/Engineer/EngineerWorkOrderList.jsx`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`
- Modify: `frontend/tests/brand-assets-contract.test.mjs`

**Interfaces:**
- Produces: `buildEngineerMetrics(tickets, calendarEvents, now)`, `groupRegionalTeamWorkOrders(tickets, team, lead)`, and `getEngineerTickets({ scope })`.
- `EngineerMetricOverview` receives `{ metrics, scope, onScopeChange, isRegionalLead, loading }`.

- [ ] **Step 1: Write failing pure-helper and component contract tests**

Assert exactly eight keys and deterministic counts:

```js
assert.deepEqual(Object.keys(metrics), [
  'needsAction', 'todayTasks', 'pendingConfirmation', 'inService',
  'quotePending', 'scheduledDates', 'reportsDue', 'partsNeeds',
]);
assert.deepEqual(groups.map((group) => group.key), ['regional_queue', 'lead-1', 'eng-amy', 'eng-ben']);
```

Source contracts must require `My metrics`, `Team metrics`, eight cards, team engineer names, and must reject `selectedTicket` dashboard branching.

- [ ] **Step 2: Run frontend tests and verify RED**

Run: `npm test`

Expected: metric/group helpers and components are missing; rejected tests still assert metrics are absent.

- [ ] **Step 3: Implement pure metrics and grouping**

Map metrics from statuses and existing fields without inventing backend state. `scheduledDates` uses unique future event dates; `partsNeeds` counts work orders with material requisition/parts signals already returned by the API. Groups are ordered queue, lead, then case-insensitive engineer name.

- [ ] **Step 4: Refactor the workspace to dashboard-only scope state**

Replace `selectedTicket` with:

```js
const [scope, setScope] = useState('personal');
const openWorkOrder = (ticket) => {
  window.history.pushState({}, '', `/work-orders/${encodeURIComponent(ticket.id)}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
```

Load `getEngineerTickets({ scope })`; render `EngineerMetricOverview` and either the personal list or `EngineerTeamWorkOrderList`. Keep the calendar bound to the signed-in engineer in both scopes.

- [ ] **Step 5: Run tests, lint, and build**

Run: `npm test && npm run lint && npm run build`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Engineer frontend/src/services/api.js frontend/tests/engineer-work-order-experience-contract.test.mjs frontend/tests/brand-assets-contract.test.mjs
git commit -m "feat(engineer): restore personal and team dashboard metrics"
```

### Task 5: Real work-order detail URL and six high-level tabs

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Engineer/EngineerWorkspace.jsx`
- Modify: `frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx`
- Modify: `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`
- Modify: `frontend/tests/routing-and-layout-contract.test.mjs`

**Interfaces:**
- `App` derives `workOrderId` from `^/work-orders/([^/]+)$` and passes it to the workspace.
- `WorkOrderDetailContent` accepts `controlledTab` and `showTabNavigation=false`; it renders only the requested existing tool.

- [ ] **Step 1: Write failing route and tab contracts**

```js
assert.match(app, /match\(\/\^\\\/work-orders\\\/\(\[\^\/\]\+\)\$\//);
assert.match(detail, /Overview/);
assert.match(detail, /Messages/);
assert.match(detail, /Quote/);
assert.match(detail, /Material request/);
assert.match(detail, /Field service/);
assert.match(detail, /Service report/);
assert.doesNotMatch(workspace, /selectedTicket/);
```

- [ ] **Step 2: Run frontend tests and verify RED**

Run: `npm test`

Expected: the URL parser and controlled detail tabs are absent.

- [ ] **Step 3: Route the engineer host detail page**

Treat `/work-orders/:id` as an authenticated engineer-host route. Pass the decoded ID to `EngineerWorkspace`; browser back/forward already updates `currentPath` through the existing `popstate` listener.

- [ ] **Step 4: Convert detail to a page shell**

Fetch the work order by ID, show loading/not-found/permission states, render breadcrumb, work-order identity, status, customer/region/executing engineer/schedule, and current next step. Use six stable tab keys:

```js
const DETAIL_TABS = ['overview', 'messages', 'quote', 'material', 'field', 'report'];
```

Overview contains task context, preparation, and the read-only service-standard checklist. Each other tab mounts one existing panel through controlled `WorkOrderDetailContent`; do not render the modal's internal tab bar.

- [ ] **Step 5: Preserve refresh/back and existing actions**

Assignment controls remain in the detail header for eligible regional leads. Executing-engineer confirmation/return actions remain reachable. `onRefresh` reloads the current work-order ID without returning to the list.

- [ ] **Step 6: Run frontend tests, lint, and build**

Run: `npm test && npm run lint && npm run build`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/Engineer/EngineerWorkspace.jsx frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx frontend/tests
git commit -m "feat(engineer): add routed tabbed work order pages"
```

### Task 6: Host-consistent language and labelled original content

**Files:**
- Create: `frontend/src/components/Engineer/engineerWorkOrderContent.js`
- Modify: `frontend/src/components/Engineer/EngineerWorkspace.jsx`
- Modify: `frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx`
- Modify: `frontend/src/components/WorkOrder/MessagePanel.jsx`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`
- Modify: `frontend/tests/brand-assets-contract.test.mjs`

**Interfaces:**
- Produces: `hasChineseText(value)`, `getLocalizedCustomerContent(record, locale)`, and `localizeWorkOrderSystemMessage(message, locale)`.
- Customer-content result is `{ primaryText, primaryLabel, originalText, originalLabel }`.

- [ ] **Step 1: Write failing locale-helper tests**

Cover translated-primary behavior, original-on-demand, and stable system-message localization:

```js
assert.deepEqual(getLocalizedCustomerContent({ content: '设备停机', content_en: 'Machine stopped' }, 'en'), {
  primaryText: 'Machine stopped',
  primaryLabel: 'English translation',
  originalText: '设备停机',
  originalLabel: 'Customer original',
});
assert.equal(localizeWorkOrderSystemMessage({ message_type: 'ticket_accepted' }, 'en'), 'The engineer confirmed the assignment.');
```

Assert the workspace no longer contains `CHINESE_ENGINEER_DESCRIPTION_TERMS` or `replaceChineseDeviceLabels`.

- [ ] **Step 2: Run frontend tests and verify RED**

Run: `npm test`

Expected: locale helpers do not exist and ad-hoc Chinese replacement is still present.

- [ ] **Step 3: Implement structured locale rendering**

Prefer existing translated fields such as `description_en`, `content_en`, `translated_content`, or AI summary fields when present. If `.com` has only Chinese customer-authored content, render it inside a collapsed labelled `Customer original` block; do not present it as UI copy. Localize known system messages from `message_type` and stable patterns.

- [ ] **Step 4: Remove partial word replacement**

Delete `CHINESE_ENGINEER_DESCRIPTION_TERMS` and `replaceChineseDeviceLabels`; route task descriptions and messages through the structured helper. Ensure headings, statuses, empty states, errors, and buttons all come from `WORKSPACE_COPY`/detail/message locale maps.

- [ ] **Step 5: Run frontend tests, lint, build, and static Chinese scan**

Run: `npm test && npm run lint && npm run build && rg -n "[一-龥]" dist/assets/*.js`

Expected: tests/lint/build pass. The bundle scan may contain `.cn` locale dictionaries, but browser verification of the `.com` initial screen must show no Chinese UI/system text.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Engineer frontend/src/components/WorkOrder/MessagePanel.jsx frontend/tests
git commit -m "fix(engineer): keep workspace content locale consistent"
```

### Task 7: Update lifecycle E2E coverage for routed tabs

**Files:**
- Modify: `e2e/tests/quote-execution-visual.spec.mjs`
- Modify: `e2e/tests/material-requisition-lifecycle.spec.mjs`
- Modify: `e2e/tests/service-order-lifecycle.spec.mjs`

**Interfaces:**
- Produces shared test behavior: click a work-order row, assert `/work-orders/:id`, refresh, select the relevant high-level tab, complete the existing workflow, and use browser Back to return to the list.

- [ ] **Step 1: Update E2E assertions before running the new UI**

Replace same-page detail assumptions with:

```js
await page.getByRole('button', { name: /View|Handle Task/ }).first().click();
await expect(page).toHaveURL(/\/work-orders\/[^/]+$/);
await page.reload();
await expect(page.getByRole('heading', { name: /Work Order/ })).toBeVisible();
await page.getByRole('tab', { name: 'Quote' }).click();
```

Material tests select `Material request`; field/report tests select `Field service` or `Service report`. Add `page.goBack()` and assert the list returns.

- [ ] **Step 2: Run the three focused Playwright specs**

Run: `npm run prepare:local && E2E_TEST_SECRET=local-e2e-secret-32-characters npx playwright test tests/quote-execution-visual.spec.mjs tests/material-requisition-lifecycle.spec.mjs tests/service-order-lifecycle.spec.mjs`

Expected: all pass with routed navigation and existing workflow assertions intact.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/quote-execution-visual.spec.mjs e2e/tests/material-requisition-lifecycle.spec.mjs e2e/tests/service-order-lifecycle.spec.mjs
git commit -m "test(engineer): cover routed work order workflows"
```

### Task 8: Full verification, visual review, integration, and production deployment

**Files:**
- Modify only files required by failures directly caused by Tasks 1-7.

**Interfaces:**
- Produces a green branch, merged `main`, successful GitHub Actions deployment, and verified international production endpoints.

- [ ] **Step 1: Run complete local gates**

Run exactly:

```bash
(cd worker && npm run pretest && npm test)
(cd frontend && npm run lint && npm test && npm run build)
(cd admin && npm test && npm run build)
(cd e2e && npm test)
git diff --check origin/main...HEAD
git status --short
```

Expected: every command exits 0; only intended tracked changes remain.

- [ ] **Step 2: Visually inspect desktop and mobile**

Run the local Worker/frontend stack used by `e2e/scripts/prepare-local-env.mjs`. In a real browser inspect ordinary-engineer personal scope and regional-lead personal/team scopes at desktop and mobile widths. Verify eight cards, calendar, group ordering, profile button, URL navigation, single visible detail tab, English `.com` copy, and no console errors.

- [ ] **Step 3: Commit any verification-only corrections**

```bash
git add <only-the-files-corrected-from-verification>
git commit -m "fix(engineer): resolve final workspace verification issues"
```

Skip this commit when no corrections are needed.

- [ ] **Step 4: Push and open a pull request**

```bash
git push -u origin codex/engineer-workspace-correction
gh pr create --base main --head codex/engineer-workspace-correction --title "Correct engineer workspace dashboard and work order pages" --body-file docs/superpowers/specs/2026-07-25-engineer-workspace-correction-design.md
```

- [ ] **Step 5: Wait for CI and merge only when green**

```bash
gh pr checks --watch
gh pr merge --merge --delete-branch
```

Expected: the PR test job passes and the merge commit is created on `main`.

- [ ] **Step 6: Monitor the `main` deployment workflow**

```bash
gh run list --workflow deploy.yml --branch main --limit 3
gh run watch <run-id> --exit-status
```

Expected: test, frontend Pages, admin Pages, and Worker production jobs all succeed.

- [ ] **Step 7: Verify production**

Check HTTP health and real-browser rendering:

```bash
curl -fsS https://api.sagemro.com/health
curl -fsSI https://sagemro.com/
curl -fsSI https://admin.sagemro.com/
curl -fsSI https://engineer.sagemro.com/
```

In the browser verify `https://engineer.sagemro.com/` loads without a white screen or console errors, sign-in reaches the corrected dashboard, and a work-order detail URL can refresh successfully.

Expected: successful HTTP responses, healthy API JSON, and correct rendered UI.

---

## Self-review

- Spec coverage: Tasks 1-2 cover team visibility and permission separation; Task 3 covers personal calendar editing/protection; Task 4 covers eight metrics and name grouping; Task 5 covers routed detail pages and six tabs; Task 6 covers language behavior; Task 7 preserves workflows; Task 8 covers complete verification and deployment.
- Placeholder scan: no `TBD`, deferred implementation, or unspecified error-handling steps remain.
- Type consistency: `scope`, `ownership_relation`, high-level tab keys, calendar PATCH, and locale-helper result shapes are defined once and reused consistently.
