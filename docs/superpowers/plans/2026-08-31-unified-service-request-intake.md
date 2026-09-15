# Unified Service Request Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing SAGEMRO work-order form into one four-step service-request flow that supports manual entry and AI-assisted completion while continuing to create the same work-order records through the existing API.

**Architecture:** Extract a single draft model and a single `ServiceRequestFlow` from the current `WorkOrderModal`. Both manual and AI modes update that model, and final submission calls the existing `/api/workorders` route after market-specific authentication. Add structured intake columns to `work_orders`; keep `description` for the customer's narrative and preserve all downstream pricing, dispatch, field-service, report, and rating behavior.

**Tech Stack:** React 19, browser `sessionStorage`, Cloudflare Workers, D1 SQLite, KV rate limits, existing AI provider adapter, Node test runner, Playwright E2E.

---

## Global constraints

- There is exactly one service-request draft model, one validation path, and one final work-order API.
- Do not create a second “lead” or “service request” table for this flow.
- Do not send free-text equipment problems through query parameters.
- Do not persist an unauthenticated draft on the server; keep it in `sessionStorage` until the customer authenticates.
- Do not expose customer phone, WhatsApp, email, or site address to public pages, analytics properties, logs, or engineer views before existing authorization gates allow it.
- AI may organize fields and ask for missing information, but may not make a final diagnosis, price, dispatch, safety approval, or warranty promise.
- Migration `047` must be applied to both production D1 databases before Worker code reads the new columns.

## File map

- Create `worker/migrations/047_structured_service_request_intake.sql` — structured work-order intake snapshots.
- Create `worker/src/lib/serviceRequestIntake.js` — normalization, validation, AI-output schema, and prompt boundary.
- Modify `worker/src/index.js` — accept structured fields and expose the AI-assist endpoint.
- Create/modify Worker tests for migration, route, authorization, validation, and redaction behavior.
- Create `frontend/src/components/ServiceRequest/serviceRequestDraft.js` — canonical client draft model.
- Create `frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx` — sole four-step form.
- Create `frontend/src/components/ServiceRequest/ServiceRequestPage.jsx` — routed AI-portal page.
- Modify `frontend/src/components/Sidebar/WorkOrderModal.jsx` — compatibility wrapper over the same flow, not another form.
- Modify `frontend/src/App.jsx`, `Sidebar.jsx`, and public conversion helpers — navigate every service CTA to `/service-request`.
- Modify `frontend/src/components/Auth/LoginModal.jsx` and auth API handling — make international phone optional and add email password reset.
- Add focused frontend tests and extend `e2e/tests/service-order-lifecycle.spec.mjs`.

### Task 1: Add structured intake storage to the existing work order

**Files:**
- Create: `worker/migrations/047_structured_service_request_intake.sql`
- Modify: `worker/tests/migrations.test.mjs`

- [ ] **Step 1: Write the failing migration test**

Add `047_structured_service_request_intake.sql` to the expected migration list and assert the schema contains these columns:

```js
[
  'service_request_version',
  'service_request_kind',
  'device_types_json',
  'device_brands_json',
  'device_model',
  'region_json',
  'alarm_code',
  'production_impact',
  'contact_name',
  'contact_email',
  'contact_phone',
  'contact_whatsapp',
  'contact_preference',
]
```

- [ ] **Step 2: Run and verify failure**

Run: `cd worker && node --test tests/migrations.test.mjs`

Expected: FAIL because migration `047` and its columns do not exist.

- [ ] **Step 3: Create the migration**

Use explicit nullable columns so legacy work orders remain valid:

```sql
ALTER TABLE work_orders ADD COLUMN service_request_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE work_orders ADD COLUMN service_request_kind TEXT;
ALTER TABLE work_orders ADD COLUMN device_types_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE work_orders ADD COLUMN device_brands_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE work_orders ADD COLUMN device_model TEXT;
ALTER TABLE work_orders ADD COLUMN region_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE work_orders ADD COLUMN alarm_code TEXT;
ALTER TABLE work_orders ADD COLUMN production_impact TEXT;
ALTER TABLE work_orders ADD COLUMN contact_name TEXT;
ALTER TABLE work_orders ADD COLUMN contact_email TEXT;
ALTER TABLE work_orders ADD COLUMN contact_phone TEXT;
ALTER TABLE work_orders ADD COLUMN contact_whatsapp TEXT;
ALTER TABLE work_orders ADD COLUMN contact_preference TEXT;
```

- [ ] **Step 4: Run migration tests**

Run: `cd worker && node --test tests/migrations.test.mjs`

Expected: PASS; existing migration replay tests remain green.

- [ ] **Step 5: Commit after user authorizes implementation commits**

```bash
git add worker/migrations/047_structured_service_request_intake.sql worker/tests/migrations.test.mjs
git commit -m "feat: store structured service request intake"
```

### Task 2: Define one server-side intake contract

**Files:**
- Create: `worker/src/lib/serviceRequestIntake.js`
- Create: `worker/tests/service-request-intake.test.mjs`

- [ ] **Step 1: Write failing normalization tests**

Cover valid arrays, empty optional fields, invalid contact preference, overlong text, and unknown keys:

```js
const normalized = normalizeServiceRequestIntake({
  device_types: ['Laser Cutter'],
  device_brands: ['TRUMPF'],
  device_model: 'TruLaser 3030',
  region: ['Germany', 'Bavaria'],
  alarm_code: 'E-102',
  production_impact: 'Machine stopped',
  contact: {
    name: 'Alex Example',
    email: 'alex@example.test',
    phone: '+49 000 000000',
    whatsapp: '+49 000 000000',
    preference: 'email',
  },
});
assert.deepEqual(normalized.device_types, ['Laser Cutter']);
assert.equal(normalized.contact.preference, 'email');
```

Allowed preferences must be exactly `email`, `phone`, `whatsapp`, or `platform`.

- [ ] **Step 2: Run and verify failure**

Run: `cd worker && node --test tests/service-request-intake.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement pure normalization**

Export:

```js
export const SERVICE_REQUEST_VERSION = 2;
export const SERVICE_REQUEST_KINDS = ['repair', 'retrofit', 'relocation', 'maintenance', 'used_equipment', 'parts'];
export const SERVICE_KIND_TO_WORK_ORDER_TYPE = {
  repair: 'fault',
  retrofit: 'aftersales',
  relocation: 'aftersales',
  maintenance: 'maintenance',
  used_equipment: 'aftersales',
  parts: 'parts',
};
export function normalizeServiceRequestIntake(input) { /* return the complete normalized shape */ }
export function serializeServiceRequestIntake(input) { /* map arrays to JSON DB values */ }
export function buildServiceRequestAssistPrompt({ market, message, draft }) { /* strict JSON request */ }
export function parseServiceRequestAssistOutput(value) { /* whitelist fields and missingFields */ }
```

Reject values outside the existing length limits. `parseServiceRequestAssistOutput` must ignore diagnoses, prices, engineer assignments, arrival promises, and safety approvals even if the provider returns them.

- [ ] **Step 4: Run focused tests**

Run: `cd worker && node --test tests/service-request-intake.test.mjs tests/validators.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit after authorization**

```bash
git add worker/src/lib/serviceRequestIntake.js worker/tests/service-request-intake.test.mjs
git commit -m "feat: define service request intake contract"
```

### Task 3: Extend the existing work-order creation route

**Files:**
- Modify: `worker/src/index.js`
- Create: `worker/tests/service-request-create-api.test.mjs`
- Modify: `worker/tests/request-auth.test.mjs`

- [ ] **Step 1: Write failing API tests**

Submit a customer-authenticated request with the structured payload and assert the existing work order response includes the normalized fields. Add negative tests for another customer's request, invalid service mode, malformed arrays, and missing `type`/`description`.

Use the existing route and identity contract:

```js
await request('/api/workorders', {
  method: 'POST',
  headers: customerCookieAndCsrf,
  body: JSON.stringify({
    type: 'fault',
    description: 'Cut quality changed after a lens replacement.',
    urgency: 'normal',
    category_l1: 'laser_cutting',
    category_l2: 'optical_fault',
    service_mode: 'hybrid',
    intake: { ...structuredIntake, service_request_kind: 'repair' },
  }),
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd worker && node --test tests/service-request-create-api.test.mjs tests/request-auth.test.mjs`

Expected: FAIL because `/api/workorders` ignores the `intake` object and the schema lacks columns before migration setup.

- [ ] **Step 3: Bind structured values in the existing insert**

Keep the current work-order ID, number, status, AI summary, conversation attachment, readiness, dispatch, and notification logic. Extend only the existing `INSERT INTO work_orders` and returned object. Do not create a parallel handler.

The insert must use `SERVICE_REQUEST_VERSION` and the serialized intake values; the original narrative stays in `description` rather than receiving a prefixed brand/model paragraph.

- [ ] **Step 4: Protect contact snapshots**

Return contact fields to the owning customer and authorized Admin only. Preserve existing engineer contact-release gates; do not expose contact values merely because a work order is pending or visible in a team queue.

- [ ] **Step 5: Run focused tests**

Run: `cd worker && node --test tests/service-request-create-api.test.mjs tests/request-auth.test.mjs tests/service-os-auth.test.mjs`

Expected: PASS; all legacy work-order create payloads remain accepted.

- [ ] **Step 6: Commit after authorization**

```bash
git add worker/src/index.js worker/tests/service-request-create-api.test.mjs worker/tests/request-auth.test.mjs
git commit -m "feat: persist structured service request fields"
```

### Task 4: Create the canonical browser draft model

**Files:**
- Create: `frontend/src/components/ServiceRequest/serviceRequestDraft.js`
- Create: `frontend/tests/service-request-draft.test.mjs`

- [ ] **Step 1: Write failing draft tests**

Lock these exports:

```js
createEmptyServiceRequestDraft({ locale, mode, presets })
normalizeServiceRequestDraft(value)
validateServiceRequestStep(draft, step)
loadServiceRequestDraft(storage, market)
saveServiceRequestDraft(storage, market, draft)
clearServiceRequestDraft(storage, market)
toWorkOrderPayload(draft, conversationId)
```

Assert the storage key is market-specific and versioned:

```js
sagemro_service_request_draft:com:v2
sagemro_service_request_draft:cn:v2
```

Assert `toWorkOrderPayload()` creates one `intake` object and never concatenates brand/model/region into `description`.

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/service-request-draft.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure model**

Use this shape:

```js
{
  version: 2,
  mode: 'manual',
  step: 1,
  service_kind: '',
  category_l1: 'other',
  category_l2: 'other',
  device_types: [],
  device_brands: [],
  device_model: '',
  alarm_code: '',
  description: '',
  production_impact: '',
  service_mode: 'remote',
  region: [],
  service_location: { address: '', latitude: null, longitude: null, accuracy_m: null, coordinate_system: 'wgs84', source: 'customer_browser' },
  urgency: 'normal',
  contact: { name: '', email: '', phone: '', whatsapp: '', preference: 'platform' },
  files: [],
}
```

Do not store `File` objects in `sessionStorage`; persist only non-file draft fields and keep selected files in React memory.

`toWorkOrderPayload()` must map `service_kind` through `SERVICE_KIND_TO_WORK_ORDER_TYPE` to preserve the legacy `work_orders.type` contract while also sending the exact six-way `service_request_kind` inside `intake`. Step 4 validation must require `contact.name` plus at least one of `contact.email`, `contact.phone`, or `contact.whatsapp`; it must not require every channel.

- [ ] **Step 4: Run focused tests**

Run: `cd frontend && node --test tests/service-request-draft.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit after authorization**

```bash
git add frontend/src/components/ServiceRequest/serviceRequestDraft.js frontend/tests/service-request-draft.test.mjs
git commit -m "feat: add canonical service request draft"
```

### Task 5: Build one four-step service-request UI

**Files:**
- Create: `frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx`
- Create: `frontend/src/components/ServiceRequest/ServiceRequestPage.jsx`
- Modify: `frontend/src/components/Sidebar/WorkOrderModal.jsx`
- Create: `frontend/tests/service-request-flow-contract.test.mjs`

- [ ] **Step 1: Write the failing UI contract**

Assert `ServiceRequestFlow` owns the fields and four steps; `ServiceRequestPage` and `WorkOrderModal` import that same component. Assert the legacy modal no longer declares a separate `useState({ type: ... })` form.

```js
assert.match(flowSource, /currentStep === 1/);
assert.match(flowSource, /currentStep === 2/);
assert.match(flowSource, /currentStep === 3/);
assert.match(flowSource, /currentStep === 4/);
assert.match(pageSource, /<ServiceRequestFlow/);
assert.match(modalSource, /<ServiceRequestFlow/);
assert.doesNotMatch(modalSource, /const \[form, setForm\]/);
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/service-request-flow-contract.test.mjs`

Expected: FAIL because the shared flow does not exist.

- [ ] **Step 3: Implement the four approved steps**

Render:

1. Service kind: repair, retrofit, relocation, maintenance, used-equipment evaluation, or parts.
2. Equipment and problem.
3. Service mode, region, urgency, and conditional site location.
4. Contact, files, summary, authentication gate, and final confirmation.

Continue reusing `TagInput`, `RegionInput`, existing location search/capture helpers, attachment upload, and feedback utilities.

- [ ] **Step 4: Make the modal a compatibility wrapper**

Keep the exported `WorkOrderModal` API while existing callers are migrated:

```jsx
export function WorkOrderModal({ isOpen, onClose, onSubmit }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.titleDefault} size="lg">
      <ServiceRequestFlow onCancel={onClose} onSubmit={onSubmit} embedded />
    </Modal>
  );
}
```

This is not a second form; it is a temporary presentation wrapper around the sole flow.

- [ ] **Step 5: Run component tests and lint**

Run: `cd frontend && node --test tests/service-request-flow-contract.test.mjs tests/work-order-location-contract.test.mjs && npm run lint`

Expected: PASS; location behavior and existing attachment behavior remain intact.

- [ ] **Step 6: Commit after authorization**

```bash
git add frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx frontend/src/components/ServiceRequest/ServiceRequestPage.jsx frontend/src/components/Sidebar/WorkOrderModal.jsx frontend/tests/service-request-flow-contract.test.mjs
git commit -m "feat: unify service request form flow"
```

### Task 6: Route every service entry to the same page and restore drafts after login

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Sidebar/Sidebar.jsx`
- Modify: `frontend/src/components/common/PublicConversionPanel.jsx`
- Modify: `frontend/tests/service-request-routing.test.mjs`

- [ ] **Step 1: Write failing routing tests**

Assert `/service-request` renders `ServiceRequestPage`, the sidebar button navigates to that route, and public CTAs use only safe query presets: `mode`, `service`, `brand`, and `source`.

Assert login success does not reset the stored draft and final successful work-order creation clears it.

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/service-request-routing.test.mjs`

Expected: FAIL because current entries open a modal and current submission rejects unauthenticated users immediately.

- [ ] **Step 3: Implement route navigation**

Replace `setWorkOrderModalOpen(true)` at user-facing entry points with navigation to `/service-request`. Keep the modal wrapper only for backward compatibility tests until no caller remains.

- [ ] **Step 4: Move authentication to the final step**

When an unauthenticated customer clicks final submit:

1. Save the normalized draft to market-specific `sessionStorage`.
2. Open the existing `LoginModal`.
3. On successful customer authentication, restore the draft and return to step 4.
4. Require a second explicit submit confirmation.
5. Clear the draft only after the work-order API and attachment uploads finish successfully.

- [ ] **Step 5: Run focused tests**

Run: `cd frontend && node --test tests/service-request-routing.test.mjs tests/auth-failure-guard-contract.test.mjs tests/cookie-auth-contract.test.mjs`

Expected: PASS; draft survives authentication and no duplicate work order is submitted.

- [ ] **Step 6: Commit after authorization**

```bash
git add frontend/src/App.jsx frontend/src/components/Sidebar/Sidebar.jsx frontend/src/components/common/PublicConversionPanel.jsx frontend/tests/service-request-routing.test.mjs
git commit -m "feat: route all service requests through one intake"
```

### Task 7: Add bounded AI assistance to the same draft

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/src/lib/serviceRequestIntake.js`
- Create: `worker/tests/service-request-assist-api.test.mjs`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx`
- Create: `frontend/tests/service-request-ai-assist-contract.test.mjs`

- [ ] **Step 1: Write failing Worker tests**

Test `POST /api/service-request-assist` with `market`, `message`, and `draft`. Assert the response contains only:

```js
{
  patch: { /* whitelisted draft fields only */ },
  missing_fields: [],
  next_question: '',
  safety_notice: '',
}
```

Assert rate limiting, maximum message size, malformed provider JSON, and attempted price/diagnosis/engineer fields fail closed.

- [ ] **Step 2: Run and verify failure**

Run: `cd worker && node --test tests/service-request-assist-api.test.mjs`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the bounded endpoint**

Reuse the existing AI provider configuration and timeout handling. Do not enable tools or knowledge writes. The system prompt must require strict JSON, preserve uncertainty, and prohibit final diagnosis, quotation, dispatch, warranty, and unsafe procedural advice.

- [ ] **Step 4: Add the client API and merge behavior**

Add:

```js
export async function assistServiceRequestDraft({ message, draft }) {
  const response = await fetch(`${API_BASE}/api/service-request-assist`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ message, draft }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Service request assistance failed');
  return data;
}
```

Use the existing `API_BASE` constant and the same `authHeaders`/401 handling already used by neighboring functions in `frontend/src/services/api.js`; do not introduce a second fetch abstraction.

In `ServiceRequestFlow`, AI mode applies only the returned `patch`, visibly marks inferred fields, shows `next_question`, and always lets the customer edit before final submission.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd worker && node --test tests/service-request-assist-api.test.mjs tests/diagnostics-boundary.test.mjs
cd ../frontend && node --test tests/service-request-ai-assist-contract.test.mjs tests/service-request-draft.test.mjs
```

Expected: all tests PASS; no AI response can directly create a work order.

- [ ] **Step 6: Commit after authorization**

```bash
git add worker/src/index.js worker/src/lib/serviceRequestIntake.js worker/tests/service-request-assist-api.test.mjs frontend/src/services/api.js frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx frontend/tests/service-request-ai-assist-contract.test.mjs
git commit -m "feat: assist service request completion with AI"
```

### Task 8: Simplify international registration and align password reset

**Files:**
- Modify: `frontend/src/components/Auth/LoginModal.jsx`
- Modify: `frontend/src/services/api.js`
- Modify: `worker/src/index.js`
- Modify: `frontend/tests/auth-failure-guard-contract.test.mjs`
- Create: `frontend/tests/market-registration-contract.test.mjs`
- Modify: `worker/tests/service-os-auth.test.mjs`

- [ ] **Step 1: Write failing market-auth tests**

Lock these rules:

```js
// CN registration
required: ['name', 'company', 'phone', 'password', 'sms_code']
optional: ['email']

// COM registration
required: ['name', 'company', 'email', 'password', 'email_code']
optional: ['phone']
```

Add tests that COM password reset sends and validates an email code, while CN reset retains phone/SMS behavior.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
cd frontend && node --test tests/market-registration-contract.test.mjs
cd ../worker && node --test tests/service-os-auth.test.mjs
```

Expected: FAIL because COM registration still requires phone and password reset is phone-only.

- [ ] **Step 3: Update frontend validation and payloads**

For COM, hide the required marker on phone, accept blank phone, send the email verification code, register with email, and reset by email. For CN, preserve the current SMS path.

- [ ] **Step 4: Update backend registration and reset validation**

Replace the shared required-field condition with explicit market branches. Continue inserting `phone` as nullable for COM and add identity claims only for non-empty values. Use `getRegistrationVerificationTarget()` for both registration and reset.

- [ ] **Step 5: Run focused auth tests**

Run:

```bash
cd worker && node --test tests/service-os-auth.test.mjs tests/account-identity.test.mjs tests/auth.test.mjs
cd ../frontend && node --test tests/market-registration-contract.test.mjs tests/auth-failure-guard-contract.test.mjs
```

Expected: PASS; legacy CN phone login and existing COM email accounts continue to work.

- [ ] **Step 6: Commit after authorization**

```bash
git add frontend/src/components/Auth/LoginModal.jsx frontend/src/services/api.js worker/src/index.js frontend/tests/auth-failure-guard-contract.test.mjs frontend/tests/market-registration-contract.test.mjs worker/tests/service-os-auth.test.mjs
git commit -m "feat: simplify international customer registration"
```

### Task 9: Remove the AI-workspace About modal without deleting the public review page

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Chat/ChatArea.jsx`
- Delete only after explicit confirmation: `frontend/src/components/common/AboutModal.jsx`
- Modify: affected About-modal contract tests.

- [ ] **Step 1: Write/adjust the failing contract**

Assert the AI workspace no longer imports, opens, or renders `AboutModal`, while `/about/technical-review/` remains in `publicSeoRoutes` and `TechnicalReviewPage` remains routed.

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && node --test tests/public-seo-routes.test.mjs tests/brand-assets-contract.test.mjs tests/service-promise-contract.test.mjs`

Expected: FAIL until obsolete About-modal expectations are replaced with public-page expectations.

- [ ] **Step 3: Remove the entry and lazy import**

Remove `aboutModalOpen`, `onOpenAbout`, and the lazy `AboutModal` render from the AI workspace. Preserve legal links, `TechnicalReviewPage`, service promise data used elsewhere, and the technical-review route.

- [ ] **Step 4: Delete the now-unreferenced component only after confirmation**

Before deletion, run `rg -n "AboutModal|onOpenAbout|aboutModalOpen" frontend/src frontend/tests`. Delete the file only when the result contains no runtime references.

- [ ] **Step 5: Run focused tests**

Run: `cd frontend && node --test tests/public-seo-routes.test.mjs tests/brand-assets-contract.test.mjs tests/service-promise-contract.test.mjs`

Expected: PASS; public technical-review credibility content remains available.

- [ ] **Step 6: Commit after authorization**

```bash
git add frontend/src/App.jsx frontend/src/components/Chat/ChatArea.jsx frontend/src/components/common/AboutModal.jsx frontend/tests
git commit -m "refactor: remove workspace about modal"
```

### Task 10: End-to-end service request verification

**Files:**
- Modify: `e2e/tests/service-order-lifecycle.spec.mjs`
- Verify only elsewhere.

- [ ] **Step 1: Add E2E scenarios**

Cover:

1. Unauthenticated CN manual draft → phone registration → draft restored → one work order created.
2. Unauthenticated COM AI-assisted draft → email registration with blank phone → draft restored → customer review → one work order created.
3. Attachment upload after work-order creation.
4. Structured fields visible to customer/Admin but protected from unauthorized engineer access.
5. Existing downstream quote and status flow still opens the same work order.

- [ ] **Step 2: Run focused E2E**

Run: `cd e2e && npx playwright test tests/service-order-lifecycle.spec.mjs`

Expected: all scenarios PASS with no duplicate work-order IDs.

- [ ] **Step 3: Run the complete local gate**

Run:

```bash
cd worker && npm test
cd ../frontend && npm run lint && npm test && npm run build
cd ../admin && npm test && npm run build
cd ../e2e && npm test
```

Expected: every command exits 0.

- [ ] **Step 4: Stop before production migration**

Do not deploy Worker code yet. Back up and apply migration `047` to both COM and CN D1 databases only during the explicitly approved release sequence in `2026-08-31-ai-subdomain-migration-deployment.md`.
