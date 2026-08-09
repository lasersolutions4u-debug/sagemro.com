# Work Order Detail UX Repair Design

Date: 2026-08-09
Status: Approved direction (Option A: summary-first with collapsible details)

## 1. Scope

Repair the Admin work-order detail drawer on both international and China deployments. The same component structure and state rules apply to both markets; every static interface string must have complete English and Simplified Chinese variants.

This design is limited to the work-order detail experience. It does not change the service-standard definition, lifecycle gate enforcement, payment rules, database schema, or customer-authored content.

## 2. Confirmed problems and root causes

### 2.1 Service controls overwhelm the work order

`ServiceStandardAdminPanel` currently flattens blockers from `start`, `resolve`, and `handover` into one warning list and renders all 18 checklist items expanded. The backend gate logic is correct: `legacy_not_recorded` is non-blocking, and each mutation checks only its relevant gate. The Admin presentation loses that distinction by displaying several future gates together as “active lifecycle blockers.”

Result: future work is visually presented as an immediate failure, while the actual work-order action is pushed below a very long control panel.

### 2.2 The content order does not match the operator's task

The service-standard panel appears before customer, engineer, quote, payment, dispatch, and request information. An operator cannot answer “What is this order, what state is it in, and what must I do now?” without scrolling.

### 2.3 Excessive expansion and nested scrolling

Every service stage and most detail modules are expanded at once. The drawer owns a vertical scroll container and the messages module owns another one. This produces an unnecessarily long, dense experience and can cause full-page screenshot tools to stitch repeated message/review blocks even though the JSX renders each block once.

### 2.4 Warning semantics are too broad

Amber styling is used for all gate blockers, including blockers for future gates. Historical `legacy_not_recorded` rows are correctly non-blocking in the domain model but remain visually prominent in the expanded checklist. Warning color therefore stops communicating urgency.

### 2.5 Internationalization is incomplete inside the drawer

The drawer has English-only static labels in touched sections, including quote fee labels and engineer payout content. Interface copy must come from the locale dictionary. User-entered notes and messages remain in their authored language and must not be auto-translated.

### 2.6 Narrow-screen usability is poor

The current full-width mobile drawer contains dense multi-column rows, small badges, and many permanently visible actions. Operators must scroll through controls unrelated to the current lifecycle state.

## 3. Chosen information architecture

Use a summary-first drawer with sticky section shortcuts and collapsible detail modules.

Order from top to bottom:

1. Header: title, service number, status, close/edit actions.
2. Sticky shortcut bar: Overview, Quote, Dispatch, Service controls, Files & report, Reviews & messages.
3. Overview summary: customer, assigned engineer, quote total, payment state, plus the current required action.
4. Contextual action cards: only actions applicable to the current state.
5. Collapsible detail sections in the same shortcut order.

The shortcut bar is not a tab switcher. Selecting a shortcut expands its section if necessary, scrolls it into view, and leaves the surrounding work-order context available.

### Default expansion

- Overview is always visible.
- A section containing the current required Admin action opens automatically.
- Service controls opens automatically only when the current lifecycle gate has blockers.
- Quote opens automatically when quote review or payment review is the current task.
- All other sections start collapsed.
- User expansion choices reset when a different work order is opened.

## 4. Current gate presentation rules

Backend enforcement remains server-authoritative. The UI selects one relevant gate only for presentation:

| Work-order status | Presented service gate | Reason |
| --- | --- | --- |
| `payment_review` | `start` | Admin's next lifecycle mutation may approve service start. |
| `in_service` | `resolve` | Engineer completion is the next service-standard gated transition. |
| `resolved`, `pending_review` | `handover` | Customer acceptance/review is the next gated transition. |
| `pending`, `pending_dispatch`, `assigned`, `in_progress`, `pricing`, `pending_payment`, `completed`, `rejected`, `cancelled` | none | No service-standard gate is the current Admin action. Show progress summary only. |

Rules:

- The warning summary contains only `snapshot.gates[currentGate].blocking_items`.
- Future gate counts may appear inside the expanded audit view, but never as current warnings.
- `legacy_not_recorded` is shown with neutral styling and a historical-record explanation. It is never labeled blocked or failed.
- The gate override form is hidden unless a current gate exists, that gate has blockers, and the viewer has write permission.
- The override target is fixed to the current gate; operators do not select unrelated future gates.
- Existing valid overrides and audit history remain visible in the expanded controls section.

## 5. Component design

### 5.1 `WorkOrderDetailSummary`

Receives the loaded work-order detail and localized text. It renders four compact facts (customer, engineer, quote, payment) and derives the current action label from existing status/pricing/payment fields. It does not mutate data.

### 5.2 `WorkOrderDetailNav`

Renders keyboard-accessible shortcut buttons. Each button targets a stable section ID. Selection expands the target section and uses `scrollIntoView({ block: 'start' })`. The bar remains visible below the drawer header.

### 5.3 `WorkOrderDetailSection`

A reusable accessible disclosure (`button`, `aria-expanded`, `aria-controls`) for the major detail groups. It owns only open/closed presentation state; existing business actions remain in their current components and handlers.

### 5.4 `ServiceStandardAdminPanel`

Add `workOrderStatus` and use a pure status-to-gate selector. The collapsed summary shows:

- six-stage progress strip;
- completed/recorded count;
- current gate status, or “No service gate is active at this stage”;
- current blocker count.

Expanded content groups the six stages, keeps neutral historical states, shows only the current warning list first, and places overrides in a secondary audit area.

### 5.5 Existing detail modules

Group without changing their data contracts:

- Quote: versioned quote panel or legacy fee/parts view.
- Dispatch: regional lead and engineer assignment.
- Files & report: diagnostic attachments, field-work panel, service report.
- Reviews & messages: customer review, internal engineer review, message timeline, internal note composer.

The message timeline no longer uses an independent fixed-height scroll container; the drawer keeps a single vertical scrolling surface.

## 6. Responsive behavior

### Desktop

- Drawer retains a bounded readable width but may grow beyond the current `max-w-4xl` where viewport space allows.
- Overview facts use four columns; grouped content may use two columns when meaningful.
- Shortcut bar scrolls horizontally only if labels cannot fit.

### Mobile and narrow windows

- Summary facts use two columns, then one column at very narrow widths.
- Shortcut bar is horizontally scrollable with at least 44px touch targets.
- Disclosure headers and primary actions use at least 44px touch height.
- Tables keep horizontal overflow within their own section; general page content does not shrink below readable text sizes.
- Only the drawer body scrolls vertically.

## 7. Visual language

Retain the established SAGEMRO dark Admin palette and orange primary accent.

- Orange: current action and genuine current blocker only.
- Green: confirmed or completed.
- Neutral gray: historical, unavailable, not applicable, and future stages.
- Red: request/render failures and destructive exceptions only.

Avoid decorative additions. Structure, disclosure state, and status color carry meaning.

## 8. English and Chinese copy

Every new or touched static label must exist in both `TEXT.en` and `TEXT['zh-CN']`, including:

- shortcut labels;
- overview facts and empty values;
- section headings and expansion controls;
- current-action messages;
- service gate summaries;
- fee, payout, attachment, report, review, and message labels exposed in the drawer.

Tests must reject new hard-coded English-only drawer labels. Dynamic customer, engineer, AI, message, and note content is displayed verbatim.

## 9. Error and loading behavior

- Detail loading retains one clear loading state.
- Service-standard loading or failure is contained within its disclosure and does not block the rest of the work order.
- A failed shortcut target is impossible because section IDs are static; tests cover the map.
- Existing stale-request guards remain unchanged.
- Failed mutations keep their existing messages and do not close the relevant expanded section.

## 10. Testing and acceptance criteria

### Pure behavior tests

- Status-to-current-gate mapping covers every known work-order status.
- Only current-gate blockers are presented as warnings.
- `legacy_not_recorded` remains neutral and non-blocking.
- No gate override form is available without a writable, blocked current gate.
- Default expanded sections match work-order state.

### Component/source contracts

- Shortcut buttons and stable section IDs exist in both locale paths.
- Selecting a shortcut expands and scrolls to the target.
- Messages have no nested vertical scroll container.
- Customer review, engineer review, and messages render exactly once.
- All touched static drawer strings come from the locale dictionary.

### Regression verification

- Admin unit tests pass.
- Admin production build passes for international and China runtime settings.
- Full repository test job passes.
- Browser checks at desktop and narrow widths confirm readable hierarchy, correct default expansion, keyboard focus, and no duplicate visible sections during normal scrolling.

## 11. Non-goals

- No service-standard schema or migration changes.
- No change to the server's gate-blocking rules.
- No automatic translation of user content.
- No new work-order workflow states.
- No redesign of the work-order list page.
