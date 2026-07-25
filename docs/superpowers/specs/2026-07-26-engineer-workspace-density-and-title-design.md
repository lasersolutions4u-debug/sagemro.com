# Engineer Workspace Density and Work-Order Title Design

**Date:** 2026-07-26
**Status:** Approved visually; awaiting written-spec review

## Objective

Improve the signed-in engineer workspace on `engineer.sagemro.com` and `engineer.sagemro.cn` so desktop users can scan more work-order information without wasted horizontal space, while making the entire workspace easier to read. Introduce a real short work-order title that Admin can correct and that engineers and Regional Leads can view consistently in lists and detail pages.

This design replaces the earlier desktop-list direction in `2026-07-25-engineer-work-order-experience-design.md`. The earlier requirement to avoid a dense desktop table no longer applies. The approved direction is a responsive, high-density desktop table with a separate mobile layout.

## Confirmed scope

The change includes all of the following as one coordinated update:

- An eight-information-column desktop work-order list plus a detail affordance.
- A separate compact mobile work-order card instead of squeezing desktop columns onto a phone.
- Larger typography and more legible line heights throughout the engineer workspace.
- A persisted short work-order title that Admin can edit.
- Read-only titles for engineers and Regional Leads.
- The same structure and behavior on the international and Chinese editions, with English on `.com` and Chinese on `.cn`.
- The existing full work-order detail page, including task context, job preparation, service standards, quote, materials, and reports, remains the destination when a list row is opened.

The change does not reintroduce an inbox or private messaging.

## Desktop work-order list

At viewport widths of 1280 CSS px and above, each work-order row uses eight information columns followed by a compact detail-entry control:

1. Work-order number
2. Short task title
3. Customer
4. Equipment and issue
5. Region
6. Status
7. Next step
8. Updated time
9. Detail affordance

The equipment and issue stay together because they form one operational concept. Splitting type, brand, model, and fault into separate columns would reduce the usable width of the title and next-step columns without materially improving task recognition.

### Density rules

- Normal row height targets approximately 68–76 px after the typography increase.
- Work-order number, title, customer, equipment, region, status, and updated time remain on one line where possible.
- The next step may use up to two lines when the English copy is long.
- Long single-line values use an ellipsis and expose the full value through the existing detail page; the table must not grow into uncontrolled multi-line rows.
- Title and next-step columns receive the flexible width. Fixed operational fields receive explicit, smaller widths.
- The table fills the available desktop content width rather than using equal-width columns or stacking multiple facts inside one oversized cell.
- Below 1280 CSS px, the component changes to the compact card layout instead of progressively hiding operational fields. Horizontal page overflow is not acceptable.

### Desktop list hierarchy

- The short task title is the primary visual anchor.
- The work-order number is prominent but does not compete with the title.
- The current status uses a compact status pill.
- The next step uses medium emphasis and plain-language copy.
- Updated time and region use secondary color, but retain sufficient contrast and font size.
- The entire row remains clickable, with a visible detail affordance for discoverability and keyboard focus.

## Mobile work-order list

Mobile does not retain the desktop columns. Each work order becomes a compact card in this order:

1. Short title and status
2. Work-order number
3. Customer, equipment, issue, and region
4. Next step
5. Updated time and View Details action

The mobile card must keep the status and next step visible without opening the detail page. It must not depend on horizontal scrolling.

## Typography and spacing

The current implementation uses 9–12 px for much of the desktop interface. The coordinated type scale is:

- Work-order short title: 15–16 px, semibold or bold.
- Work-order number: 14–15 px, semibold.
- Next-step copy: 13–14 px with a readable line height.
- Customer, equipment, issue, region, and timestamps: 12–13 px.
- Table headers: 11–12 px with restrained tracking.
- List title: 20–22 px; list explanatory text: at least 13 px.
- Metric labels: 12–13 px; metric values: 28–30 px.
- Metric section headings and calendar headings: at least 16 px.
- Calendar weekday labels, dates, range notes, availability controls, filter buttons, header locale control, profile button, and sign-out button: at least 12 px.
- Work-order detail section labels, supporting metadata, checklist text, status actions, and support text must follow the same readable hierarchy; ordinary operational text must not remain at 9–10 px.

Line height and padding increase only enough to support the larger type. The objective is higher usable density, not larger cards or more decorative whitespace.

## Persisted short work-order title

### Data model

Add one nullable `short_title` text field to `work_orders` with an application limit of 100 characters. A dedicated field is required because the current schema has no persisted work-order title: most pages fall back to the first sentence of `description`, which can contain raw equipment metadata and produce an unsuitable heading.

The migration must be added under `worker/migrations/` and applied manually to both production D1 databases before deploying the Worker:

- International: `sagemro-db`
- China: `sagemro-db-cn`

CI does not apply migrations automatically. Worker deployment must not proceed until both required production schemas are confirmed for the release path.

### Automatic title generation

New work orders receive a deterministic initial short title during creation. Title generation must not block on an external AI request. It uses available structured fields in this order:

1. Brand and model, when present.
2. Equipment or service category.
3. Issue or service type.
4. Region only when it materially helps distinguish the work order.

Examples:

- English: `Han's Laser 3015 on-site repair`
- Chinese: `汉斯激光 3015 现场维修`
- Sparse fallback: `Laser cutting service` / `激光切割服务`

The generator removes contact information, normalizes whitespace, and truncates safely to the field limit. It must not copy a full equipment-metadata sentence into the title.

### Existing work orders

No bulk rewrite is required in the first release. For a row with no saved `short_title`, display logic falls back in this order:

1. Existing `issue_title`, if supplied by older or auxiliary data.
2. Existing `title`, if supplied.
3. A deterministic short title derived from available device, category, type, and description data.
4. Localized `Service task` / `服务任务` fallback.

Admin may save a corrected title at any time, after which the persisted value becomes authoritative.

### Permissions and editing

- Admin can edit the short title inline in the Admin work-order detail header through an explicit Edit action; the default header remains read-only.
- Saving uses a focused authenticated Admin endpoint and returns the saved normalized title.
- The UI shows saving, success, validation, and failure states without closing the work-order detail.
- Empty values are rejected; the maximum length is 100 characters.
- Engineer and Regional Lead API responses include the title, but their interfaces provide no editing control.
- Customer-facing title editing is out of scope.

The API permission check must use the same Admin authorization rules as other work-order mutations. A Regional Lead must not gain title-edit permission through regional work-order access.

## List and detail consistency

The same title resolver is used for:

- Engineer personal work-order list
- Regional team work-order list
- Engineer work-order detail heading
- Admin work-order detail title editor and display

The full equipment type, brand, model, power, issue detail, and region remain in the work-order detail's Current Task Context. They are not duplicated as a long heading.

## Regional Lead behavior

The approved personal/team behavior remains unchanged:

- Personal scope shows the Regional Lead's own work orders and personal metrics.
- Team scope groups work orders under the engineers in the responsible region and shows team metrics.
- Both personal and team work-order displays use the new readable typography and title resolver.
- Team lists should use the same column vocabulary where space permits; engineer grouping remains visible and must not be flattened into an unlabelled table.

## Localization

- `.com` renders English UI copy and English localized title fallbacks.
- `.cn` renders Chinese UI copy and Chinese localized title fallbacks.
- A manually saved title is displayed as saved; the system does not silently machine-translate Admin text.
- Automatically generated titles use the market language at creation time.
- UI labels, empty states, errors, status copy, and next-step copy must not mix languages across editions.

## Loading and error behavior

- Existing list loading, empty, retry, and detail error behavior remains.
- A missing title must never prevent the list or detail from rendering.
- If title editing fails, keep the previous displayed title and the user's attempted value in the editor until they retry or cancel.
- If the backend does not yet have the title migration, the Worker deployment is blocked rather than silently shipping an endpoint that returns database errors.

## Implementation boundaries

Expected surgical areas are:

- Engineer metric, workspace calendar/header, personal list, team list, and detail typography.
- Shared engineer work-order title display helper.
- Admin work-order detail title editor.
- Admin API client method.
- Worker schema migration, work-order selects, Admin title update endpoint, and work-order creation defaults.
- Focused frontend, Admin, and Worker tests.

Do not redesign unrelated Admin navigation, customer pages, recruiting pages, pricing behavior, material requisition behavior, or field-work workflows.

## Verification and acceptance criteria

The change is complete when all of the following are verified:

- At a wide desktop viewport, the engineer list renders the approved eight information columns and detail affordance without large unused gaps.
- Typical work orders stay within the target row height; long next-step copy uses no more than two lines.
- The list switches to a usable card layout on mobile without horizontal scrolling.
- The metric panel, calendar, header controls, work-order list, team list, and work-order detail no longer rely on 9–10 px ordinary operational text.
- Admin can edit and persist a work-order short title.
- Engineer and Regional Lead views show the saved title but expose no edit control.
- A new work order receives a localized deterministic short title.
- An old work order without `short_title` still displays a concise localized fallback.
- Full equipment and issue data remains available in Current Task Context.
- English UI appears on `.com` and Chinese UI appears on `.cn` with no cross-language leakage from interface copy.
- Both D1 production databases receive the migration before the Worker release.
- Frontend lint, tests, and build pass.
- Admin tests and build pass.
- Worker pretests, tests, and golden checks pass.
- Browser verification covers desktop and mobile for both locales.

## Explicitly deferred

- Engineer or Regional Lead title editing
- Customer title editing
- Automatic translation of manually edited titles
- Bulk backfill of historical titles
- Column sorting, user-configurable columns, and saved table preferences
- Reintroduction of in-app inbox or private messaging
