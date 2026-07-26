# Regional Team Work Order Pagination Design

## Goal

Keep a Regional Lead's team workspace fast and navigable when individual engineers or the whole region accumulate many work orders.

## Current limitation

The team endpoint returns the newest 100 work orders for the whole regional scope. The frontend groups that partial result and renders every returned row in every expanded group. Counts and team metrics therefore become incomplete after 100 records, and the page becomes excessively long before that limit is reached.

## Approved interaction

- Regional queue and the Regional Lead's personal group start expanded.
- Individual engineer groups and historical supervision start collapsed.
- Opening a group loads its first 5 matching work orders.
- A group with more records shows `Load 10 more (N remaining)` / `再加载 10 条（剩余 N 条）`.
- Each additional request loads up to 10 records and appends them without replacing existing rows.
- Changing the global All / Needs action / Active / Completed filter clears loaded pages and reloads open groups from the first page.
- The group header always shows the true filtered total, independent of how many rows are currently loaded.
- Empty groups stay compact and do not render a large empty work-order body.

## API design

Keep `GET /api/engineers/tickets?scope=team` compatible for existing callers. Add two optional team modes:

### Summary

`GET /api/engineers/tickets?scope=team&view=summary&filter=all&timezone_offset_minutes=480`

Returns:

- Regional Lead identity and current team roster.
- True per-group totals for the selected filter.
- Aggregate team metrics calculated over the full team scope.
- No work-order rows.

### Group page

`GET /api/engineers/tickets?scope=team&view=group&group_type=member&group_id=<engineer>&filter=all&limit=5&cursor=<opaque>`

Supported group types: `queue`, `lead`, `member`, and `historical`.

Returns:

- The requested work-order page in newest-first order.
- `total`, `has_more`, and an opaque cursor for the next page.
- Authorization validates that member groups belong to the authenticated Regional Lead.

The cursor encodes the last row's internal `sort_created_at` and `id`. `sort_created_at` is `COALESCE(created_at, '')`, and the query orders by `sort_created_at DESC, id DESC`, making pagination deterministic for matching timestamps and rows with a null creation time.

## Metrics

The summary response provides the existing eight team metrics from SQL aggregates over the complete authorized scope. `todayTasks` and `scheduledDates` use only each work order's latest calendar event. The frontend passes `-new Date().getTimezoneOffset()` as `timezone_offset_minutes`, and the Worker applies that offset when comparing browser-local dates; the parameter defaults to UTC (`0`) and accepts integer offsets from `-840` through `840`. Frontend personal metrics remain unchanged.

## Error behavior

- Non-Regional Leads receive 403 for all team summary/group modes.
- Invalid filters, group types, group members, limits, or cursors receive 400.
- A missing current team member group receives 404.
- A failed group-page request keeps already loaded rows visible and exposes an inline retry action.

## Scope

This changes the international Worker and both international/China Engineer frontends. No schema migration is required. Work-order detail, assignment, filtering semantics, and personal work-order loading remain unchanged.
