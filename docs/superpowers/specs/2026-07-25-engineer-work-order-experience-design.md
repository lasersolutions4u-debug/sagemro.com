# Engineer Work Order Experience Design

**Date:** 2026-07-25
**Status:** Approved in conversation; awaiting written-spec review

## Objective

Simplify the signed-in engineer portal so engineers and Regional Leads can scan assigned work orders quickly, open a focused detail view, understand the current task, prepare for service, and follow SAGEMRO service standards without navigating a dense dashboard or modal.

The first release must reuse the current frontend data and APIs. It must not add database tables, Worker endpoints, saved checklist state, or a new routing framework.

## Users and scope

This design applies to the signed-in workspace on `engineer.sagemro.com` and `engineer.sagemro.cn`:

- Engineers see their assigned service work orders.
- Regional Leads retain their existing team and dispatch responsibilities.
- Both roles use the same simplified work-order list and detail structure where their permissions overlap.

The public engineer recruiting page and customer-facing site are out of scope.

## Information architecture

The workspace has two primary states inside the existing `EngineerWorkspace` component:

1. **Work-order list** — the default state after sign-in.
2. **Work-order detail** — a full-width workspace state opened from a list item.

The detail state replaces the current work-order detail modal for this workspace. It is visually a separate page, but the first release does not change the browser URL. A clear Back to Work Orders action restores the list state and its current filter context.

## Work-order list

Use the approved structured-list layout rather than cards grouped across multiple dashboard sections or a dense desktop table.

Each work-order row shows only information needed to decide what to do next:

- Work-order number
- Short task or issue title
- Machine or service type
- Customer region
- Scheduled service window when available
- Current status
- One plain-language next step
- View Details affordance

The list is ordered by action priority, with tasks requiring the current user's response before passive or completed tasks. Existing status filters may remain if they are compact and useful. The layout must collapse cleanly to a single-column mobile list without hiding the status or next step.

The workspace footer includes:

> Need Admin support? [support@sagemro.com](mailto:support@sagemro.com)

The Chinese version uses equivalent Chinese copy while keeping the same email address.

## Work-order detail

The detail header contains:

- Back to Work Orders
- Work-order number and short task title
- Machine and region summary
- Current status

The main content follows one fixed reading order.

### 1. Current Task Context

This section answers what the task is and what must happen now. It uses existing work-order fields to show:

- Customer issue or service request
- Machine and service type
- Scheduled time or arrival window
- Relevant safety or urgency indicator
- Current next step

Missing information is shown with a short neutral fallback instead of an empty card.

### 2. Job Preparation

This section helps the engineer prepare before acting or travelling. It reuses information already available through the current work-order detail flow:

- Customer equipment record or available machine details
- AI intake summary or customer description
- Suggested tools, spare parts, consumables, and protective equipment when derivable from existing content
- Attachments and service context that the engineer should review

The interface must not imply that AI-generated preparation notes are a confirmed diagnosis. Existing human review and safety responsibility remain authoritative.

### 3. Service Standard Checklist

The first release displays a concise, read-only checklist:

1. Confirm the customer issue, machine model, site contact, and arrival window.
2. Review the intake summary and flag safety risks.
3. Check tools, spare parts, consumables, and protective equipment.
4. Record the nameplate, alarm screen, and fault-area photos on site.
5. Document service actions, replaced parts, and follow-up recommendations.
6. Submit the service report for customer confirmation.

The checklist does not contain interactive checkboxes and does not save completion state. Evidence and completion continue to be recorded through the existing attachments and service-report workflow.

## Action area

On desktop, the current status action appears in a compact sticky panel to the right of the three content sections. On mobile, the action area follows the content so it never covers task information.

Only actions valid for the current role and status are shown. Existing behaviors such as confirming an assignment, returning a dispatch with a reason, assigning a team engineer, quoting, and completing a service report continue to use their current APIs and permission checks.

The action area also shows:

> Need Admin support? [support@sagemro.com](mailto:support@sagemro.com)

Clicking the address opens the user's mail client. No in-app inbox or private-message channel is introduced.

## Visual direction

- Use a restrained white and neutral-gray surface system with the existing brand primary color for links and primary actions.
- Prefer borders, spacing, and typography over decorative gradients or multiple colored cards.
- Use status color sparingly in the status label and urgent safety indicators.
- Keep one clear primary action per work order state.
- Avoid duplicated summaries, dashboard counters that do not lead to an action, and horizontally dense tables on mobile.
- Preserve the existing bilingual behavior: English for `.com`, Chinese for `.cn`.

## Data flow and state

1. The workspace loads assigned work orders through the current engineer-ticket API.
2. Selecting a row stores the selected work order in workspace state and opens the detail state.
3. Detail content uses the selected order and the existing detail data flow already used by `WorkOrderDetailModal`.
4. A successful action reloads the work-order collection and refreshes the selected order where necessary.
5. Returning to the list preserves the current workspace session and filter selection.

No new persistence is required for navigation or checklist display.

## Loading and error behavior

- Show a compact list skeleton or loading state while work orders load.
- If the list fails, keep the workspace shell visible and provide a Retry action.
- If detail data fails, retain the selected work-order header and provide Retry and Back to Work Orders actions.
- If a work-order action fails, preserve the detail content, stop the loading state, and show a concise localized error.
- Empty work-order lists show a single calm empty state and the Admin support email.

## Component boundaries

Implementation should keep responsibilities small without introducing a general-purpose abstraction layer:

- `EngineerWorkspace` owns list/detail navigation and shared loading state.
- A focused work-order list component renders structured rows and list filters.
- A focused engineer work-order detail component renders the three information sections and action area.
- Existing status-label, next-action, localization, API, and work-order action logic should be reused where practical.

The legacy `EngineerDashboard` and customer work-order modal should not be refactored unless a direct dependency makes a surgical change necessary.

## Verification and acceptance criteria

The change is complete when:

- An engineer can load a structured list, open any visible work order, and return to the list.
- Each list item exposes status and an understandable next step without opening the detail.
- The detail shows Current Task Context, Job Preparation, and Service Standard Checklist in that order.
- The checklist is read-only and creates no network request or stored state.
- Valid existing actions still work and refresh the displayed work order.
- Regional Lead dispatch actions remain available according to current permissions.
- `support@sagemro.com` appears as a working mail link in the workspace footer and detail action area.
- English and Chinese copy render correctly on their respective hosts.
- Desktop and mobile layouts remain usable, with no overlapping sticky action panel.
- List failure, detail failure, action failure, loading, and empty states are understandable and recoverable.
- Existing frontend lint, tests, and production build pass.

## Explicitly deferred

- A shareable `/work-orders/:id` route
- Saved checklist completion
- New Worker APIs or database migrations
- In-app messaging or a unified inbox
- Push-notification changes
- Redesign of the public recruiting page or customer portal
