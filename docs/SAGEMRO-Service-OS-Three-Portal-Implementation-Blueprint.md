# SAGEMRO Service OS Three-Portal Implementation Blueprint

> Status: approved execution blueprint
> Last updated: 2026-06-07

## 1. Product Structure

SAGEMRO Service OS will operate as one unified service system with three role-specific portals.

| Role | Product Name | Entry | Purpose |
| --- | --- | --- | --- |
| Customer / Visitor | SAGEMRO Service OS | `sagemro.com` / `sagemro.cn` | AI-first service conversation, equipment records, service requests, service progress |
| Engineer / Regional Lead | SAGEMRO Internal Engineer Workspace / Service Representative Console | `engineer.sagemro.com` / `engineer.sagemro.cn` | Regional task assignment, assigned service execution, AI diagnosis summary, checklists, reports |
| Admin / Operations | SAGEMRO Operations Console | `admin.sagemro.com` / `admin.sagemro.cn` | Lead triage, official service confirmation, dispatch, quote review, quality archive |

## 2. Core Principles

- SAGEMRO is an official service system, not a marketplace or open bidding platform.
- Engineer and regional lead accounts are created by SAGEMRO after cooperation is confirmed. Public engineer self-registration stays closed.
- The engineer portal is independent: `engineer.sagemro.com` / `engineer.sagemro.cn`.
- The main website is for customers and visitors only, keeping the customer experience simple.
- Customers and engineers communicate through the same work-order conversation, but identity, entry point, and permissions stay separated: customers use the main site, engineers use the engineer workspace, and Admin can supervise the full record.
- Customers use a simple AI conversation flow. They should not choose complex AI tools or fill long forms first.
- The six AI capabilities are hidden conversation outcomes: fault diagnosis, cutting parameters, parts identification, repair estimate preparation, new machine selection, equipment health report.
- Admin and engineer experiences must be separated. Admins manage the service system; engineers execute assigned tasks.
- `.com` defaults to English and international positioning. `.cn` defaults to Simplified Chinese and domestic compliance positioning.

## 3. Customer Portal Scope

### Modify

- Remove or hide marketplace wording: partner console, service provider bidding, self-registration engineer flow, wallet/commission language.
- Keep homepage and chat extremely simple.
- Keep the main site for customer login and visitor access only. Engineer login moves to the independent engineer portal.
- Complete `.cn` copy localization after main changes stabilize.

### Develop

- AI creates a service-ready summary inside chat after enough information is collected.
- Customer confirms the summary before a formal service request is created.
- Guest conversations can become CRM leads with source and AI summary.
- Customer can view equipment records, service requests, quotes, reports, and confirmations.
- Customers can communicate inside the work order with the official SAGEMRO service team and assigned engineer, but customers cannot choose engineers or dispatch tasks directly.

## 4. Engineer Workspace Scope

### Product Name

Chinese: SAGEMRO 内部工程师工作台

English: Service Representative Console

### Modify

- Engineers cannot self-register.
- Regional leads only see leads and service tasks assigned to their region or team by Admin.
- Engineers only see tasks assigned to them by their regional lead, not the full lead or customer pool.
- Remove user-facing wallet, commission, withdrawal, bidding, and free-order-taking language.
- Engineer status means dispatch availability: available, paused, offline, disabled.

### Develop

- Today assignments
- Regional task pool for regional leads
- Pending assignment confirmation
- In-service tasks
- Service reports to complete
- Parts requirements
- Customer equipment records
- AI diagnosis summaries
- Service standard checklists
- Arrival record, photos, actions taken, parts replaced, next-step recommendations
- First-login password reset and service/safety policy acknowledgement
- Engineers can communicate with customers inside assigned work orders to confirm service details, site preparation, and issue context. Final quote, service conclusion, and archive still require the official SAGEMRO process.

### Engineer Portal Roles

| Role | Permissions |
| --- | --- |
| Regional Lead | Receives leads/service tasks assigned by Admin; views regional engineer capability, workload, and status; assigns tasks to specific engineers; tracks regional task progress |
| Engineer | Views own assigned tasks; confirms assignments; reads AI diagnosis, customer equipment records, and parts needs; submits service reports |

Dispatch flow:

1. Customer / AI creates a lead or service request.
2. Admin reviews it in Operations Console and assigns it to a regional lead.
3. The regional lead reviews regional capacity and assigns it to Engineer 1, 2, 3, 4, 5, etc.
4. The engineer performs service and submits the service report.
5. Regional lead and Admin track results, review if needed, and archive.

### Work-Order Communication And Anti-Self-Dispatch

Work-order communication principles:

- Work-order conversation is an official SAGEMRO service record, not private customer-engineer chat.
- Customer portal, engineer portal, and admin console share the same work-order conversation data with different role-specific views.
- Customers see service progress, engineer messages, quote confirmation, service reports, and completion confirmation.
- Engineers see customer issue context, AI diagnosis summary, safety risks, equipment record, service task, parts preparation, and customer replies.
- Admin and regional leads can view the full communication record for service quality, quote review, and compliance archive.

Anti-self-dispatch and conflict-of-interest rules:

- Engineers must not receive work orders created by themselves, their related company, or accounts linked to their phone, email, address, equipment, or login identity.
- Customers cannot choose engineers or dispatch tasks to a specific engineer.
- Engineers cannot claim tasks from the lead pool. Every dispatch must follow Admin -> Regional Lead -> Engineer.
- Regional leads cannot assign conflicted work orders to themselves or related engineers.
- Final quotes must be reviewed by Admin or authorized operations staff before being sent to customers. Engineers can submit field recommendations, parts needs, and repair plans.
- Customer confirmation should use the customer account, SMS code, email confirmation, or another independent proof. It must not rely only on engineer-submitted records.
- Every assignment, reassignment, quote, customer confirmation, and service-report submission must be recorded in audit logs.

## 5. Operations Console Scope

### Product Name

SAGEMRO Operations Console

### Modify

- Reframe admin from generic management backend to operations console.
- Keep existing pages as foundations: dashboard, users, service operations, ratings, CRM leads.
- Improve information architecture around lead triage, dispatch, quote review, service quality, and archive.

### Develop

Dashboard metrics:

- New AI leads today
- Service requests pending review
- High-risk downtime issues
- Pending quotes
- Pending dispatch
- In-service tasks
- Pending archive
- Parts leads
- Euchio new-machine leads

Lead pool:

- Group by source: fault diagnosis AI, cutting parameters AI, parts identification AI, repair estimate AI, new machine selection AI, equipment health report AI, manual service request, contact form.
- Each lead shows source, customer, equipment, region, AI summary, risk level, recommended next step, assignment status.

Dispatch and service quality:

- Assign leads or service tasks to regional leads.
- Regional leads assign tasks to internal engineers / certified service representatives.
- View capability tags, service regions, available brands, current workload, ratings.
- Review quotes and service outcomes.
- Archive service records.

Engineer account management:

- Create engineer accounts.
- Create regional lead accounts.
- Reset password.
- Disable accounts.
- Set responsible region, team membership, service region, capability tags, brand coverage, certification status, and availability.

## 6. Data And API Changes

### Leads

Implementation requirements:

- `source_type`: `fault_diagnosis_ai`, `cutting_parameter_ai`, `parts_identification_ai`, `repair_estimate_ai`, `machine_selection_ai`, `health_report_ai`, `manual_service_request`, `contact_form`
- `risk_level`: `low`, `medium`, `high`, `critical`
- `ai_summary`
- `recommended_next_step`
- `assignment_status`: `unassigned`, `assigned`, `converted`, `closed`
- `customer_id`
- `device_id`
- `work_order_id`
- `region`

### Engineers

Implementation requirements:

- cooperation status
- role type: regional lead / engineer
- parent regional lead
- certification status
- capability tags
- service regions
- brand coverage
- workload status
- disabled state

### Regions And Teams

- Region records: region name, covered cities/provinces, regional lead.
- Engineer team membership: each engineer belongs to a regional lead/team.
- Regional lead scope: can only manage tasks and engineers within their region or assigned team.

### Work Orders

Must support the following status flow:

- pending_review
- pending_dispatch
- assigned
- in_service
- pending_quote
- pending_customer_confirmation
- pending_archive
- completed
- cancelled

Must add dispatch and risk-control fields:

- `assigned_regional_lead_id`
- `assigned_engineer_id`
- `conflict_status`: `clear`, `review_required`, `blocked`
- `conflict_reason`
- `quote_review_status`
- `customer_confirmation_method`

### Work Order Messages

Must add or normalize:

- linked work order
- sender type: customer / engineer / regional lead / admin / system
- message content
- attachments and images
- internal note flag
- customer-visible flag
- created time

Internal notes must be separated from customer-visible messages to avoid exposing quote review, risk-control judgment, or internal dispatch discussion to customers.

### Audit Logs

Must add or normalize:

- actor
- target object
- action type
- before state
- after state
- IP / device information
- created time

Key actions to log: account creation, permission changes, work-order assignment, reassignment, quote submission, quote review, customer confirmation, service-report submission, and archive.

### Service Reports

Must add or strengthen:

- diagnosis
- safety checklist
- actions taken
- parts used
- photos
- labor hours
- customer confirmation
- next recommendations

### Parts Requests

Must add or strengthen:

- part name/model
- quantity
- urgency
- linked equipment
- linked work order
- procurement status

## 7. Execution Order

1. Save this blueprint as the implementation reference.
2. Update admin shell to SAGEMRO Operations Console and reshape dashboard metrics.
3. Upgrade CRM leads into an operations lead pool.
4. Create the independent engineer portal entry: `engineer.sagemro.com` / `engineer.sagemro.cn`.
5. Keep main-site login for customers only.
6. Add Admin -> Regional Lead -> Engineer two-level dispatch.
7. Add shared work-order conversations so customers and engineers communicate inside the same service record.
8. Add conflict-of-interest detection, anti-self-dispatch rules, quote review, and audit logs.
9. Add required lead fields and API compatibility fallbacks.
10. Strengthen dispatch, quote, service report, and customer confirmation flows.
11. Localize and sync `.cn` branch after main is stable.
12. Run production smoke test: customer chat -> lead/request -> Admin review -> assign regional lead -> regional lead assigns engineer -> engineer work-order conversation -> Admin quote review -> engineer report -> customer confirmation.

## 8. First Implementation Slice

The first coding slice uses a compatibility-first implementation strategy:

- Admin: rename shell and dashboard cards.
- Admin: enrich lead pool UI with source/risk/next-step columns using graceful fallbacks.
- Engineer portal: design as an independent domain. Shared components may be reused temporarily during migration, but the long-term entry must not be the customer main site.
- Worker: return lead fields with backward-compatible defaults.
