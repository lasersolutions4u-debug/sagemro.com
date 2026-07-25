# Engineer Workspace Correction Design

Date: 2026-07-25
Scope: International and China engineer workspaces
Status: Approved visual direction; written specification awaiting final user review

## 1. Objective

Correct the engineer workspace so it is a concise operating dashboard rather than a single long work-order screen.

The corrected experience must:

- restore the eight work-order metrics beside the scheduling calendar;
- give regional leads separate personal and team scopes;
- group regional team work orders by the executing engineer's name;
- keep the dashboard as a work-order list;
- open every work order on a real, independently addressable detail page;
- separate work-order functions into tabs instead of rendering all tools together;
- keep English and Chinese workspaces linguistically consistent;
- retain the existing calendar, profile, dispatch, quote, payment, material, field-work, and report workflows.

## 2. Roles and visibility

### Engineer

An engineer sees:

- their personal eight metrics;
- their own scheduling calendar;
- only work orders where they are the executing engineer;
- their own editable profile.

### Regional lead

A regional lead has two synchronized scopes:

1. **My metrics / My work orders**
   - Counts and lists only work orders where the regional lead is the executing engineer.
2. **Team metrics / Regional team work orders**
   - Counts and lists the regional lead's own work orders, every current subordinate engineer's work orders, and the regional queue assigned to the lead but not yet assigned to an engineer.

Team membership is determined by the existing authoritative relationship `engineers.regional_lead_id`, not by comparing free-form region names. Work orders retain `assigned_regional_lead_id` so the lead can continue to supervise work that was dispatched through them.

The team view groups work orders in this order:

1. Unassigned regional queue
2. Regional lead themselves
3. Current subordinate engineers, ordered by engineer name

Each group shows the engineer name, availability/status, open-work-order count, and a collapsible work-order list. Engineers with no work orders may remain visible as collapsed zero-count groups so the lead can understand team capacity.

If an engineer later leaves the regional lead's team, historical work-order supervision remains readable when the work order retains that lead assignment, but the former engineer is not treated as a current team member and the lead cannot use current-team reassignment controls for that engineer.

### Regional-lead action boundary

Regional leads may:

- view team work-order details and progress;
- assign an unassigned regional work order;
- reassign a work order to another current subordinate engineer when the workflow status permits it;
- use management filters and team metrics.

The executing engineer remains responsible for execution actions:

- submitting or revising quotes;
- submitting material requisitions;
- recording field-service activity;
- submitting the final service report.

This preserves a clear accountable engineer while allowing regional supervision.

## 3. Dashboard structure

The engineer workspace remains one restrained page with three levels:

1. Header
2. Metrics and calendar
3. Work-order list

### Header

The header contains:

- SAGEMRO identity;
- workspace title and regional-team subtitle where applicable;
- an explicit locale indicator;
- the signed-in engineer's name/profile button;
- sign out.

Clicking the signed-in name opens the existing personal engineer profile. It does not open a team member profile.

### Metrics

The original eight metric positions are restored:

1. Needs action
2. Today's tasks
3. Pending confirmation / Unassigned queue in team scope
4. In service
5. Quote pending
6. Scheduled dates
7. Reports due
8. Parts needs

Ordinary engineers see personal values directly. Regional leads use one eight-card set with a `My metrics / Team metrics` switch; two sets of cards are not displayed simultaneously.

Changing scope updates both the metrics and the work-order list below, preventing a mismatch between the numbers and visible records.

### Scheduling calendar

The calendar remains beside the metrics and opens the existing personal scheduling calendar.

The engineer can create, update, and delete their own:

- available service time;
- blocked or unavailable dates;
- service windows.

Work-order-backed scheduled events are visually distinguished. They are not treated as freely deletable personal availability records; changes that would conflict with a work order must follow the work-order scheduling workflow.

The calendar is always the signed-in person's calendar. A regional lead's team scope does not silently switch the calendar to a subordinate engineer.

### Work-order list

Personal scope shows a concise table/list of the signed-in engineer's work orders.

Team scope shows collapsible engineer-name groups. Every work-order row contains only operational summary data:

- work-order number and date;
- customer and machine/service summary;
- localized status;
- current next step;
- last update time;
- a detail-page affordance.

The dashboard does not render the work-order checklist, messages, quote form, material form, field records, or report form.

## 4. Independent work-order detail page

Opening a work order navigates to a real URL:

- International: `https://engineer.sagemro.com/work-orders/:workOrderId`
- China: `https://engineer.sagemro.cn/work-orders/:workOrderId`

The page supports refresh, browser back/forward, direct linking, and restoration of the selected work order after reload.

### Detail header

The header shows:

- breadcrumb back to work orders;
- work-order number, localized title, and status;
- customer, region, executing engineer, and scheduled service window;
- one clear current-next-step panel;
- regional assignment control only when the signed-in user has permission.

### Detail tabs

Only one work-order function is visible at a time:

1. Overview
2. Messages
3. Quote
4. Material request
5. Field service
6. Service report

The Overview tab contains:

- current task context;
- service preparation;
- the read-only service-standard checklist.

Existing tools are reused inside their relevant tabs. They are not duplicated or rewritten unless necessary to support the new page container.

Tabs unavailable for a work-order stage remain visible with an explanatory disabled or empty state when this helps the engineer understand the workflow. Tabs must not silently disappear in a way that makes the process hard to learn.

## 5. Language rules

The selected host determines the interface locale:

- `.com` engineer workspace: English UI and English system-generated content;
- `.cn` engineer workspace: Chinese UI and Chinese system-generated content.

Status labels, headings, buttons, empty states, validation errors, and new workflow system messages must come from locale-specific copy. They must not rely on ad-hoc word replacement.

### Existing and customer-authored content

Historical database records may contain content written in another language. This content is not silently discarded.

For the international workspace:

- display an available English translation as the primary text;
- label it as a translation;
- provide `View customer original` or `View original` on demand;
- never mix the translation and source language in the same paragraph.

For the China workspace, apply the symmetrical behavior when the original is not Chinese.

If no translation exists, show the original in a clearly labelled `Customer original` block rather than presenting it as English interface copy. Automatic translation infrastructure is a separate backend concern; the UI must support translated and original fields without pretending that simple term replacement is a full translation.

New system workflow messages must be generated from stable message types and localized at read/render time where possible. This prevents future history from being permanently tied to the language used when the message was created.

## 6. Data and authorization changes

The engineer ticket-list API must return role-appropriate scope without trusting an arbitrary client-supplied engineer ID.

For a normal engineer, the list is restricted to `work_orders.engineer_id = authenticatedEngineerId`.

For a regional lead, team scope includes:

- `work_orders.engineer_id = authenticatedLeadId`;
- `work_orders.engineer_id` belonging to a current engineer whose `regional_lead_id = authenticatedLeadId`;
- unassigned work orders whose `assigned_regional_lead_id = authenticatedLeadId`;
- historical supervised records whose `assigned_regional_lead_id = authenticatedLeadId`, subject to existing sensitive field-work restrictions.

The work-order detail authorization guard must use the same regional-team rule for ordinary work-order information. More sensitive execution data, including private field-work evidence, continues to use the existing narrower access modes.

The API should return enough ownership metadata for the UI to distinguish:

- `personal`;
- `current_team_member`;
- `regional_queue`;
- `historical_supervision`.

The client must not infer authorization only from visible group membership.

## 7. Visual direction

The approved visual direction preserves SAGEMRO's orange brand but uses it as an operational accent rather than a large decorative fill.

- Background: cool light grey workspace canvas
- Panels: white, low-radius operational surfaces
- Primary ink: near-black navy
- Accent: SAGEMRO orange
- Supporting state colours: restrained blue, green, amber, and red
- Typography: compact sans-serif with strong number hierarchy
- Density: desktop-efficient while remaining responsive on tablet and mobile

The signature element is the synchronized metric scope and engineer-name grouping: a regional lead can move from team health to a named engineer's work without losing context.

## 8. Loading, errors, and empty states

- Metrics and lists share one scope state and one loading outcome.
- A failed team load does not silently fall back to personal data while still labelling the screen as team scope.
- Empty engineer groups explain that no work orders are assigned.
- An inaccessible or missing direct-link work order shows a clear permission/not-found state and a link back to the list.
- Tab-level failures remain inside the selected tab and do not erase the detail header.
- Calendar errors remain inside the calendar surface.

## 9. Verification criteria

The implementation is complete only when automated and browser verification prove all of the following:

1. The eight metrics are present and correct in personal scope.
2. Regional leads can switch to team metrics and values match the team list.
3. Team work orders are grouped by current engineer name, with a separate unassigned queue.
4. A regional lead can see a subordinate's directly assigned work order.
5. A normal engineer cannot see another engineer's work order.
6. Clicking a row changes the URL to `/work-orders/:id` and refresh preserves the detail page.
7. Only the selected detail tab's tool is rendered visibly.
8. Existing quote, payment, material, field-service, report, assignment, and approval workflows remain functional.
9. The `.com` interface contains no Chinese UI or system copy.
10. Foreign-language customer/history content follows translated-primary/original-on-demand behavior.
11. `Open calendar` opens the signed-in engineer's editable calendar.
12. Clicking the signed-in name opens the signed-in engineer's personal profile.
13. Full Worker, frontend, Admin, and E2E gates pass before deployment.
14. International production deployment completes and browser smoke tests show no white screen or console errors.

## 10. Out of scope

- A new standalone regional-management application
- A new translation provider or automatic-translation backend
- Changes to Admin workspace information architecture beyond what is required for existing workflow compatibility
- Displaying sixteen metric cards simultaneously
- Allowing regional leads to submit execution records on behalf of the assigned engineer
