# Quote Execution Baseline Design

## Objective

Make the customer-confirmed quote the single execution baseline for a service work order. One quote version contains:

- the fee breakdown;
- the approved onsite workday estimate when field work is involved;
- either a default one-time payment or an optional installment plan.

Admin reviews these terms together, and the customer confirms them together. The activated version then drives field-work capacity, collection follow-up, service-start authorization, and financial closure.

This design also removes remaining English check-in and technical time-zone copy from the China user experience.

## Confirmed Business Rules

### Onsite workdays

- `onsite` and `hybrid` quotes require a positive integer for expected onsite workdays.
- `remote` quotes hide this field and do not create an onsite workday allowance.
- A `hybrid` quote stores the reviewed onsite allowance, but field-day check-in remains unavailable while service is still remote. The allowance becomes executable only after the existing onsite-conversion workflow confirms `service_mode = 'onsite'`.
- An actual workday is counted only after a valid field-day check-in has a submitted daily report.
- Multiple check-ins or report revisions for the same site-local date count as one actual workday.
- Non-working dates, weekends, parts-waiting dates, and customer shutdown windows do not consume the allowance unless field work is actually recorded.
- Engineers are responsible for making a cautious, commercially reasonable estimate before submitting the quote.
- Finishing in fewer days is allowed and does not change the confirmed price.
- An approved extension increases the permitted workday allowance but does not increase labor fees by default.
- Extra parts or an expanded service scope require separately reviewed and customer-confirmed commercial terms. An extension request cannot change price.
- Expected completion dates are operational guidance only. Enforcement uses consumed actual workdays, not elapsed calendar days.

This replaces the normal-plan portion of the earlier onsite-workday design in which Admin manually entered expected service days. Admin retains extension approval, exceptional check-in handling, daily-report correction, and audit authority.

### Payment terms

- The default is one installment for 100% of the confirmed quote total, due before service starts.
- An engineer may instead propose an installment plan containing 2 to 6 installments after agreeing the commercial structure with the customer.
- Each installment specifies an amount, a payment trigger, and a customer-visible description. The UI derives its percentage from the amount and quote total.
- Installment amounts must be positive and must sum exactly to the quote total in the quote currency.
- At least one installment must be due before service starts. Every installment marked as a start prerequisite must be fully received before field work can begin.
- Admin reviews the payment plan with the quote. The customer confirms the complete quote, workday estimate, and payment plan in one action.
- After customer confirmation, the activated commercial version is immutable. Before any receipt is confirmed, a replacement creates a new version and requires Admin review and customer confirmation again. After any receipt is confirmed, added scope or fees use a separately versioned supplemental quote rather than rewriting the original baseline or reallocating historical money.
- Engineers initiate and follow up each collection. Engineers cannot confirm that money has reached SAGEMRO.
- Only Admin can confirm an actual receipt, reject evidence, or record an audited adjustment.
- Service completion and financial settlement are independent. A service may be complete while one or more installments remain unpaid, but the work order cannot be financially archived until all installments are fully received.

## Roles And Responsibility

### Engineer

- prepares fee lines, expected onsite workdays, and payment terms;
- submits a quote version for Admin review;
- starts collection for an installment when its agreed trigger is reached;
- follows up with the customer and submits payment evidence or a collection note;
- requests Admin confirmation of an actual receipt;
- manages daily execution within the approved workday allowance;
- submits daily reports and requests extensions when necessary.

### Customer

- sees the complete approved quote before confirmation;
- confirms fees, onsite workdays, and all payment installments together;
- sees installment amounts, triggers, descriptions, payment status, confirmed receipts, and remaining balance;
- supplies payment method information or evidence through the existing protected work-order interaction.

### Admin

- reviews the fee breakdown, workday estimate, and payment plan as one commercial package;
- returns the complete version for correction or approves it for customer confirmation;
- verifies actual receipts and records the confirmed amount;
- rejects insufficient evidence with a required reason;
- manages exceptions, extensions, daily-report corrections, and audited adjustments;
- cannot silently rewrite a customer-confirmed payment plan or quote workday estimate.

## Quote Version Model

The current mutable `work_order_pricing` record remains the active quote projection for compatibility. Its history becomes the authoritative version trail.

Add to the current quote and quote-history snapshot:

- `expected_service_days` as nullable integer;
- `payment_plan_mode` as `single` or `installments`;
- an explicit quote version number shared with the related payment-plan snapshot.

Create an immutable payment-plan snapshot for each submitted quote version. Each installment contains:

- quote and version relationship;
- sequence number;
- amount and currency;
- trigger type;
- optional due date where the trigger needs a calendar deadline;
- customer-visible description;
- whether full receipt is required to start service.

Initial trigger types are deliberately bounded:

- `before_start`;
- `on_arrival`;
- `milestone`;
- `on_completion`;
- `on_acceptance`;
- `fixed_date`.

`milestone` requires a plain-language description. `fixed_date` requires a due date. Other trigger types may include a description for clarity.

Quote submission writes the pricing snapshot and payment-plan snapshot as one logical operation. A partial write must not leave a reviewable quote without its payment terms.

### Version lifecycle

1. The engineer saves or edits a draft.
2. Submission assigns the next quote version and changes it to `pending_review`.
3. Admin either returns that version with a reason or approves that exact version for customer confirmation.
4. The customer confirms that exact version.
5. Customer confirmation activates and freezes the version.
6. Activation copies the quote's expected workdays into the work-order execution projection and creates operational installment records from the immutable schedule. For a hybrid service, that allowance remains dormant until onsite conversion is confirmed.

Admin approval alone does not activate field work or collection because the customer has not yet accepted the terms. The customer-confirmed version is the execution baseline.

## Collection And Receipt Model

Payment terms and actual receipts are separate records. Editing a scheduled amount can never represent money received.

### Operational installments

When a quote version is activated, create one operational installment per schedule line. It records:

- the immutable scheduled amount and trigger snapshot;
- collection-start and due timestamps;
- total Admin-confirmed received amount;
- derived remaining amount;
- completion timestamp;
- current operational state.

States exposed to users are:

- `scheduled`: agreed but not yet opened for collection;
- `due`: available for engineer collection follow-up;
- `collecting`: engineer has started collection;
- `pending_confirmation`: evidence awaits Admin review;
- `partially_received`: Admin confirmed less than the scheduled amount;
- `received`: the installment is fully received;
- `overdue`: a due date has passed with a remaining balance;
- `exception`: Admin attention is required.

Every `before_start` installment is automatically made due after customer confirmation. Other installments are opened by the engineer when the agreed trigger occurs. A fixed-date installment also becomes due automatically when its date arrives.

### Receipt claims

Every engineer request for receipt confirmation creates a receipt claim containing:

- installment and work-order relationship;
- engineer-stated amount;
- optional transaction reference and protected evidence relationship;
- engineer note and submission timestamp;
- status `pending`, `confirmed`, or `rejected`;
- Admin-confirmed amount, decision identity, reason, and timestamp.

Admin may confirm a partial amount. The installment remains `partially_received` and keeps its collection entry available until the remaining amount reaches zero.

Idempotency and database constraints must prevent a repeated Admin action or mobile retry from adding the same receipt twice. A normal confirmation cannot exceed the installment's remaining amount. Exceptional adjustments require an explicit Admin action, reason, and audit record.

## Service Start And Closure

Payment state must not be encoded only in `work_orders.status`; collection and field execution progress independently.

- Before start, the existing payment-follow-up workflow reads the activated installments rather than the full quote total.
- Service start becomes available only when every installment marked `required_before_start` is fully received and Admin has approved the start.
- The existing engineer `request Admin approval to start` action remains the final operational handoff after payment follow-up.
- After service starts, later installments retain their own collection actions while the work order remains `in_service`.
- Final service submission may set service execution to complete even when a balance remains.
- Financial archive requires all active installments to be fully received and any internal engineer payout controls to be satisfied.
- User interfaces show both service state and payment state, for example `服务已完成 · 待收尾款`, rather than forcing one ambiguous status.

## Field-Work Allowance

The activated onsite quote, or an activated hybrid quote later confirmed for onsite conversion, establishes `quote_expected_service_days`. The work-order execution projection tracks:

- initial quote workdays;
- approved extension days;
- current permitted workdays;
- consumed actual workdays;
- remaining workdays.

A field day consumes allowance when it reaches `report_submitted` or `late_report_submitted` with a valid check-in. The count is based on distinct work-order site-local dates and does not double count revisions or repeated events.

When consumed days equal permitted days:

- the engineer may finish and submit the final service report;
- a new field-day check-in is blocked unless an extension has been approved;
- the UI explains that the extension changes time allowance only, not price.

An approved extension adds the approved number of workdays to the execution projection and retains the original quote estimate for audit. It does not mutate the frozen quote version.

## User Experience

### Engineer quote form

- Show `预计现场作业日` / `Expected onsite workdays` only for onsite and hybrid service modes.
- Default payment terms to `开工前一次付清` / `100% before service starts`.
- A segmented choice enables `分次付款` / `Installments`.
- Installment editing supports add, remove, reorder, amount, trigger, optional date, start prerequisite, and description.
- Show a stable summary of quote total, scheduled total, difference, and derived percentages.
- Disable submission until service-day and payment-plan invariants pass.
- Explain that approved extensions do not automatically add labor fees.

### Customer quote confirmation

- Present fees, expected onsite workdays, and the full installment schedule in one confirmation view.
- Use one confirmation checkbox/action for the complete version; partial confirmation is unavailable.
- After activation, show per-installment status, confirmed receipts, remaining amount, and total outstanding balance.

### Engineer collection workspace

- Each due or partially received installment has `发起本期收款` / `Start collection`.
- Collecting installments allow evidence/reference submission and `申请 Admin 确认到账` / `Request receipt confirmation`.
- Received installments are read-only.
- The collection entry remains available after service completion until the balance is settled.

### Admin work-order detail

- The quote-review section displays fees, expected onsite workdays, and every installment before approve/return actions.
- The receipt-review section displays the scheduled amount, previously confirmed receipts, remaining amount, evidence, reference, and engineer note.
- Confirm, partially confirm, reject, and exceptional-adjustment actions are separately labeled and audited.
- The field-plan section becomes a read-only quote baseline summary for normal work: approved quote days, extension days, consumed days, and remaining days.
- Admin retains controls for extension decisions, exceptional field-day handling, report correction, and audit history.

## China Localization Corrections

All new copy is market-aware. The same implementation also corrects existing leaks:

- `Engineer checked in` becomes `工程师已到场签到` in the China market;
- `Engineer checked in for WO-...` becomes `工程师已为工单 WO-... 完成现场签到。`;
- `IANA 时区` becomes `现场时区`;
- `Asia/Shanghai` is displayed to normal users as `中国标准时间（上海）`.

The IANA identifier remains stored internally and may appear only in technical audit details where needed. International copy remains English.

## Validation And Failure Handling

- Reject onsite or hybrid quote submission without a positive integer workday estimate.
- Ignore and store no onsite allowance for a remote quote.
- Reject installment plans outside 2 to 6 lines, with non-positive amounts, mismatched currency, duplicate sequence, invalid triggers, or a total different from the quote total.
- Reject a plan without at least one start-prerequisite installment.
- Reject customer confirmation if the approved version has been superseded or its schedule is incomplete.
- Reject receipt claims not owned by the assigned engineer or not belonging to the active quote version.
- Reject Admin confirmation exceeding the remaining scheduled amount through the normal action.
- Preserve evidence and entered text after recoverable network failures; retries use idempotency keys.
- A returned or superseded quote version cannot create operational installments.
- Activating a version and creating its operational installments must be transactionally consistent in D1.
- A replacement version is allowed only before any receipt is confirmed. After the first confirmed receipt, added scope or fees require a supplemental quote with its own payment schedule; the original schedule and receipts remain unchanged.
- Extension approval never changes quote totals, payment schedules, or receipt balances.

## Historical Compatibility

Existing work orders and payments must remain readable.

- A historical confirmed quote without a payment-plan snapshot is presented as a legacy single installment for 100% of its quote total.
- Existing completed `work_order_payments` may satisfy that legacy installment only through a deterministic migration/projection rule; the migration must not invent Admin decision identities or evidence.
- Historical onsite plans continue to display their existing Admin-set values. They are not relabeled as engineer-quoted estimates.
- New quote-driven rules apply to quote versions submitted after feature activation.
- Existing API response fields remain during a compatibility window while the three clients move to the new schedule and receipt fields.

## Authorization And Audit

- Engineer and customer access derives from work-order assignment/ownership, never a client-supplied identity.
- Only the assigned engineer can submit or revise a quote and initiate its installment collection.
- Only the owning customer can confirm the approved quote version.
- Only authorized Admin-side roles can approve quotes or decide receipt claims.
- Every quote review, customer confirmation, collection start, receipt claim, Admin receipt decision, adjustment, extension decision, and financial archive writes an audit event with before/after state.
- Customer-visible payment evidence uses the existing protected work-order access model; sensitive internal notes and adjustment reasons are not exposed to customers.

## Testing

Worker domain and API tests cover:

- service-mode workday requirements;
- default 100% single-payment generation;
- valid and invalid 2-to-6-installment schedules;
- exact-total and start-prerequisite validation;
- immutable version review and stale customer confirmation;
- atomic activation and installment creation;
- engineer/customer/Admin authorization;
- partial receipts, rejection, remaining balance, overpayment rejection, and idempotent confirmation;
- start gating across multiple prerequisite installments;
- service completion with an outstanding balance and financial-archive gating;
- distinct actual-workday counting, extension gating, and no price mutation;
- legacy quote/payment projections;
- CN/COM notification selection.

Frontend and Admin tests cover:

- conditional workday input by service mode;
- default and installment editors without wrapping or overflow on mobile;
- complete customer confirmation summary;
- collection actions and partial-payment states;
- Admin combined quote review and receipt decision actions;
- localized China notification and time-zone labels.

A three-role end-to-end flow verifies engineer quote submission, Admin approval, customer confirmation, first receipt confirmation, start authorization, multiple field days, later installment collection, service completion with balance outstanding, final receipt, and financial archive.

## Migration And Rollout

1. Implement on a branch based on current `main`, with tests written before behavior changes.
2. Add one forward-only migration for quote workdays, versioned payment schedules, operational installments, and receipt claims.
3. Apply and verify the migration manually on both `sagemro-db` and `sagemro-db-cn` before deploying the shared Worker.
4. Deploy the Worker and international frontend/Admin from `main`.
5. Sync compatible frontend/Admin changes to `china-edition` without duplicating Worker logic.
6. Deploy the China frontend, engineer portal, and Admin portal through the Aliyun ECS workflow.
7. Run COM and CN smoke tests with separate temporary work orders and guaranteed cleanup.

No workflow, `wrangler.toml`, or deployment-project configuration change is required by this design. If implementation discovery proves otherwise, repository policy requires separate user confirmation before modifying those files.

## Out Of Scope

- automated bank reconciliation;
- automatic charging or card-on-file collection;
- engineer authority to confirm SAGEMRO bank receipt;
- arbitrary installment count above six;
- installment interest, financing, or credit scoring;
- automatic extra labor fees for extensions;
- replacing the final service report or existing engineer-payout approval controls.
