# Engineer Account Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admin approve an engineer cooperation application, atomically open a linked engineer account, send a 48-hour one-time email activation link, and allow the activated engineer to sign in with email or phone.

**Architecture:** Add a shared account-identity registry for cross-role email/phone uniqueness, a focused activation-token module, and dedicated Worker endpoints for open-account, resend, and activate. Keep review and activation states separate in the existing Admin application page, add one focused account setup modal, and add a public activation page on the engineer host. Apply all shared code to both branches, but migrate both production D1 databases before pushing `main`, because only `main` deploys the Worker.

**Tech Stack:** Cloudflare Workers, D1/SQLite, Web Crypto, Cloudflare Email/Resend, React, Vite, Tailwind CSS, Node test runner, GitHub Actions, Aliyun ECS workflow.

---

## File Map

**Create**

- `worker/migrations/037_engineer_account_activation.sql` - additive schema for engineer email, shared identities, and activation records.
- `worker/migrations/data_fixes/account_identity_preflight.sql` - read-only duplicate detection run before production migration.
- `worker/src/lib/accountIdentity.js` - canonical email/phone identity helpers and D1 identity statements.
- `worker/src/lib/engineerActivation.js` - activation token, hash, expiry, URL, and email payload helpers.
- `worker/tests/account-identity.test.mjs` - pure identity normalization tests.
- `worker/tests/engineer-account-activation.test.mjs` - Worker account opening, resend, activation, and login tests.
- `admin/src/components/EngineerAccountSetupModal.jsx` - focused account-opening confirmation UI.
- `admin/src/pages/EngineerApplicationsPage.test.mjs` - application workflow and terminology contracts.
- `frontend/src/components/Engineer/EngineerActivationPage.jsx` - public one-time activation and password setup screen.
- `frontend/tests/engineer-account-activation-contract.test.mjs` - application, activation route, and login contracts.

**Modify**

- `worker/schema.sql` - cumulative schema snapshot.
- `worker/migrations/README.md` - migration catalog.
- `worker/package.json` - include new Worker tests.
- `worker/src/index.js` - required application email, identity claims, Admin endpoints, activation endpoint, login lookup, and deletion cleanup.
- `worker/tests/service-os-auth.test.mjs` - customer identity registry and email/phone login coverage.
- `worker/tests/engineer-application-calendar.test.mjs` - required application email coverage.
- `admin/src/services/api.js` - open-account and resend API clients.
- `admin/src/pages/EngineerApplicationsPage.jsx` - dual states and account actions.
- `admin/src/pages/UsersPage.jsx` - remove unreachable legacy engineer/password form code.
- `admin/src/pages/EngineersPage.jsx` - terminology and optional externally selected engineer profile.
- `admin/src/pages/cn-ui-language-contract.test.mjs` - terminology contract.
- `admin/src/App.jsx` - navigate from application to the linked engineer profile.
- `admin/package.json` - include the new Admin test.
- `frontend/src/services/api.js` - activation API client.
- `frontend/src/components/Engineer/EngineerRecruitingPage.jsx` - required email field.
- `frontend/src/components/Auth/LoginModal.jsx` - email-or-phone login for both markets.
- `frontend/src/App.jsx` - engineer-host `/activate` route.
- `frontend/tests/brand-assets-contract.test.mjs` - updated recruiting form contract.
- `frontend/tests/cn-primary-ui-language-contract.test.mjs` - China form/login contract.
- `TECH-SPEC.md` - activation endpoints and account lifecycle.
- `DEPLOY.md` - both-D1 migration and verification commands.

**Optional workflow hardening, requiring explicit user confirmation before editing**

- `.github/workflows/deploy.yml` - make the Worker gate check migration `037` in both `sagemro-db` and `sagemro-db-cn`.

---

### Task 1: Add Identity And Activation Schema

**Files:**
- Create: `worker/migrations/037_engineer_account_activation.sql`
- Create: `worker/migrations/data_fixes/account_identity_preflight.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/migrations/README.md`

- [ ] **Step 1: Write the migration contract test**

Add a test to `worker/tests/engineer-account-activation.test.mjs` that reads the migration and asserts the required schema:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

test('activation migration adds engineer email, shared identities, and activation records', () => {
  const sql = readFileSync(
    path.join(root, 'worker/migrations/037_engineer_account_activation.sql'),
    'utf8',
  );

  assert.match(sql, /ALTER TABLE engineers ADD COLUMN email TEXT/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_normalized_unique/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS account_identities/);
  assert.match(sql, /UNIQUE\s*\(identity_type, normalized_value\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS engineer_account_activations/);
  assert.match(sql, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(sql, /expires_at TEXT NOT NULL/);
  assert.match(sql, /037_engineer_account_activation/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd worker
node --test tests/engineer-account-activation.test.mjs
```

Expected: FAIL because `037_engineer_account_activation.sql` does not exist.

- [ ] **Step 3: Create the additive migration**

Create `worker/migrations/037_engineer_account_activation.sql`:

```sql
ALTER TABLE engineers ADD COLUMN email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_engineers_email_normalized
  ON engineers(lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_normalized_unique
  ON customers(lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

CREATE TABLE IF NOT EXISTS account_identities (
  identity_type TEXT NOT NULL CHECK(identity_type IN ('email', 'phone')),
  normalized_value TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK(owner_type IN ('customer', 'engineer')),
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (identity_type, normalized_value),
  UNIQUE (owner_type, owner_id, identity_type)
);

CREATE INDEX IF NOT EXISTS idx_account_identities_owner
  ON account_identities(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS engineer_account_activations (
  id TEXT PRIMARY KEY,
  engineer_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  created_by TEXT,
  sent_at TEXT,
  send_status TEXT NOT NULL DEFAULT 'pending',
  send_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

CREATE INDEX IF NOT EXISTS idx_engineer_activations_engineer
  ON engineer_account_activations(engineer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engineer_activations_active
  ON engineer_account_activations(engineer_id, used_at, revoked_at, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_engineer_activations_one_open
  ON engineer_account_activations(engineer_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_engineer_applications_converted_user
  ON engineer_applications(converted_user_id);

INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
SELECT 'email', lower(trim(email)), 'customer', id
FROM customers
WHERE email IS NOT NULL AND trim(email) <> '';

INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
SELECT 'phone', replace(replace(replace(replace(replace(trim(phone), ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), 'customer', id
FROM customers
WHERE phone IS NOT NULL AND trim(phone) <> '';

INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
SELECT 'phone', replace(replace(replace(replace(replace(trim(phone), ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), 'engineer', id
FROM engineers
WHERE phone IS NOT NULL AND trim(phone) <> '';

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('037_engineer_account_activation', 'Engineer email activation and cross-role identity registry');
```

Do not backfill engineer email because historical engineer rows do not have one.

- [ ] **Step 4: Add the read-only production preflight**

Create `worker/migrations/data_fixes/account_identity_preflight.sql` with queries that must all return zero rows:

```sql
SELECT lower(trim(email)) AS normalized_email, COUNT(*) AS account_count
FROM customers
WHERE email IS NOT NULL AND trim(email) <> ''
GROUP BY normalized_email
HAVING COUNT(*) > 1;

SELECT normalized_phone, COUNT(*) AS account_count
FROM (
  SELECT replace(replace(replace(replace(replace(trim(phone), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') AS normalized_phone
  FROM customers WHERE phone IS NOT NULL AND trim(phone) <> ''
  UNION ALL
  SELECT replace(replace(replace(replace(replace(trim(phone), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') AS normalized_phone
  FROM engineers WHERE phone IS NOT NULL AND trim(phone) <> ''
)
GROUP BY normalized_phone
HAVING COUNT(*) > 1;
```

- [ ] **Step 5: Update the cumulative schema and migration catalog**

Add `engineers.email`, both new tables, all indexes, and migration version `037` to `worker/schema.sql`. Add `037_engineer_account_activation.sql` to `worker/migrations/README.md`.

- [ ] **Step 6: Run the migration contract test**

Run:

```bash
cd worker
node --test tests/engineer-account-activation.test.mjs
```

Expected: PASS for the schema contract.

- [ ] **Step 7: Commit**

```bash
git add worker/migrations/037_engineer_account_activation.sql \
  worker/migrations/data_fixes/account_identity_preflight.sql \
  worker/schema.sql worker/migrations/README.md \
  worker/tests/engineer-account-activation.test.mjs
git commit -m "feat(worker): add engineer activation schema"
```

---

### Task 2: Add Shared Identity Helpers And Cover Existing Account Paths

**Files:**
- Create: `worker/src/lib/accountIdentity.js`
- Create: `worker/tests/account-identity.test.mjs`
- Modify: `worker/src/index.js`
- Modify: `worker/tests/service-os-auth.test.mjs`
- Modify: `worker/scripts/material-items-production-smoke.mjs`
- Modify: `worker/scripts/material-requests-production-smoke.mjs`
- Modify: `worker/tests/material-items-production-smoke-script.test.mjs`
- Modify: `worker/tests/material-requests-production-smoke-script.test.mjs`
- Modify: `worker/package.json`

- [ ] **Step 1: Write failing normalization tests**

Create `worker/tests/account-identity.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  identityClaimsForAccount,
  normalizeIdentityEmail,
  normalizeIdentityPhone,
} from '../src/lib/accountIdentity.js';

test('identity normalization is stable across case and phone punctuation', () => {
  assert.equal(normalizeIdentityEmail(' Tom.Lee@Example.COM '), 'tom.lee@example.com');
  assert.equal(normalizeIdentityPhone(' +52 (5572) 080-065 '), '+525572080065');
});

test('identity claims omit empty values and preserve owner metadata', () => {
  assert.deepEqual(identityClaimsForAccount({
    ownerType: 'engineer',
    ownerId: 'eng-1',
    email: 'tom@example.com',
    phone: '+52 5572 080065',
  }), [
    { identityType: 'email', normalizedValue: 'tom@example.com', ownerType: 'engineer', ownerId: 'eng-1' },
    { identityType: 'phone', normalizedValue: '+525572080065', ownerType: 'engineer', ownerId: 'eng-1' },
  ]);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
cd worker
node --test tests/account-identity.test.mjs
```

Expected: FAIL because `accountIdentity.js` does not exist.

- [ ] **Step 3: Implement the focused helper module**

Create `worker/src/lib/accountIdentity.js`:

```js
export function normalizeIdentityEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeIdentityPhone(value) {
  return String(value || '').trim().replace(/[\s().-]/g, '');
}

export function identityClaimsForAccount({ ownerType, ownerId, email, phone }) {
  const claims = [];
  const normalizedEmail = normalizeIdentityEmail(email);
  const normalizedPhone = normalizeIdentityPhone(phone);
  if (normalizedEmail) claims.push({ identityType: 'email', normalizedValue: normalizedEmail, ownerType, ownerId });
  if (normalizedPhone) claims.push({ identityType: 'phone', normalizedValue: normalizedPhone, ownerType, ownerId });
  return claims;
}

export function identityInsertStatements(env, account) {
  return identityClaimsForAccount(account).map((claim) => env.DB.prepare(`
    INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
    VALUES (?, ?, ?, ?)
  `).bind(claim.identityType, claim.normalizedValue, claim.ownerType, claim.ownerId));
}

export function identityDeleteStatement(env, ownerType, ownerId) {
  return env.DB.prepare(
    'DELETE FROM account_identities WHERE owner_type = ? AND owner_id = ?'
  ).bind(ownerType, ownerId);
}
```

- [ ] **Step 4: Make existing creation and deletion paths atomic**

In `worker/src/index.js`:

- Import the identity helpers.
- Change customer registration and Admin customer creation to use `env.DB.batch([accountInsert, ...identityInsertStatements(...)])`.
- Before each create, query `account_identities` for normalized email/phone and return a localized field-specific 409 conflict.
- Keep direct `customers` and `engineers` conflict checks as well. The registry locks concurrent new writes; direct checks cover accounts created by the old Worker during the migration-to-deploy window.
- Add `identityDeleteStatement(...)` before deleting customer or engineer rows in `handleAdminDeleteUser`.
- Delete an engineer in this exact batch order: clear `engineer_applications.converted_user_id`, delete `engineer_account_activations`, release `account_identities`, then delete the engineer row.
- Replace the `userType === 'engineer'` branch of `handleAdminCreateUser` with HTTP 410 and localized guidance to open the account from an approved application.
- Update production smoke cleanup SQL to delete `account_identities` rows for the temporary customer/engineer before deleting those accounts; extend script contract tests to require that order.
- Preserve all current account response shapes.

Use this conflict query shape:

```js
const identityConflict = await env.DB.prepare(`
  SELECT identity_type, owner_type, owner_id
  FROM account_identities
  WHERE (identity_type = 'email' AND normalized_value = ?)
     OR (identity_type = 'phone' AND normalized_value = ?)
  LIMIT 1
`).bind(normalizedEmail, normalizedPhone).first();
```

- [ ] **Step 5: Add Worker integration tests**

Extend `worker/tests/service-os-auth.test.mjs` to assert:

```js
assert.equal(env.__dbState.identities.some((row) => (
  row.identity_type === 'email' && row.normalized_value === 'joe@example.com'
)), true);
assert.equal(env.__dbState.identities.some((row) => (
  row.identity_type === 'phone' && row.normalized_value === '+66961135966'
)), true);
```

Add a duplicate test where an engineer identity already owns the email and customer registration returns 409 without inserting a customer.

- [ ] **Step 6: Add the new test file to package scripts and run focused tests**

Update both `test` and `test:unit` in `worker/package.json` to include `tests/account-identity.test.mjs` and `tests/engineer-account-activation.test.mjs`.

Run:

```bash
cd worker
node --test tests/account-identity.test.mjs tests/service-os-auth.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/src/lib/accountIdentity.js worker/src/index.js \
  worker/tests/account-identity.test.mjs worker/tests/service-os-auth.test.mjs \
  worker/scripts/material-items-production-smoke.mjs \
  worker/scripts/material-requests-production-smoke.mjs \
  worker/tests/material-items-production-smoke-script.test.mjs \
  worker/tests/material-requests-production-smoke-script.test.mjs worker/package.json
git commit -m "feat(worker): enforce cross-role account identities"
```

---

### Task 3: Require Email On Engineer Applications

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/tests/engineer-application-calendar.test.mjs`
- Modify: `frontend/src/components/Engineer/EngineerRecruitingPage.jsx`
- Modify: `frontend/tests/brand-assets-contract.test.mjs`
- Modify: `frontend/tests/cn-primary-ui-language-contract.test.mjs`

- [ ] **Step 1: Write failing Worker and frontend tests**

Add to `worker/tests/engineer-application-calendar.test.mjs`:

```js
test('public engineer application requires a valid email', async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request('https://api.sagemro.cn/api/engineer-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://engineer.sagemro.cn' },
    body: JSON.stringify({ name: '测试工程师', phone: '13800000000', email: 'invalid' }),
  }), env, { waitUntil() {} });

  assert.equal(response.status, 400);
  assert.equal(env.__calls.some((sql) => sql.includes('INSERT INTO engineer_applications')), false);
});
```

Add frontend contract assertions:

```js
assert.match(recruiting, /email: '请输入常用邮箱'/);
assert.match(recruiting, /email: 'Enter your primary email address'/);
assert.match(recruiting, /type=\{field === 'email' \? 'email' : 'text'\}/);
assert.match(recruiting, /field === 'name' \|\| field === 'phone' \|\| field === 'email'/);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
cd worker && node --test tests/engineer-application-calendar.test.mjs
cd ../frontend && node --test tests/brand-assets-contract.test.mjs tests/cn-primary-ui-language-contract.test.mjs
```

Expected: FAIL because email remains optional and the Worker accepts invalid email.

- [ ] **Step 3: Implement minimal validation**

In `handleSubmitEngineerApplication`:

```js
const email = normalizeEmail(cleanText(body.email, 120));
if (!name || !phone || !email) {
  return errorResponse(getRequestMarket(request) === 'cn'
    ? '姓名、联系电话和邮箱为必填项'
    : 'Name, phone, and email are required.');
}
if (!isValidEmail(email)) return localizedErrorResponse('invalid_email', request);
```

In `EngineerRecruitingPage.jsx`:

- Change both email placeholders from optional copy to the approved primary-email copy.
- Render email inputs with `type="email"`.
- Mark name, phone, and email as required and show the existing required label for all three.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same focused commands. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.js worker/tests/engineer-application-calendar.test.mjs \
  frontend/src/components/Engineer/EngineerRecruitingPage.jsx \
  frontend/tests/brand-assets-contract.test.mjs \
  frontend/tests/cn-primary-ui-language-contract.test.mjs
git commit -m "feat(engineer): require application email"
```

---

### Task 4: Add Activation Token And Email Primitives

**Files:**
- Create: `worker/src/lib/engineerActivation.js`
- Modify: `worker/tests/engineer-account-activation.test.mjs`
- Modify: `worker/src/index.js`

- [ ] **Step 1: Write failing pure-function tests**

Add tests:

```js
import {
  buildEngineerActivationEmail,
  buildEngineerActivationUrl,
  createEngineerActivationToken,
  hashEngineerActivationToken,
} from '../src/lib/engineerActivation.js';

test('activation token is random, hashed, and placed in the URL fragment', async () => {
  const first = createEngineerActivationToken();
  const second = createEngineerActivationToken();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.match(await hashEngineerActivationToken(first), /^[a-f0-9]{64}$/);
  assert.equal(
    buildEngineerActivationUrl('cn', first),
    `https://engineer.sagemro.cn/activate#token=${first}`,
  );
});

test('activation email contains no password and explains the 48-hour expiry', () => {
  const email = buildEngineerActivationEmail({
    market: 'com', name: 'Tom Lee', engineerNo: 'E000128', activationUrl: 'https://example.test/#token=x',
  });
  assert.match(email.subject, /Activate your SAGEMRO engineer account/);
  assert.match(email.text, /48 hours/);
  assert.match(email.html, /<a[^>]+href="https:\/\/example\.test\/#token=x"/);
  assert.doesNotMatch(email.text, /password:/i);
});

test('activation email escapes applicant-controlled HTML', () => {
  const email = buildEngineerActivationEmail({
    market: 'com', name: '<img src=x onerror=alert(1)>', engineerNo: 'E000128', activationUrl: 'https://example.test/#token=x',
  });
  assert.doesNotMatch(email.html, /<img/);
  assert.match(email.html, /&lt;img/);
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
cd worker
node --test tests/engineer-account-activation.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure module**

Create `worker/src/lib/engineerActivation.js` with Web Crypto helpers:

```js
function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createEngineerActivationToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function hashEngineerActivationToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function activationExpiresAt(now = Date.now()) {
  return new Date(now + 48 * 60 * 60 * 1000).toISOString();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function buildEngineerActivationUrl(market, token) {
  const host = market === 'cn' ? 'https://engineer.sagemro.cn' : 'https://engineer.sagemro.com';
  return `${host}/activate#token=${encodeURIComponent(token)}`;
}

export function buildEngineerActivationEmail({ market, name, engineerNo, activationUrl }) {
  const safeName = escapeHtml(name);
  const safeEngineerNo = escapeHtml(engineerNo);
  const safeActivationUrl = escapeHtml(activationUrl);
  if (market === 'cn') {
    return {
      subject: '激活你的 SAGEMRO 工程师账号',
      text: `${name}，你的工程师编号是 ${engineerNo}。请在 48 小时内打开以下链接设置密码：\n${activationUrl}\n如非本人申请，请忽略本邮件。`,
      html: `<p>${safeName}，你的工程师编号是 <strong>${safeEngineerNo}</strong>。</p><p><a href="${safeActivationUrl}">激活工程师账号</a></p><p>链接将在 48 小时后失效。如非本人申请，请忽略本邮件。</p>`,
    };
  }
  return {
    subject: 'Activate your SAGEMRO engineer account',
    text: `${name}, your engineer number is ${engineerNo}. Set your password within 48 hours:\n${activationUrl}\nIgnore this email if you did not apply.`,
    html: `<p>${safeName}, your engineer number is <strong>${safeEngineerNo}</strong>.</p><p><a href="${safeActivationUrl}">Activate engineer account</a></p><p>This link expires in 48 hours. Ignore this email if you did not apply.</p>`,
  };
}
```

- [ ] **Step 4: Add an activation-specific sender in `worker/src/index.js`**

Reuse the existing `env.EMAIL.send` then Resend fallback order. The function accepts `{ to, subject, text, html }`, uses `VERIFICATION_EMAIL_FROM`, and returns `{ sent: true }` or `{ error }`. Do not log the URL or message body; log only provider error and email suffix.

- [ ] **Step 5: Run tests and commit**

```bash
cd worker
node --test tests/engineer-account-activation.test.mjs
git add src/lib/engineerActivation.js src/index.js tests/engineer-account-activation.test.mjs
git commit -m "feat(worker): add engineer activation primitives"
```

Expected: PASS.

---

### Task 5: Implement Admin Open-Account And Resend Endpoints

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/tests/engineer-account-activation.test.mjs`

- [ ] **Step 1: Write failing endpoint tests**

Add these named tests to `worker/tests/engineer-account-activation.test.mjs`:

```js
test('admin authentication is required to open an engineer account', async () => {
  const response = await worker.fetch(new Request(
    'https://api.sagemro.com/api/admin/engineer-applications/app-1/open-account',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  ), makeActivationEnv(), { waitUntil() {} });
  assert.equal(response.status, 401);
});

test('approved application opens and links one pending engineer account atomically', async () => {
  const env = makeActivationEnv({ applicationStatus: 'qualified' });
  const response = await worker.fetch(await adminActivationRequest('app-1/open-account', {
    services: ['maintenance'], engineer_role: 'engineer',
  }), env, { waitUntil() {} });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.account.activation_status, 'awaiting_activation');
  assert.equal(env.__batches.length, 1);
  assert.match(env.__batchSql(), /INSERT INTO engineers/);
  assert.match(env.__batchSql(), /INSERT INTO engineer_account_activations/);
  assert.match(env.__batchSql(), /UPDATE engineer_applications/);
  assert.match(env.__batchSql(), /INSERT INTO audit_logs/);
});

test('open-account retry returns the existing linked engineer', async () => {
  const env = makeActivationEnv({ convertedUserId: 'eng-1' });
  const response = await worker.fetch(await adminActivationRequest('app-1/open-account', {}), env, { waitUntil() {} });
  const body = await response.json();
  assert.equal(body.account.engineer_id, 'eng-1');
  assert.equal(env.__batches.length, 0);
});

test('cross-role email or phone conflict prevents account creation', async () => {
  const env = makeActivationEnv({ identityConflict: { identity_type: 'email', owner_type: 'customer' } });
  const response = await worker.fetch(await adminActivationRequest('app-1/open-account', {}), env, { waitUntil() {} });
  assert.equal(response.status, 409);
  assert.equal(env.__batches.length, 0);
});

test('email failure preserves the linked pending account for resend', async () => {
  const env = makeActivationEnv({ emailError: 'provider unavailable' });
  const response = await worker.fetch(await adminActivationRequest('app-1/open-account', {}), env, { waitUntil() {} });
  const body = await response.json();
  assert.equal(body.account.email_sent, false);
  assert.equal(body.account.activation_status, 'awaiting_activation');
  assert.equal(env.__batches.length, 1);
});

test('resend revokes the previous token and creates one replacement', async () => {
  const env = makeActivationEnv({ convertedUserId: 'eng-1', authStatus: 'pending_activation' });
  const response = await worker.fetch(await adminActivationRequest('app-1/resend-activation', {}), env, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.match(env.__batchSql(), /SET revoked_at = datetime\('now'\)/);
  assert.match(env.__batchSql(), /INSERT INTO engineer_account_activations/);
});
```

Implement `makeActivationEnv`, `adminActivationRequest`, and `__batchSql` in the test file as a small in-memory D1 mock that records `prepare`, `batch`, KV rate-limit calls, and email payloads. Add separate tests for rejected/archived state and application-field mapping to engineer values.

Use this response contract:

```js
assert.deepEqual(body.account, {
  engineer_id: 'eng-1',
  engineer_no: 'E000128',
  activation_status: 'awaiting_activation',
  email_sent: true,
  expires_at: '2026-07-23T12:00:00.000Z',
});
```

- [ ] **Step 2: Run and verify RED**

```bash
cd worker
node --test tests/engineer-account-activation.test.mjs
```

Expected: endpoint tests return 404.

- [ ] **Step 3: Add atomic audit statement support**

Refactor `writeAuditLog` so it uses a new `buildAuditLogStatement(env, request, data)` helper. Existing callers continue calling `writeAuditLog`, while the account-opening batch adds returned audit statements directly.

- [ ] **Step 4: Implement account-state projection for application lists**

Update `handleAdminEngineerApplications` to join `engineers` and the latest activation row. Normalize each item to include:

Use this join so revoked rows cannot hide the current activation:

```sql
LEFT JOIN engineers e ON e.id = a.converted_user_id
LEFT JOIN engineer_account_activations activation
  ON activation.id = (
    SELECT candidate.id
    FROM engineer_account_activations candidate
    WHERE candidate.engineer_id = e.id
      AND candidate.revoked_at IS NULL
    ORDER BY candidate.created_at DESC
    LIMIT 1
  )
```

```js
account: {
  engineer_id: row.converted_user_id || null,
  engineer_no: row.engineer_no || null,
  activation_status: row.engineer_auth_status === 'authenticated'
    ? 'activated'
    : row.converted_user_id && !row.activation_revoked_at && row.activation_expires_at && new Date(row.activation_expires_at) > new Date()
      ? 'awaiting_activation'
      : row.converted_user_id
        ? 'activation_expired'
        : 'not_opened',
  sent_at: row.activation_sent_at || null,
  expires_at: row.activation_expires_at || null,
  send_status: row.activation_send_status || null,
}
```

- [ ] **Step 5: Implement account opening**

Add:

```text
POST /api/admin/engineer-applications/:applicationId/open-account
```

Validate and clean `name`, `email`, `phone`, `services`, `engineer_role`, `regional_lead_id`, `responsible_region`, `team_name`, `certification_status`, `cooperation_status`, and `workload_status`. Use the application lists as defaults. Generate an unusable random password secret, hash it with the existing PBKDF2 helper, and insert `auth_status = 'pending_activation'`.

Batch these statements in order:

1. Email identity claim.
2. Phone identity claim.
3. Engineer insert.
4. Activation insert.
5. Application update to `qualified` with `converted_user_id`.
6. Engineer account creation audit.
7. Application linkage audit.

After the batch, send the email without writing the raw token. On success set `sent_at = datetime('now')`, `send_status = 'sent'`, and clear `send_error`; on failure keep `sent_at` null, set `send_status = 'failed'`, and store only a sanitized provider error. Return `email_sent` from that persisted result.

- [ ] **Step 6: Implement resend**

Add:

```text
POST /api/admin/engineer-applications/:applicationId/resend-activation
```

Use KV keys `engineer_activation_resend_${engineerId}` with a 60-second TTL. Reject authenticated accounts, set `revoked_at` on prior unused tokens, insert a new token, send, and apply the same `sent`/`failed` status updates as account opening before returning updated account metadata.

- [ ] **Step 7: Register exact routes before the generic application PATCH route**

```js
if (path.match(/^\/api\/admin\/engineer-applications\/[^/]+\/open-account$/) && request.method === 'POST') {
  return handleAdminOpenEngineerAccount(request, env);
}
if (path.match(/^\/api\/admin\/engineer-applications\/[^/]+\/resend-activation$/) && request.method === 'POST') {
  return handleAdminResendEngineerActivation(request, env);
}
```

- [ ] **Step 8: Run focused Worker tests and commit**

```bash
cd worker
node --test tests/engineer-account-activation.test.mjs tests/engineer-application-calendar.test.mjs
git add src/index.js tests/engineer-account-activation.test.mjs
git commit -m "feat(worker): open engineer accounts from applications"
```

Expected: PASS.

---

### Task 6: Implement Public Activation And Engineer Email Login

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/tests/engineer-account-activation.test.mjs`
- Modify: `worker/tests/service-os-auth.test.mjs`

- [ ] **Step 1: Write failing activation and login tests**

Add these named tests:

```js
test('valid activation sets password and consumes the token atomically', async () => {
  const env = makeActivationEnv({ validToken: true, authStatus: 'pending_activation' });
  const response = await postActivation(env, { token: 'valid-token', password: 'secret12345' });
  assert.equal(response.status, 200);
  assert.match(env.__batchSql(), /auth_status = 'authenticated'/);
  assert.match(env.__batchSql(), /first_login_password_reset_required = 0/);
  assert.match(env.__batchSql(), /SET used_at = datetime\('now'\)/);
});

for (const state of ['expired', 'used', 'revoked', 'unknown']) {
  test(`${state} activation token returns the same safe error`, async () => {
    const response = await postActivation(makeActivationEnv({ tokenState: state }), {
      token: 'invalid-token', password: 'secret12345',
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /expired|invalid|已失效|无效/i);
  });
}

test('activation rejects a password shorter than ten characters', async () => {
  const response = await postActivation(makeActivationEnv({ validToken: true }), {
    token: 'valid-token', password: 'short',
  });
  assert.equal(response.status, 400);
});

test('pending engineer cannot sign in with phone or email', async () => {
  const env = makeLoginEnv({ authStatus: 'pending_activation', email: 'tom@example.com' });
  for (const body of [
    { phone: '+525572080065', password: 'secret12345' },
    { email: 'TOM@example.com', password: 'secret12345' },
  ]) {
    const result = await postJson('https://api.sagemro.com/api/auth/login', body, env);
    assert.equal(result.response.status, 403);
  }
});

test('activation attempts are rate limited without exposing token validity', async () => {
  const env = makeActivationEnv({ activationAttemptCount: 10 });
  const response = await postActivation(env, { token: 'unknown-token', password: 'secret12345' });
  assert.equal(response.status, 429);
});

test('activated engineer signs in with normalized email and phone', async () => {
  const env = makeLoginEnv({ authStatus: 'authenticated', email: 'tom@example.com' });
  assert.equal((await postJson('https://api.sagemro.com/api/auth/login', {
    email: ' TOM@EXAMPLE.COM ', password: 'secret12345',
  }, env)).response.status, 200);
  assert.equal((await postJson('https://api.sagemro.com/api/auth/login', {
    phone: '+525572080065', password: 'secret12345',
  }, env)).response.status, 200);
});

test('legacy engineer auth status keeps current login behavior', async () => {
  const result = await postJson('https://api.sagemro.com/api/auth/login', {
    phone: '13800000000', password: 'secret12345',
  }, makeLoginEnv({ authStatus: 'pending' }));
  assert.equal(result.response.status, 200);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
cd worker
node --test tests/engineer-account-activation.test.mjs tests/service-os-auth.test.mjs
```

Expected: activation route is 404 and engineer email login fails.

- [ ] **Step 3: Implement the public activation endpoint**

Add before the protected-route guard:

```text
POST /api/auth/engineer/activate
Body: { token, password }
```

Hash the token, load an unused, unrevoked, non-expired activation joined to its engineer, validate the password, then batch:

Before querying D1, load and increment counters for both request IP and token hash in KV, storing each counter with a 15-minute TTL. Reject when either counter exceeds the configured attempt limit and return the same generic 429 message regardless of whether the token exists.

```sql
UPDATE engineers
SET password_hash = ?, salt = ?, auth_status = 'authenticated',
    first_login_password_reset_required = 0
WHERE id = ? AND auth_status = 'pending_activation';

UPDATE engineer_account_activations
SET used_at = datetime('now'), updated_at = datetime('now')
WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL;
```

Add an activation completion audit statement to the same batch.

- [ ] **Step 4: Update login lookup and state guard**

When the credential is an email, query customers first, then engineers by `lower(email)`. When it is a phone, preserve customer-first lookup then engineer lookup. Before password verification:

```js
if (userType === 'engineer' && user.auth_status === 'pending_activation') {
  return errorResponse(
    getRequestMarket(request) === 'cn'
      ? '账号尚未激活，请先使用激活邮件设置密码'
      : 'This engineer account is awaiting activation. Use the activation email to set a password.',
    403,
  );
}
```

- [ ] **Step 5: Run focused tests and commit**

```bash
cd worker
node --test tests/engineer-account-activation.test.mjs tests/service-os-auth.test.mjs
git add src/index.js tests/engineer-account-activation.test.mjs tests/service-os-auth.test.mjs
git commit -m "feat(auth): activate engineer accounts by email"
```

Expected: PASS.

---

### Task 7: Build The Admin Review And Account-Opening Workflow

**Files:**
- Create: `admin/src/components/EngineerAccountSetupModal.jsx`
- Create: `admin/src/pages/EngineerApplicationsPage.test.mjs`
- Modify: `admin/src/pages/EngineerApplicationsPage.jsx`
- Modify: `admin/src/pages/UsersPage.jsx`
- Modify: `admin/src/services/api.js`
- Modify: `admin/src/App.jsx`
- Modify: `admin/src/pages/EngineersPage.jsx`
- Modify: `admin/package.json`

- [ ] **Step 1: Write failing Admin contracts**

Assert:

```js
assert.match(applications, /工程师合作申请/);
assert.match(applications, /SAGEMRO 工程师服务协作网络/);
assert.match(applications, /审核与账号开通/);
assert.match(applications, /开通工程师账号/);
assert.match(applications, /重新发送激活邮件/);
assert.match(applications, /查看工程师档案/);
assert.doesNotMatch(applications, /认证服务代表|创建账号后的工程师 ID|converted_user_id.*<input/);
assert.match(api, /open-account/);
assert.match(api, /resend-activation/);
assert.match(modal, /确认开通并发送激活邮件/);
assert.doesNotMatch(modal, /type="password"/);
assert.doesNotMatch(users, /addType === 'engineer'|engineerRole|specialtiesLabel|servicesLabel/);
```

- [ ] **Step 2: Run and verify RED**

```bash
cd admin
node --test src/pages/EngineerApplicationsPage.test.mjs
```

Expected: FAIL because the modal and actions do not exist.

- [ ] **Step 3: Add API clients**

In `admin/src/services/api.js`:

```js
export function openAdminEngineerAccount(applicationId, data) {
  return request(`/api/admin/engineer-applications/${applicationId}/open-account`, {
    method: 'POST', body: JSON.stringify(data),
  });
}

export function resendAdminEngineerActivation(applicationId) {
  return request(`/api/admin/engineer-applications/${applicationId}/resend-activation`, {
    method: 'POST', body: JSON.stringify({}),
  });
}
```

- [ ] **Step 4: Build `EngineerAccountSetupModal`**

Props:

```js
export function EngineerAccountSetupModal({
  application,
  locale,
  regionalLeads,
  submitting,
  error,
  onClose,
  onSubmit,
})
```

Prefill name, email, phone, service regions, skill tags, and experience. Require at least one service item. Include account type, regional lead, responsible region, team, certification, cooperation, and workload controls. Never render a password input.

- [ ] **Step 5: Replace the manual application card workflow**

In `EngineerApplicationsPage.jsx`:

- Remove `converted` from selectable review statuses while mapping legacy `converted` to approved.
- Remove the manual engineer ID input.
- Render separate review and account badges.
- Show actions based on `application.account.activation_status`.
- Load regional leads with `getAdminUsers('engineer', 1, 100, { role: 'regional_lead' })` when opening the modal.
- Refresh the card after open-account or resend.
- Report email send failure without losing the linked account state.

In the Worker review PATCH handler, remove `converted` from the writable status set. Continue accepting existing rows with `converted` when reading, but reject new PATCH requests that try to write it.

Remove the unreachable engineer-specific state, copy, device/service option arrays, and JSX branches from `UsersPage.jsx`; it remains a customer-only page.

- [ ] **Step 6: Support “View engineer profile” navigation**

In `admin/src/App.jsx`, hold `selectedEngineerId`, pass `onOpenEngineer` into `EngineerApplicationsPage`, switch to `engineers`, and pass `initialEngineerId` into `EngineersPage`. In `EngineersPage`, load and open that engineer once, then clear the pending ID through `onEngineerOpened`.

- [ ] **Step 7: Add the test file to `admin/package.json` and run**

```bash
cd admin
npm test
npm run build
```

Expected: all Admin tests PASS and the production build succeeds.

- [ ] **Step 8: Commit**

```bash
git add admin/src/components/EngineerAccountSetupModal.jsx \
  admin/src/pages/EngineerApplicationsPage.jsx \
  admin/src/pages/EngineerApplicationsPage.test.mjs \
  admin/src/pages/EngineersPage.jsx admin/src/pages/UsersPage.jsx \
  admin/src/services/api.js admin/src/App.jsx admin/package.json
git commit -m "feat(admin): open engineer accounts from applications"
```

---

### Task 8: Add The Engineer Activation Page And Email-Or-Phone Login

**Files:**
- Create: `frontend/src/components/Engineer/EngineerActivationPage.jsx`
- Create: `frontend/tests/engineer-account-activation-contract.test.mjs`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Auth/LoginModal.jsx`

- [ ] **Step 1: Write failing frontend contracts**

Assert:

```js
assert.match(app, /currentPath === '\/activate'/);
assert.match(app, /<EngineerActivationPage/);
assert.match(activationPage, /window\.location\.hash/);
assert.match(activationPage, /window\.history\.replaceState/);
assert.match(activationPage, /至少 10 位|at least 10 characters/);
assert.match(api, /\/api\/auth\/engineer\/activate/);
assert.match(login, /accountLabel: '邮箱或手机号'/);
assert.match(login, /accountLabel: 'Email or phone'/);
```

- [ ] **Step 2: Run and verify RED**

```bash
cd frontend
node --test tests/engineer-account-activation-contract.test.mjs
```

Expected: FAIL because the page and route do not exist.

- [ ] **Step 3: Add the API client**

```js
export async function activateEngineerAccount({ token, password }) {
  const response = await fetch(`${API_BASE}/api/auth/engineer/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
```

- [ ] **Step 4: Build the activation screen**

On first render:

```js
const params = new URLSearchParams(window.location.hash.slice(1));
const token = params.get('token') || '';
window.history.replaceState({}, '', '/activate');
```

Keep the token only in component state. Render invalid-link, form, submitting, success, and error states. Require matching passwords of at least 10 characters. After success, show one `登录工程师工作台` / `Sign in to Engineer Workspace` button that opens the existing login modal.

- [ ] **Step 5: Route engineer-host activation before recruiting/workspace rendering**

In `App.jsx`, when `isEngineerHost && currentPath === '/activate'`, render `EngineerActivationPage` plus `LoginModal`. Do this before `showEngineerWorkspace` and the generic engineer recruiting branch.

- [ ] **Step 6: Make both locales accept email or phone**

Use `loginAccount` for CN and EN login, set CN copy to `邮箱或手机号`, and dispatch to `login({ email })` when the credential contains `@`, otherwise `login({ phone })`. Do not change customer registration verification behavior.

- [ ] **Step 7: Run frontend verification and commit**

```bash
cd frontend
npm run lint
npm test
npm run build
git add src/components/Engineer/EngineerActivationPage.jsx src/App.jsx src/services/api.js \
  src/components/Auth/LoginModal.jsx tests/engineer-account-activation-contract.test.mjs
git commit -m "feat(frontend): add engineer email activation"
```

Expected: lint, all tests, and build PASS.

---

### Task 9: Finish Terminology, Documentation, And Full Test Gate

**Files:**
- Modify: `admin/src/pages/EngineerApplicationsPage.jsx`
- Modify: `admin/src/pages/EngineersPage.jsx`
- Modify: `admin/src/pages/cn-ui-language-contract.test.mjs`
- Modify: `frontend/tests/cn-primary-ui-language-contract.test.mjs`
- Modify: `TECH-SPEC.md`
- Modify: `DEPLOY.md`

- [ ] **Step 1: Add failing terminology assertions**

Extend `admin/src/pages/cn-ui-language-contract.test.mjs`:

```js
test('CN engineer Admin terminology is consistent', () => {
  const applications = read('admin/src/pages/EngineerApplicationsPage.jsx');
  const engineers = read('admin/src/pages/EngineersPage.jsx');

  assert.match(applications, /工程师合作申请/);
  assert.match(applications, /工程师服务协作网络/);
  assert.match(engineers, /regionalLead: '区域负责人'/);
  assert.match(engineers, /no: '工程师编号'/);
  assert.match(engineers, /services: '服务项目'/);
  assert.match(engineers, /serviceRegion: '服务区域'/);
  assert.match(engineers, /workloadStatus: '工作状态'/);

  assert.doesNotMatch(`${applications}\n${engineers}`, /认证服务代表|区域主管|主管：|熟悉工艺\/服务|服务地区/);
  assert.doesNotMatch(engineers, /no: 'No\.'/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
cd admin
npm test
```

Expected: terminology contract FAILS on existing mixed copy.

- [ ] **Step 3: Apply the approved terminology table**

Change only engineer application and engineer management copy. Do not globally replace `Admin` in technical logs or unrelated pages.

- [ ] **Step 4: Document endpoints and deployment order**

Add to `TECH-SPEC.md`:

```text
POST /api/admin/engineer-applications/:id/open-account
POST /api/admin/engineer-applications/:id/resend-activation
POST /api/auth/engineer/activate
Engineer login accepts email or phone after activation.
```

Add both database preflight and migration commands to `DEPLOY.md`:

```bash
cd worker
wrangler d1 execute sagemro-db --env production --remote \
  --file migrations/data_fixes/account_identity_preflight.sql
wrangler d1 execute sagemro-db-cn --env production --remote \
  --file migrations/data_fixes/account_identity_preflight.sql

wrangler d1 execute sagemro-db --env production --remote \
  --file migrations/037_engineer_account_activation.sql
wrangler d1 execute sagemro-db-cn --env production --remote \
  --file migrations/037_engineer_account_activation.sql
```

Also document the idempotent post-deploy registry reconciliation SQL for customer email/phone and engineer email/phone. Each `INSERT ... SELECT` must use `NOT EXISTS` for the same owner/type so reruns skip existing claims, while remaining a plain `INSERT` so unexpected cross-owner conflicts fail loudly. State that duplicate preflight must run first.

- [ ] **Step 5: Run the complete local gate**

```bash
cd worker && npm test
cd ../frontend && npm run lint && npm test && npm run build
cd ../admin && npm test && npm run build
git diff --check
```

Expected:

- Worker unit and golden tests PASS.
- Frontend lint/tests/build PASS.
- Admin tests/build PASS.
- `git diff --check` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add admin/src/pages/EngineerApplicationsPage.jsx admin/src/pages/EngineersPage.jsx \
  admin/src/pages/cn-ui-language-contract.test.mjs \
  frontend/tests/cn-primary-ui-language-contract.test.mjs TECH-SPEC.md DEPLOY.md
git commit -m "copy(admin): unify engineer account terminology"
```

---

### Task 10: Sync Branches, Migrate Production, Deploy, And Smoke Test

**Files:**
- Shared commits from Tasks 1-9 on `china-edition` and `main`.
- Optional: `.github/workflows/deploy.yml` only after explicit user confirmation.

- [ ] **Step 1: Confirm email delivery configuration without exposing secrets**

Run:

```bash
cd worker
wrangler secret list --env production
rg -n "EMAIL|VERIFICATION_EMAIL_FROM|RESEND" wrangler.toml
```

Expected: `wrangler secret list` shows `RESEND_API_KEY` when the Resend path is used, while `wrangler.toml` shows any Cloudflare `EMAIL` binding and the configured `VERIFICATION_EMAIL_FROM`. Do not print secret values.

- [ ] **Step 2: Sync implementation commits to `main` locally, but do not push**

Cherry-pick the Task 1-9 commits onto `/Users/joe/Projects/sagemro.com/.worktrees/beta-readiness-main`. Keep `frontend/tests/cn-primary-ui-language-contract.test.mjs` and `admin/src/pages/cn-ui-language-contract.test.mjs` only on `china-edition`; shared production files and non-CN tests go to both branches. Run the complete local gate on `main`.

- [ ] **Step 3: Run duplicate preflight against both production databases**

```bash
cd /Users/joe/Projects/sagemro.com/.worktrees/beta-readiness-main/worker
wrangler d1 execute sagemro-db --env production --remote \
  --file migrations/data_fixes/account_identity_preflight.sql
wrangler d1 execute sagemro-db-cn --env production --remote \
  --file migrations/data_fixes/account_identity_preflight.sql
```

Expected: both duplicate queries return zero rows. If either returns data, stop and resolve records manually; do not run migration or push `main`.

- [ ] **Step 4: Apply migration 037 to both production databases**

```bash
wrangler d1 execute sagemro-db --env production --remote \
  --file migrations/037_engineer_account_activation.sql
wrangler d1 execute sagemro-db-cn --env production --remote \
  --file migrations/037_engineer_account_activation.sql
```

Verify:

```bash
wrangler d1 execute sagemro-db --env production --remote \
  --command "SELECT version FROM _migrations WHERE version = '037_engineer_account_activation';"
wrangler d1 execute sagemro-db-cn --env production --remote \
  --command "SELECT version FROM _migrations WHERE version = '037_engineer_account_activation';"
```

Expected: both return exactly `037_engineer_account_activation`.

- [ ] **Step 5: Optional CI hardening gate**

Before editing `.github/workflows/deploy.yml`, explicitly ask the user to approve changing the deployment workflow. If approved, extend `Check D1 migrations are applied` to query both databases and fail when either lacks a local migration. Run a YAML syntax review and include the workflow change in the `main` commit history.

- [ ] **Step 6: Push `main` and wait for Cloudflare deployment**

```bash
git push origin main
gh run list --workflow deploy.yml --branch main --limit 3
gh run watch <main-run-id> --exit-status
```

Expected: test, frontend, Admin, and Worker jobs all succeed.

- [ ] **Step 7: Push `china-edition` and deploy Aliyun ECS**

```bash
git push origin china-edition
gh run watch <china-cloudflare-run-id> --exit-status
gh workflow run aliyun-cn-deploy.yml --ref china-edition
gh run watch <aliyun-run-id> --exit-status
```

Expected: China Cloudflare auxiliary deployment and Aliyun ECS production deployment succeed.

- [ ] **Step 8: Perform production smoke tests**

Before the UI smoke, rerun duplicate preflight and execute the documented identity-registry reconciliation block against both D1 databases. Expected: missing identities are inserted and no uniqueness conflict occurs.

Use one controlled `.com` mailbox and one controlled `.cn` mailbox:

1. Submit an engineer application with name, phone, and email.
2. Mark it approved in the matching Admin.
3. Open the account and confirm an `E` engineer number appears.
4. Confirm the email link uses `/activate#token=` and expires in 48 hours.
5. Set a password and verify the link cannot be reused.
6. Sign in with email, sign out, then sign in with phone.
7. Open the linked engineer profile from the application card.
8. Confirm resend is unavailable after activation.

Health checks:

```bash
curl -fsSL https://api.sagemro.com/health
curl -fsSL https://api.sagemro.cn/health
```

Expected: both return `{"status":"ok"}`.

- [ ] **Step 9: Check final worktree state**

```bash
git -C /Users/joe/Projects/sagemro.com/.worktrees/beta-readiness-main status --short --branch
git -C /Users/joe/Projects/sagemro.com/.worktrees/engineer-entry-links-cn status --short --branch
```

Expected: no tracked changes; preserve existing local-only `.playwright-cli/`, `.superpowers/`, and `output/` directories without committing them.

---

## Execution Notes

- Implement on `china-edition` first because the current approved design and China-specific contracts live there, then synchronize shared commits to `main` before production migration and deployment.
- Do not push `main` until migration `037` is present in both production D1 databases.
- Do not amend or squash the task commits; their separation is useful for schema, Worker, Admin, and frontend rollback.
- Never send a real activation email during automated tests. Mock `env.EMAIL.send` or `fetch` and assert only sanitized payload metadata.
- Never print or persist raw activation tokens outside the immediate email payload and activation-page component state.
