# Onsite Workday, Photo Check-In, and Daily Report Design

## Objective

Replace browser geolocation as the sole onsite arrival proof with a photo-first daily field-work workflow that supports multi-day service projects.

The workflow must:

- require a live onsite check-in photo on every field-work day;
- treat browser geolocation as optional supporting evidence;
- create a complete daily record without closing the overall work order;
- give customers timely, reviewed service progress while keeping internal analysis private;
- support planned duration, extension approval, missed-report recovery, engineer reassignment, and final service closure;
- keep facial images private, access controlled, and subject to automatic retention deletion.

The international and China editions use the same data contract and Worker APIs, with localized frontend and Admin copy.

## Confirmed Business Rules

### Daily lifecycle

Each onsite service calendar day has one `work_order_field_days` record.

1. The assigned engineer performs a live photo check-in before starting work.
2. The system records server time and optionally records browser location, accuracy, and coordinate system.
3. The engineer performs the field work while the overall work order remains `in_service`.
4. Before finishing the day, the engineer submits a daily report with at least one progress photo.
5. The field day becomes closed for that local calendar date.
6. On the next onsite day, the engineer creates a new field day by checking in again.
7. On the final day, the engineer submits the daily report first and then submits the existing final service report for customer confirmation.

The daily report does not replace the final service report. The final report remains the authoritative project-level diagnosis, solution, material use, labor summary, and follow-up recommendation.

### Check-in evidence

Normal check-in requires a photo captured from the check-in screen at that moment. Browser-provided camera capture can demonstrate the intended interaction path, not provide cryptographic proof that no external image was ever shown to the camera; the system must not claim stronger proof than it collects.

- The engineer's face must be clear.
- The background must show recognizable site context or serviced equipment.
- The app requests the front-facing camera by default but allows the engineer to switch cameras where the browser supports it.
- The normal check-in flow uses only a `getUserMedia` camera stream, does not expose a photo-library picker, and does not accept a pre-existing image file as the primary check-in photo.
- PC users without an available camera are instructed to open the same work order on a phone.
- The platform does not perform facial recognition, identity matching, liveness scoring, or biometric-feature extraction.
- The server timestamp is authoritative. Client device time is informational only and is not used to determine the workday date.

Browser location is optional supporting evidence:

- A successful location request stores coordinates, accuracy, coordinate system, source, geofence distance, and pass/fail result.
- Permission denial, timeout, unavailable position, or insufficient accuracy does not block photo check-in.
- A check-in without location is explicitly labeled `location_unavailable`; it is not represented as location verified.
- The existing geofence logic remains available as an audit signal, not as the only condition for starting or completing work.

### Daily report

The engineer must provide:

- work completed today;
- problems or risks found;
- plan for the next workday;
- customer cooperation or preparation required;
- labor hours for the day;
- at least one live or uploaded progress photo of the work result or site condition.

The engineer may additionally provide an internal note. Customer-visible fields and progress photos are visible to the corresponding customer immediately after submission. Internal notes and any attachments explicitly marked internal are visible only to the assigned engineer and authorized Admin-side staff.

Daily reports are immutable as submitted evidence. A correction creates a revision with the original content retained for audit. In the first release, only Admin can create a correction; engineer self-editing is out of scope.

### Missed reports

A missed daily report does not prevent the engineer from checking in on the next workday.

- The previous field day becomes `report_overdue` after the local day boundary.
- The engineer must submit the missing report and a late-submission reason.
- Admin highlights all overdue field days.
- The final service report cannot be submitted while any field day is open or overdue.
- A late report retains the original check-in date and records a separate submission timestamp.

### Planned duration and extensions

Admin sets the onsite plan before field work starts:

- expected service days;
- expected completion date;
- site time zone;
- optional planned daily start/end times.

China work orders default to `Asia/Shanghai`. International work orders require an IANA time-zone value selected by Admin; they must not infer the legal project day from the engineer's device time zone.

When more time is needed, the engineer submits an extension request from a daily report with:

- reason;
- additional calendar or work days requested;
- proposed new completion date;
- customer-facing explanation;
- optional internal note.

Admin approves or rejects the request. Approval updates the work-order plan and notifies the engineer and customer. Rejection notifies the engineer and leaves the current plan unchanged. Engineers cannot extend the plan directly.

### Engineer reassignment

Historical field days remain attributed to the engineer who created them. A replacement engineer starts a new field day under their own account. Reassignment does not transfer ownership of existing evidence or allow the replacement engineer to modify earlier reports.

## Data Model

### Work-order plan fields

Add the following fields to `work_orders`:

- `site_timezone TEXT`;
- `expected_service_days INTEGER`;
- `expected_completion_date TEXT` as a local date (`YYYY-MM-DD`);
- `planned_daily_start_time TEXT` as optional local time;
- `planned_daily_end_time TEXT` as optional local time.

These fields describe the current approved plan. Plan changes are also recorded in audit logs and extension-request history.

### Field days

Create `work_order_field_days` with:

- `id TEXT PRIMARY KEY`;
- `work_order_id TEXT NOT NULL`;
- `engineer_id TEXT NOT NULL`;
- `site_local_date TEXT NOT NULL`;
- `site_timezone TEXT NOT NULL`;
- `status TEXT NOT NULL`;
- `check_in_at TEXT NOT NULL`;
- `expected_check_out_at TEXT`;
- `report_submitted_at TEXT`;
- `labor_hours REAL`;
- `completed_work TEXT`;
- `issues_risks TEXT`;
- `next_plan TEXT`;
- `customer_support_needed TEXT`;
- `internal_note TEXT`;
- `late_reason TEXT`;
- optional location and geofence evidence fields;
- `check_in_photo_object_key TEXT NOT NULL`;
- `created_at TEXT` and `updated_at TEXT`.

Statuses:

- `checked_in`: check-in recorded, daily report not yet submitted;
- `report_submitted`: daily report submitted on time;
- `report_overdue`: local day ended without a report;
- `late_report_submitted`: missing report later completed;
- `admin_closed`: Admin resolved an exceptional day with an audited reason.

Enforce one normal field day per `(work_order_id, engineer_id, site_local_date)`. An Admin exception must not silently create a duplicate normal day.

### Field-day media

Create `work_order_field_day_media` with:

- field-day relationship;
- object key;
- purpose (`check_in`, `progress`, `internal`);
- MIME type and size;
- uploader identity;
- customer visibility;
- capture source (`camera`, `file_upload`, `admin_override`);
- created timestamp;
- retention eligibility and deletion timestamps.

Check-in media must use `capture_source = 'camera'` for normal engineer submission. The capture-source value documents the restricted client path and is not a claim of cryptographic anti-spoofing. Progress media may use camera capture or a file upload. Internal media always has customer visibility disabled.

### Evidence holds

Create `work_order_field_evidence_holds` with work-order relationship, reason category (`complaint`, `warranty`, `safety_review`, `legal_hold`, `dispute`), reason text, opening Admin identity and timestamp, resolution identity and timestamp, and status (`open`, `resolved`).

An object is eligible for retention deletion only when its work order has reached final completion, its normal 12-month retention date has passed, and no related evidence hold is open.

### Extension requests

Create `work_order_extension_requests` with:

- work order and optional field-day relationship;
- requester engineer;
- reason and customer-facing explanation;
- requested additional days and proposed completion date;
- status (`pending`, `approved`, `rejected`, `cancelled`);
- Admin decision identity, reason, and timestamp;
- original and approved plan snapshots;
- timestamps.

Only one pending extension request per work order is allowed.

### Report revisions

Create `work_order_field_day_revisions` when submitted daily content is corrected. Store the previous customer-visible fields, internal note, labor hours, actor, reason, and timestamp before applying the revision.

## Private Media Storage

Existing work-order attachments use the public `R2_PUBLIC_HOST` and are unsuitable for check-in facial images or controlled daily-report evidence.

Add a separate private R2 bucket binding dedicated to protected field evidence. Objects from this bucket never receive an `r2.dev` public URL and object keys are never rendered as directly usable public links.

Media access flow:

1. The authenticated client requests a media endpoint from the Worker.
2. The Worker loads the media record and related work order.
3. The Worker verifies that the caller is the assigned or historical engineer for the record, the corresponding customer for customer-visible media, or authorized Admin-side staff.
4. The Worker streams the object with a restrictive content type, `Cache-Control: private, no-store`, and no public object location.

Access rules:

- Check-in photos: assigned/historical engineer, corresponding customer, and authorized Admin staff.
- Customer-visible progress photos: corresponding customer, assigned engineer, and authorized Admin staff.
- Internal media: assigned engineer and authorized Admin staff only.
- Other engineers and unrelated customers receive `404` or `403` without object metadata leakage.

The implementation requires a new private R2 binding in `worker/wrangler.toml`. Per repository policy, that configuration change must be explicitly confirmed in the implementation conversation before it is made.

## API Design

### Engineer APIs

- `POST /api/workorders/:id/field-days/check-in`
  - multipart form with required live-captured photo, optional expected checkout time, and optional location evidence;
  - creates the current local day's field day atomically after media validation and upload;
  - returns the field day and location-evidence status.
- `GET /api/workorders/:id/field-days`
  - returns the role-filtered field-day timeline.
- `POST /api/workorders/:id/field-days/:fieldDayId/report`
  - multipart form with required daily fields and progress media;
  - accepts a late reason only when the report is overdue;
  - optionally creates an extension request in the same transaction after all validation succeeds.
- `POST /api/workorders/:id/extension-requests`
  - creates an extension request separately when needed outside report submission.

### Admin APIs

- `PATCH /api/admin/workorders/:id/field-plan` sets the approved duration, completion date, time zone, and optional daily schedule.
- `POST /api/admin/workorders/:id/field-days/override` creates or closes an exceptional day with a mandatory reason and audit entry.
- `POST /api/admin/workorders/:id/extension-requests/:requestId/decision` approves or rejects an extension.
- Existing Admin work-order detail responses include field-day summaries, overdue counts, and pending extension requests.

### Protected media API

- `GET /api/workorders/:workOrderId/field-media/:mediaId` streams authorized private media.

Media creation is only available through the check-in and report endpoints so an uploaded object cannot exist without an authorized business record.

## Authorization and Validation

- Only the currently assigned engineer can create a new field day or daily report.
- Field work is available only for `onsite` work orders in `in_service` status.
- Admin plan fields must exist before the first normal check-in.
- Customer and engineer access is derived from the work order, not from client-supplied user IDs.
- Check-in accepts image MIME types only, with a conservative size limit and decoded-image validation.
- Progress reports require at least one customer-visible progress photo.
- Labor hours must be positive and within a bounded daily range. An exceptional value requires Admin correction rather than silent acceptance.
- Server-side conversion using the work order's IANA time zone determines `site_local_date`.
- Check-in creation, media metadata, and audit logging must be atomic from the application's perspective. R2 and D1 do not share a transaction, so the Worker must validate before upload, delete an uploaded object if the subsequent D1 write fails, and make any rare orphan object inaccessible and eligible for scheduled cleanup. Failed upload or validation must not leave a visible partial field day.
- Idempotency keys prevent duplicate check-in or report records when a mobile retry follows an uncertain network response.

## User Experience

### Engineer workspace

Add a `Field work` / `现场作业` tab to assigned onsite work orders.

The top action reflects only today's next required step:

- no field day: `Take photo and check in`;
- checked in: check-in evidence summary and `Submit today's report`;
- report submitted: today's closed summary and the historical timeline;
- previous overdue report: a visible reminder and link to complete it, without blocking today's check-in.

The check-in capture UI uses `getUserMedia` and a camera preview. The capture control remains disabled until a camera stream is available. It records whether optional location was obtained and explains location failure without treating it as check-in failure.

The report form autosaves unsent text locally per field day. Upload or network failure preserves the draft and allows retry. A successful response clears the matching local draft.

### Customer workspace

The customer sees:

- approved expected completion date and planned service days;
- a chronological list of submitted customer-visible daily reports;
- progress photos;
- extension-request decisions and revised plan;
- late-report status only when a report has not yet been supplied, without exposing internal disciplinary details.

The customer does not see internal notes, internal attachments, geofence internals, raw coordinates, Admin override reasons, or unrelated audit details.

### Admin portal

The work-order detail drawer gains a `Field work` section with:

- plan configuration;
- daily status timeline;
- secure check-in and progress-photo previews;
- location available/unavailable and geofence outcome;
- daily labor hours and total labor hours;
- overdue-report highlighting;
- pending extension decisions;
- exceptional-day override with mandatory reason;
- immutable audit history and report revisions.

The work-order list exposes compact indicators for `checked in today`, `report overdue`, and `extension pending` so operations does not need to open every work order.

## Notifications and Scheduling

Use existing in-app notifications and OneSignal push. The first release does not add SMS or email reminders.

- At check-in, store an expected checkout time supplied by the engineer or derived from the Admin plan.
- Thirty minutes before expected checkout, notify the engineer if the report is not submitted.
- After the local calendar day ends, mark an open day overdue and notify the engineer and Admin-side operations.
- On customer-visible report submission, notify the customer.
- On extension request, notify Admin-side operations.
- On extension approval or rejection, notify the engineer; approval also notifies the customer of the revised plan.

A Worker scheduled handler scans active field days and pending reminders at a bounded interval. It evaluates each open field day's local date using the stored IANA time zone, rather than the runner's time zone. Reminder delivery must be idempotent through stored reminder timestamps or deduplication keys.

Adding a production cron trigger changes deployment configuration and therefore also requires explicit confirmation before editing `worker/wrangler.toml`.

## Final Service Closure

The existing final service-report submission remains the overall closure action. Before accepting it, the Worker verifies:

- the assigned engineer has at least one field day for an onsite work order;
- no field day remains `checked_in` or `report_overdue`;
- the final day's daily report exists;
- any pending extension request has been decided or cancelled;
- the existing arrival/manual-override compatibility requirement has been satisfied by a valid field-day check-in or explicit Admin override.

The final report may display a generated summary of daily dates and total labor hours, but the engineer remains responsible for the final diagnosis and conclusions.

## Legacy Compatibility

- Keep `work_order_arrival_checks` and existing arrival fields for historical records and compatibility during rollout.
- Existing completed or active work orders with a valid legacy arrival verification remain valid and are not forced to fabricate past daily records.
- After rollout, every valid normal photo check-in writes a compatibility arrival record, and the first valid field day populates `arrival_verified_at` so existing completion and Admin views continue to work.
- The UI labels legacy records as `Legacy location check` and new records as `Photo check-in`.
- Do not delete or rewrite historical location evidence in the migration.

## Retention and Privacy

- No facial recognition or biometric processing is performed.
- Protected media is stored privately and accessed only through authenticated Worker routes.
- Check-in and field-day media become eligible for deletion 12 months after the work order reaches final completion.
- If a complaint, warranty case, safety review, legal hold, or dispute is open, deletion is postponed until that hold is resolved.
- The deletion job first checks `work_order_field_evidence_holds`, then removes the R2 object and records `deleted_at`; it retains non-image evidence such as timestamps, location availability, report text, labor hours, decisions, and audit records.
- The legal/privacy copy must disclose collection purpose, role-based access, retention, and the absence of facial recognition before production rollout.

## Failure and Exception Handling

- Camera unavailable or denied: instruct the engineer to use a phone; normal check-in cannot fall back to the photo library.
- Location unavailable: submit the photo check-in and record the location failure category.
- Photo upload failure: preserve the client state and allow retry; do not create a field day.
- Uncertain mobile response: repeat with the same idempotency key and return the original successful record.
- Exceptional no-photo case: Admin uses an audited override with a mandatory reason; the system labels it as an override, never as a normal photo check-in.
- Customer-visible report contains unsuitable content: Admin correction creates a revision and preserves the original for audit.
- Engineer reassignment: old evidence remains readable according to historical participation and Admin access, while write permission follows the current assignment.

## Security Boundaries

- Do not reuse public attachment URLs for protected media.
- Do not return R2 object keys in customer-facing or engineer-facing JSON unless they are opaque non-fetchable identifiers.
- Validate authorization on every media read; UI visibility is not a security boundary.
- Sanitize media filenames and generate server-side object keys.
- Validate MIME type, decoded format, and file size; reject executable or polyglot content.
- Apply private/no-store response headers and prevent search indexing.
- Record check-in, report, correction, extension, override, and deletion actions in the existing audit system.
- Avoid exposing raw customer-site coordinates to the customer or unrelated roles in daily-report responses.

## Testing

### Worker tests

- live-photo check-in succeeds with and without location;
- invalid assignment, service mode, status, duplicate local day, invalid photo, and missing plan are rejected;
- location failure is stored without rejecting a valid photo check-in;
- daily report validation, customer/internal visibility, late reason, and labor-hour bounds;
- missed reports block final service closure but do not block next-day check-in;
- extension request and Admin decision update the plan once and send role-correct notifications;
- private media authorization for engineer, customer, Admin, and unrelated users;
- legacy arrival compatibility;
- retention deletion and legal-hold exclusion;
- idempotent reminders and mobile retries.

### Frontend and Admin contract tests

- check-in uses a live camera flow and does not expose a gallery picker;
- location errors do not disable photo submission;
- report drafts survive failed uploads;
- customer responses never render internal fields;
- Admin exposes plan, overdue, extension, override, and revision controls;
- final report submission is disabled with a clear explanation while daily records are incomplete.

### E2E

Extend the isolated three-role lifecycle with a two-day onsite project:

1. Admin sets the field plan and assigns the engineer.
2. Engineer performs day-one photo check-in with unavailable location.
3. Engineer leaves day one overdue and can still check in on day two.
4. Engineer supplies the late day-one report and reason.
5. Engineer submits day-two report with an extension request.
6. Admin approves the extension and the customer sees the revised plan.
7. Customer sees customer-visible reports and media but not internal notes.
8. Engineer submits the final report only after all field days are closed.

Use local R2 in the E2E environment. Do not access production media or data.

## Deployment and Rollout

1. Add the migration and schema snapshot updates.
2. Add the private R2 bucket binding and scheduled trigger after explicit configuration confirmation.
3. Apply the migration to both `sagemro-db` and `sagemro-db-cn` before Worker deployment.
4. Deploy the shared Worker and international frontend/Admin from `main`.
5. Sync compatible frontend/Admin changes to `china-edition` and deploy the real China production sites through the Aliyun ECS workflow.
6. Run a production smoke test with a temporary onsite work order and guaranteed cleanup of D1 records and private R2 objects.
7. Enable mandatory photo-first daily check-in for newly started onsite work orders. Existing active work orders continue with legacy compatibility unless Admin opts them into the new field plan.

## Out of Scope for the First Release

- facial recognition, liveness detection, or biometric identity matching;
- continuous GPS tracking or background location collection;
- automatic payroll, overtime, or engineer payout calculation from daily hours;
- customer signatures on every daily report;
- SMS or email reminders;
- offline-first media synchronization;
- automatic image-content judgment that decides whether a face or machine is present;
- multi-engineer simultaneous crew attendance on one field day.

These can be evaluated after the single-assigned-engineer daily workflow is stable.

## Success Criteria

- An onsite engineer can complete a multi-day project without closing and reopening the work order each day.
- Every normal onsite workday has a server-timestamped live check-in photo and a structured daily report.
- Location failure never prevents a valid photo check-in and is represented honestly.
- Customers receive timely customer-visible progress while internal notes remain inaccessible.
- Missing reports remain operationally visible and must be resolved before final closure.
- Planned duration and extensions have explicit Admin ownership and customer notification.
- Protected media cannot be opened through a public R2 URL and is deleted according to the approved retention rule.
- International and China editions expose equivalent behavior with localized copy.
