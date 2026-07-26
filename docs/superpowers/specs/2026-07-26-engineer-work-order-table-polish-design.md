# Engineer Work Order Table Polish Design

## Goal

Fix the malformed desktop work-order table and make its information hierarchy compact, aligned, and readable without changing work-order behavior or data.

## Root cause

Each desktop header and row renders eight grid children: work order, task name, customer, equipment / issue, region, status, updated time, and detail arrow. The current Tailwind grid template defines only seven columns. CSS Grid therefore creates an implicit second row for the final child, which makes each record unusually tall and leaves the arrow stranded below the work-order number.

## Approved layout

- Use an explicit eight-column desktop grid.
- Keep the work-order number on one line in a fixed-width first column.
- Give Task name the largest text allocation and allow up to two lines.
- Give Equipment / issue a generous allocation and allow up to two lines.
- Keep Customer and Region single-line with ellipsis when necessary.
- Keep Status in a stable-width column; long labels may wrap inside the pill.
- Keep Updated on one line in a fixed-width column.
- Keep the detail arrow in a fixed final column and vertically center every cell.
- Target a compact row height around 84px while allowing the two-line fields to fit naturally.
- Preserve the existing mobile card layout and all click behavior.

## Verification

- A contract test must prove the desktop template contains eight explicit columns and the row has no implicit grid placement.
- Existing frontend tests, lint, and production build must pass on both release branches.
- A real desktop screenshot must show one row per record with all eight cells aligned.
- A mobile screenshot must confirm the card layout is unchanged and does not show a Next step block.

## Scope

Only the Engineer work-order list component and its focused contract test are changed. Detail pages, API behavior, filters, statuses, and other workspace sections remain unchanged.
