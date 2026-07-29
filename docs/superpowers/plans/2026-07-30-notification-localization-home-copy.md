# Notification Localization and Instant-Answer Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show known field-work notifications in Chinese on the CN customer site, keep COM notification responses in English, align the unread badge with its sidebar label, and publish the approved instant-answer homepage headlines in both languages.

**Architecture:** Keep the notification database unchanged. Add a narrow Worker response adapter that localizes only the two known system notification types for CN requests, and make future field-report notifications market-aware when they are written. Keep the frontend changes limited to the shared sidebar layout and `WelcomePage` copy; the existing `china-edition` notification modal already localizes its controls and will consume the localized API values.

**Tech Stack:** Cloudflare Workers JavaScript, D1-compatible query layer, React, Tailwind CSS, Node test runner, ESLint, Vite, GitHub Actions, Cloudflare Pages/Workers, Aliyun ECS deployment workflow.

## Global Constraints

- Work only in the isolated worktree `/private/tmp/sagemro-engineer-readiness-cn-clean`; do not modify the user's dirty checkout at `/Users/joe/Projects/sagemro.com`.
- Start from branch `codex/notification-localization-home-copy`, which is based on `origin/main`.
- Do not add a D1 migration or backfill historical notification rows.
- Do not translate unknown notification types or user-authored content.
- Do not change notification loading, read-state mutations, navigation, unread-count behavior, tools/insights modules, or homepage layout.
- Do not edit `wrangler.toml`, `.github/workflows/deploy.yml`, or Pages project names.
- Use `apply_patch` for source and test edits.
- Run the failing test before production code for every behavior change.
- Keep these approved strings exact:
  - CN headline: `设备问题不求人，即时交谈，马上就有答案`
  - EN headline: `Equipment trouble? Chat now. Get answers instantly.`
  - CN intro fragment: `描述现场情况`
  - CN check-in title: `工程师已到场签到`
  - CN check-in body: `工程师已为工单 ${orderNo} 完成现场签到。`
  - CN report title: `现场作业更新`
  - CN report body: `工单 ${orderNo} 已提交现场作业更新。`

---

### Task 1: Localize known field-work notifications at the Worker boundary

**Files:**

- Modify: `worker/tests/field-work-api.test.mjs:597-606`
- Modify: `worker/tests/field-work-api.test.mjs:1278-1291`
- Modify: `worker/src/index.js:19595-19609`
- Add helper near: `worker/src/index.js:19595`

- [ ] **Step 1: Extend the field-work API test helper with an explicit market**

Change the helper options to accept `market = 'com'`, and derive the JWT market, API host, and Origin from it:

```js
async function api(env, path, {
  userType,
  userId,
  method = 'GET',
  formData,
  body,
  idempotencyKey,
  staffRole,
  staffId,
  market = 'com',
} = {}) {
  // existing staff setup
  const hostname = market === 'cn' ? 'api.sagemro.cn' : 'api.sagemro.com';
  const origin = market === 'cn' ? 'https://sagemro.cn' : 'https://sagemro.com';
  const jwt = await signJwt({
    userId,
    userType,
    market,
    staffRole,
    staffId,
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${jwt}`, Origin: origin };
  // preserve existing body and idempotency handling
  const response = await worker.fetch(
    new Request(`https://${hostname}${path}`, {
      method,
      headers,
      body: formData || (body === undefined ? undefined : JSON.stringify(body)),
    }),
    env,
    { waitUntil() {} },
  );
  return { response, json: await response.clone().json().catch(() => ({})) };
}
```

Preserve the helper's existing `formData || JSON.stringify(body)` request-body behavior; only make the market-dependent values explicit.

- [ ] **Step 2: Write failing API tests for historical CN localization and COM preservation**

Add one focused test after `operations staff can read their overdue notification list and unread count`. Seed the same customer with:

```js
env.__notifications.push(
  {
    args: [
      'legacy-check-in',
      'customer-1',
      'customer',
      'field_day_checked_in',
      'Engineer checked in',
      'Engineer checked in for WO-20260715-489.',
      null,
    ],
  },
  {
    args: [
      'legacy-report',
      'customer-1',
      'customer',
      'field_day_report_submitted',
      'Field work update',
      'A field work update was submitted for WO-20260715-489.',
      null,
    ],
  },
  {
    args: [
      'unknown-system-message',
      'customer-1',
      'customer',
      'custom_notice',
      'Keep this title',
      'Keep this body',
      null,
    ],
  },
  {
    args: [
      'already-chinese',
      'customer-1',
      'customer',
      'field_day_checked_in',
      '工程师已到场签到',
      '工程师已为工单 WO-CN-EXISTING 完成现场签到。',
      null,
    ],
  },
  {
    args: [
      'unmatched-known-template',
      'customer-1',
      'customer',
      'field_day_report_submitted',
      'Custom report title',
      'Report uploaded without a work-order reference',
      null,
    ],
  },
);
```

Call `/api/notifications` once with `{ market: 'cn' }` and once with `{ market: 'com' }`. Assert:

```js
assert.deepEqual(
  cn.json.notifications.map(({ title, body }) => ({ title, body })),
  [
    {
      title: '工程师已到场签到',
      body: '工程师已为工单 WO-20260715-489 完成现场签到。',
    },
    {
      title: '现场作业更新',
      body: '工单 WO-20260715-489 已提交现场作业更新。',
    },
    { title: 'Keep this title', body: 'Keep this body' },
    {
      title: '工程师已到场签到',
      body: '工程师已为工单 WO-CN-EXISTING 完成现场签到。',
    },
    {
      title: 'Custom report title',
      body: 'Report uploaded without a work-order reference',
    },
  ],
);
assert.deepEqual(
  com.json.notifications.map(({ title, body }) => ({ title, body })),
  [
    {
      title: 'Engineer checked in',
      body: 'Engineer checked in for WO-20260715-489.',
    },
    {
      title: 'Field work update',
      body: 'A field work update was submitted for WO-20260715-489.',
    },
    { title: 'Keep this title', body: 'Keep this body' },
    {
      title: '工程师已到场签到',
      body: '工程师已为工单 WO-CN-EXISTING 完成现场签到。',
    },
    {
      title: 'Custom report title',
      body: 'Report uploaded without a work-order reference',
    },
  ],
);
```

The fourth and fifth records explicitly prove that already-Chinese content remains byte-for-byte unchanged and that a known type with a non-matching body is preserved rather than guessed.

- [ ] **Step 3: Run the focused test and confirm it fails for the missing adapter**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/worker
node --test --test-name-pattern="notification list localizes legacy field-work records" tests/field-work-api.test.mjs
```

Expected: FAIL because the CN response still contains the seeded English field-work values.

- [ ] **Step 4: Implement a narrow, non-mutating notification adapter**

Add helpers directly above `handleGetNotifications` in `worker/src/index.js`:

```js
function localizeKnownNotificationForMarket(notification, market) {
  if (market !== 'cn' || !notification) return notification;

  if (notification.type === 'field_day_checked_in') {
    const bodyMatch = String(notification.body || '').match(/^Engineer checked in for (.+)\.$/);
    return {
      ...notification,
      title: notification.title === 'Engineer checked in'
        ? '工程师已到场签到'
        : notification.title,
      body: bodyMatch
        ? `工程师已为工单 ${bodyMatch[1]} 完成现场签到。`
        : notification.body,
    };
  }

  if (notification.type === 'field_day_report_submitted') {
    const bodyMatch = String(notification.body || '').match(/^A field work update was submitted for (.+)\.$/);
    return {
      ...notification,
      title: notification.title === 'Field work update'
        ? '现场作业更新'
        : notification.title,
      body: bodyMatch
        ? `工单 ${bodyMatch[1]} 已提交现场作业更新。`
        : notification.body,
    };
  }

  return notification;
}
```

Then update `handleGetNotifications` without changing its query or pagination:

```js
const market = getRequestMarket(request);
const notifications = (results || []).map((notification) =>
  localizeKnownNotificationForMarket(notification, market)
);

return jsonResponse({ notifications });
```

This exact-match approach leaves already-Chinese values, unknown types, custom titles, and malformed legacy bodies unchanged. Returning a spread object avoids mutating D1 result objects.

- [ ] **Step 5: Run the focused test and confirm it passes**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/worker
node --test --test-name-pattern="notification list localizes legacy field-work records" tests/field-work-api.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the Worker read-time adapter**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean
git add worker/src/index.js worker/tests/field-work-api.test.mjs
git commit -m "fix(worker): localize CN field-work notifications"
```

---

### Task 2: Write new field-report notifications in the request market

**Files:**

- Modify: `worker/tests/field-work-api.test.mjs:1547-1585`
- Modify: `worker/src/index.js:8160-8340`

- [ ] **Step 1: Add failing assertions for new CN field-report notification copy**

Add a separate test adjacent to `daily report stores public and internal photos once, notifies customer, and compensates failed D1 writes`:

```js
test('Chinese daily report writes a Chinese customer notification', async () => {
  const env = createEnv();
  seedFieldDay(env);

  const result = await api(
    env,
    '/api/workorders/wo-onsite-1/field-days/field-day-1/report',
    {
      userType: 'engineer',
      userId: 'engineer-1',
      method: 'POST',
      formData: reportForm(),
      idempotencyKey: 'cn-report-1',
      market: 'cn',
    },
  );

  assert.equal(result.response.status, 201, JSON.stringify(result.json));
  const notification = env.__notifications.find(
    (item) => item.args[3] === 'field_day_report_submitted',
  );
  assert.equal(notification.args[4], '现场作业更新');
  assert.equal(notification.args[5], '工单 WO-ONSITE-1 已提交现场作业更新。');
});
```

Keep the existing COM daily-report test. Add title/body assertions there so it continues to prove:

```js
assert.equal(env.__notifications[0].args[4], 'Field work update');
assert.equal(
  env.__notifications[0].args[5],
  'A field work update was submitted for WO-ONSITE-1.',
);
```

- [ ] **Step 2: Run the focused CN write test and confirm it fails**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/worker
node --test --test-name-pattern="Chinese daily report writes a Chinese customer notification" tests/field-work-api.test.mjs
```

Expected: FAIL because `handleSubmitFieldDayReport` still writes `Field work update`.

- [ ] **Step 3: Make the report write path market-aware**

At the beginning of `handleSubmitFieldDayReport`, store the request market once:

```js
const market = getRequestMarket(request);
```

Use that same variable for the R2 object-key market segment instead of calling `getRequestMarket(request)` again.

Replace only the notification title/body assignment after the field-day batch commits:

```js
await notifyFieldWorkBestEffort(env, {
  user_id: workOrder.customer_id,
  user_type: 'customer',
  type: 'field_day_report_submitted',
  title: market === 'cn' ? '现场作业更新' : 'Field work update',
  body: market === 'cn'
    ? `工单 ${workOrder.order_no} 已提交现场作业更新。`
    : `A field work update was submitted for ${workOrder.order_no}.`,
  data: { work_order_id: workOrderId, field_day_id: fieldDayId },
});
```

Do not change post-commit best-effort behavior or notification failure handling.

- [ ] **Step 4: Run the CN and COM notification-write tests**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/worker
node --test --test-name-pattern="daily report stores|Chinese daily report writes" tests/field-work-api.test.mjs
```

Expected: PASS, with CN stored in Chinese and COM stored in English.

- [ ] **Step 5: Run the entire field-work API test file**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/worker
node --test tests/field-work-api.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the market-aware write path**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean
git add worker/src/index.js worker/tests/field-work-api.test.mjs
git commit -m "fix(worker): write field reports in market language"
```

---

### Task 3: Align the unread badge with the notification label

**Files:**

- Modify: `frontend/tests/brand-assets-contract.test.mjs:336-347`
- Modify: `frontend/src/components/Sidebar/Sidebar.jsx:143-161`

- [ ] **Step 1: Add a failing sidebar layout contract**

In `customer sidebar tools stay expanded without a More overflow menu`, add:

```js
assert.match(
  toolbar,
  /tool\.badge > 0[\s\S]*className="ml-auto flex h-4 min-w-4 items-center justify-center/,
);
assert.doesNotMatch(
  toolbar,
  /className="absolute -right-1 -top-1 flex h-4 min-w-4/,
);
```

The contract checks the behavior requested by the screenshot: the badge participates in the notification row and uses automatic left margin.

- [ ] **Step 2: Run the focused frontend test and confirm it fails**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/frontend
node --test --test-name-pattern="customer sidebar tools stay expanded" tests/brand-assets-contract.test.mjs
```

Expected: FAIL because the badge still uses `absolute -right-1 -top-1`.

- [ ] **Step 3: Change only the badge positioning classes**

In `RailButton`, replace:

```jsx
<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
```

with:

```jsx
<span className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
```

Keep the badge condition and `99+` cap unchanged. Do not edit `ToolBar.jsx`, whose badge is already inline.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/frontend
node --test --test-name-pattern="customer sidebar tools stay expanded" tests/brand-assets-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the badge layout fix**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean
git add frontend/src/components/Sidebar/Sidebar.jsx frontend/tests/brand-assets-contract.test.mjs
git commit -m "fix(frontend): align notification unread badge"
```

---

### Task 4: Publish the approved CN and EN instant-answer homepage copy

**Files:**

- Modify: `frontend/tests/brand-assets-contract.test.mjs:74-102`
- Modify: `frontend/src/components/Chat/WelcomePage.jsx:8-24`

- [ ] **Step 1: Update the copy contract before production copy**

In `main site first-impression copy keeps CN and COM market language separate`, replace the old headline assertions and add the removed-word guard:

```js
assert.match(
  welcome,
  /Equipment trouble\? Chat now\. Get answers instantly\./,
);
assert.doesNotMatch(
  welcome,
  /Issues with laser and metal forming equipment\? Ask AI first\./,
);
assert.match(
  welcome,
  /设备问题不求人，即时交谈，马上就有答案/,
);
assert.doesNotMatch(
  welcome,
  /激光和成型设备问题，先问AI试试/,
);
assert.match(welcome, /描述现场情况/);
assert.doesNotMatch(welcome, /描述现场遇到的情况/);
```

Retain the existing assertion for the unchanged English intro and the surrounding no-marketing-module guards.

- [ ] **Step 2: Run the focused copy test and confirm it fails**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/frontend
node --test --test-name-pattern="main site first-impression copy" tests/brand-assets-contract.test.mjs
```

Expected: FAIL on both old headlines and the CN intro.

- [ ] **Step 3: Replace only the three approved copy values**

Update `frontend/src/components/Chat/WelcomePage.jsx`:

```js
en: {
  eyebrow: 'SAGEMRO Service OS',
  headline: 'Equipment trouble? Chat now. Get answers instantly.',
  intro: 'Cutting issue, bending problem, or welding alarm? Describe what you are seeing on site, and let SAGEMRO AI analyze it and offer suggestions.',
  // unchanged resources
},
zh: {
  eyebrow: 'SAGEMRO 智能服务系统',
  headline: '设备问题不求人，即时交谈，马上就有答案',
  intro: '切割出了什么问题、折弯哪里不对、焊接报了什么警——描述现场情况，让SAGEMRO AI 给你分析和建议',
  // unchanged resources
},
```

Do not change the hero layout, resource cards, About page, or any promotional/service-promise modules.

- [ ] **Step 4: Run the focused copy test and confirm it passes**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/frontend
node --test --test-name-pattern="main site first-impression copy" tests/brand-assets-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the bilingual homepage copy**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean
git add frontend/src/components/Chat/WelcomePage.jsx frontend/tests/brand-assets-contract.test.mjs
git commit -m "copy(frontend): emphasize instant equipment answers"
```

---

### Task 5: Run repository gates and inspect the complete diff

**Files:**

- Verify only; no planned production edits.

- [ ] **Step 1: Run the complete Worker suite**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/worker
npm test
```

Expected: PASS.

- [ ] **Step 2: Run all frontend gates**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/frontend
npm run lint
npm test
npm run build
```

Expected: all PASS and `frontend/dist/` builds successfully.

- [ ] **Step 3: Run the Admin gates required by CI**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/admin
npm test
npm run build
```

Expected: all PASS and `admin/dist/` builds successfully.

- [ ] **Step 4: Confirm there is no migration or unrelated file drift**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- \
  worker/src/index.js \
  worker/tests/field-work-api.test.mjs \
  frontend/src/components/Sidebar/Sidebar.jsx \
  frontend/src/components/Chat/WelcomePage.jsx \
  frontend/tests/brand-assets-contract.test.mjs
git diff --name-only origin/main...HEAD -- worker/migrations .github/workflows worker/wrangler.toml
```

Expected:

- only the design/plan docs and the five implementation/test files are changed;
- the final command prints nothing;
- no placeholders such as `TODO`, `TBD`, or `FIXME` were introduced.

- [ ] **Step 5: Review behavior against the approved design**

Confirm from tests and diff:

- CN list reads localize both legacy field-work types.
- COM list reads return the same stored English.
- already-Chinese, unknown, and malformed-template records are preserved.
- new CN reports write Chinese; new COM reports write English.
- badge layout is inline and retains `99+`.
- both headlines and the CN intro match the approved text exactly.
- notification controls, read state, routing, homepage tools/insights, and layout remain unchanged.

---

### Task 6: Release to COM, then synchronize and release CN

**Files:**

- No additional source changes expected.
- Branches: `codex/notification-localization-home-copy`, `main`, `china-edition`
- Workflows: `.github/workflows/deploy.yml`, `.github/workflows/aliyun-cn-deploy.yml`

- [ ] **Step 1: Push the reviewed feature branch and open the main PR**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean
git push -u origin codex/notification-localization-home-copy
gh pr create \
  --base main \
  --head codex/notification-localization-home-copy \
  --title "Fix CN notification language and refresh instant-answer copy" \
  --body-file docs/superpowers/specs/2026-07-30-notification-localization-home-copy-design.md
```

Do not merge until required checks pass.

- [ ] **Step 2: Verify and merge the main PR**

Run:

```bash
gh pr checks codex/notification-localization-home-copy --watch
gh pr merge codex/notification-localization-home-copy --merge
```

Record the merge SHA. Confirm the `main` push workflow completes successfully:

```bash
gh run list --workflow deploy.yml --branch main --limit 5
```

Copy the numeric run ID for the new `main` push from that list, then run `gh run watch` with that exact ID. Expected: test, COM frontend, Admin, and production Worker jobs pass.

- [ ] **Step 3: Smoke-test COM**

Verify:

```bash
curl -I https://sagemro.com/
curl -I https://api.sagemro.com/health
```

Then inspect `https://sagemro.com/` in a browser and confirm:

- headline is `Equipment trouble? Chat now. Get answers instantly.`;
- tools and insights cards remain present;
- no new marketing module was added;
- a logged-in COM account still receives English field-work notification content.

- [ ] **Step 4: Create a clean China synchronization branch**

After fetching the merged `main` and latest `china-edition`, create a new branch from `origin/china-edition`:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean
git fetch origin main china-edition
git switch -c codex/cn-notification-copy-sync origin/china-edition
```

Identify the four implementation commits by their exact subjects:

```bash
git log origin/main --format="%H %s" --grep="fix(worker): localize CN field-work notifications" -1
git log origin/main --format="%H %s" --grep="fix(worker): write field reports in market language" -1
git log origin/main --format="%H %s" --grep="fix(frontend): align notification unread badge" -1
git log origin/main --format="%H %s" --grep="copy(frontend): emphasize instant equipment answers" -1
```

Cherry-pick those four printed SHAs, in the order shown, onto `codex/cn-notification-copy-sync`. Do not cherry-pick the main PR merge commit.

The China branch intentionally contains additional locale tests and a localized `NotificationModal`; preserve those branch-specific files. Resolve any test-file conflict by retaining existing CN language assertions and adding the new headline/badge assertions, never by replacing the CN suite with the main version.

- [ ] **Step 5: Run China branch gates**

Run:

```bash
cd /private/tmp/sagemro-engineer-readiness-cn-clean/worker
npm test

cd /private/tmp/sagemro-engineer-readiness-cn-clean/frontend
npm run lint
npm test
npm run build

cd /private/tmp/sagemro-engineer-readiness-cn-clean/admin
npm test
npm run build
```

Expected: all PASS, including:

- `frontend/tests/cn-primary-ui-language-contract.test.mjs`;
- `frontend/tests/en-site-language-contract.test.mjs`;
- the shared `brand-assets-contract.test.mjs`.

- [ ] **Step 6: Open, verify, and merge the China PR**

Run:

```bash
git push -u origin codex/cn-notification-copy-sync
gh pr create \
  --base china-edition \
  --head codex/cn-notification-copy-sync \
  --title "Sync CN notification language and instant-answer copy" \
  --body "Synchronizes the reviewed notification localization, inline unread badge, and approved CN homepage copy from the main release."
gh pr checks codex/cn-notification-copy-sync --watch
gh pr merge codex/cn-notification-copy-sync --merge
```

Record the China merge SHA.

- [ ] **Step 7: Trigger the real CN production deployment**

The China push deploy in `deploy.yml` only updates auxiliary Cloudflare Pages. Trigger the Aliyun ECS workflow explicitly:

```bash
gh workflow run aliyun-cn-deploy.yml --ref china-edition
gh run list --workflow aliyun-cn-deploy.yml --branch china-edition --limit 5
```

Copy the numeric run ID for the newly triggered Aliyun workflow from that list, then run `gh run watch` with that exact ID. Expected: frontend/Admin builds, upload, release switch, nginx reload, and workflow smoke steps all pass.

No Worker deployment is required from `china-edition`; the shared Worker was already deployed from `main`.

- [ ] **Step 8: Smoke-test CN production**

Verify:

```bash
curl -I https://sagemro.cn/
curl -I https://engineer.sagemro.cn/
curl -I https://admin.sagemro.cn/
curl -I https://api.sagemro.cn/health
```

Then inspect a logged-in CN customer session and confirm:

- headline is `设备问题不求人，即时交谈，马上就有答案`;
- intro contains `描述现场情况` and no longer contains `遇到的`;
- unread badge is horizontally aligned with `通知`;
- existing English `field_day_checked_in` and `field_day_report_submitted` history displays in Chinese;
- a newly submitted CN field report produces Chinese notification title/body;
- unknown notification copy is unchanged;
- tools and insights entries remain present and no new homepage marketing block appears.

- [ ] **Step 9: Record release evidence**

Report:

- main PR URL and merge SHA;
- `main` deployment run URL/status;
- China PR URL and merge SHA;
- Aliyun deployment run URL/status;
- COM/CN smoke results;
- confirmation that no D1 migration/backfill was run or needed.
