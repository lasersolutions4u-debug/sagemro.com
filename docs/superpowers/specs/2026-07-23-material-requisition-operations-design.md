# Material Requisition Operations Design

## Objective

Create a formal internal material requisition workflow for work orders. The workflow must be distinct from material master-data requests and from quote/service-report material lines.

## Scope

The first operational release includes:

- one requisition with multiple material lines;
- work-order linkage and immutable requisition number;
- engineer submission and receipt confirmation;
- Admin approval and cancellation;
- warehouse stock allocation, issue, and return recording;
- procurement shortage handling, supplier reference, expected arrival, and received quantity;
- partial fulfillment and line-level fulfillment source;
- internal staff accounts with `admin`, `operations`, `warehouse`, and `procurement` roles;
- audit logs for every status or quantity change;
- Admin list/detail workflow and engineer work-order workflow;
- dashboard pilot metrics for approval time, fulfillment time, shortages, overdue demand, and closure rate;
- Playwright coverage in CI;
- scheduled COM/CN D1 exports with retention artifacts and failure visibility.

This release does not implement supplier contracts, purchase orders, accounts payable, bin-level warehouse management, barcode scanning, or automated accounting.

## Existing Concepts

- `materials`: reusable material master data and aggregate stock.
- `work_order_material_items`: quote, preparation, recommended spare, and service-report lines.
- `material_requests`: requests to create or link missing material master data. The UI will call these “material master-data requests”.
- `material_requisitions`: new work-order fulfillment document.

## Data Model

### Internal staff

`admin_staff_accounts` stores an internal account with normalized login, password hash/salt, role, active status, display name, market scope, password-change flag, timestamps, and creator. Environment Admin credentials remain the bootstrap super-admin account.

Roles:

- `admin`: all Admin portal capabilities and staff account management;
- `operations`: requisition review, work-order coordination, and read access to material operations;
- `warehouse`: stock allocation, issue, return, and receipt operations;
- `procurement`: shortage acceptance, supplier/ETA updates, and purchased quantity receipt.

### Requisition header

`material_requisitions` stores number, market, work order, requester, status, urgency, required date, purpose, approval metadata, assigned warehouse/procurement staff, issue/receipt/closure timestamps, cancellation reason, and audit timestamps.

Statuses:

`draft -> submitted -> approved -> processing -> partially_fulfilled -> ready -> issued -> received -> closed`

Exceptional terminal or side states:

`rejected`, `cancelled`.

### Requisition lines

`material_requisition_items` stores the selected material snapshot or free-form item, requested quantity, stock allocation, procurement quantity, purchased receipt quantity, issued quantity, returned quantity, engineer received quantity, fulfillment source, ETA, supplier reference, notes, and status.

Line statuses:

`pending`, `stock_allocated`, `purchasing`, `partially_ready`, `ready`, `issued`, `received`, `cancelled`.

## Invariants

- Only an assigned engineer or Admin-side staff can create a work-order requisition.
- Submitted requisitions must contain at least one positive-quantity line.
- Approved quantities cannot exceed requested quantities.
- Issued quantity cannot exceed stock allocation plus purchased receipt.
- Engineer received quantity cannot exceed issued quantity.
- Aggregate material stock changes only when warehouse receipt, issue, or return is recorded.
- A requisition closes only when every active line is received or cancelled.
- All write operations are role checked and audited.

## UI

### Engineer

The work-order detail gains a “Material requisition” section. Engineers can create a multi-line draft from preparation material lines or manual entries, submit it, view fulfillment progress, and confirm receipt after issue.

### Admin portal

Add a dedicated “Material requisitions” navigation item with a dense list and detail drawer. The drawer exposes only actions allowed for the current staff role. The existing material page renames the old request panel to “Material master-data requests”.

Add an “Internal staff” section for the bootstrap/super Admin to create, deactivate, and reset warehouse/procurement/operations accounts. Generated temporary passwords are returned once and the account must change the password after login.

## CI And Operations

- Add the full Playwright suite to the `test` job after unit tests and builds.
- Add a material requisition lifecycle E2E covering engineer submission, Admin approval, warehouse allocation, procurement fulfillment, warehouse issue, and engineer receipt.
- Add a scheduled backup workflow that exports COM and CN D1 databases separately, verifies non-empty SQL files, packages SHA-256 manifests, uploads encrypted-at-rest GitHub artifacts, and retains them for 30 days. Workflow failure is visible in GitHub Actions; secrets remain in the production environment.
- Production deployment remains blocked until the new migration is applied to both D1 databases.

## Rollout

1. Apply the migration to COM and CN D1.
2. Merge and deploy the shared Worker and international clients.
3. Sync the compatible frontend/Admin changes to `china-edition` and deploy Aliyun ECS.
4. Run production smoke with uniquely scoped temporary data and guaranteed cleanup.

