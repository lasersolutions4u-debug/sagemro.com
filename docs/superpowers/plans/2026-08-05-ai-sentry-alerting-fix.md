# AI Sentry Alerting Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make caught LLM upstream and stream failures reliably reach the existing Worker Sentry client without leaking upstream response text or changing the customer fallback experience.

**Architecture:** Keep the existing zero-dependency `captureException` implementation and change only the two incomplete AI chat call sites. Exercise the real `handleChat` stream with mocked LLM and Sentry fetches so tests prove that `env`, request context, safe stage metadata, and `ctx.waitUntil` are present.

**Tech Stack:** Cloudflare Workers, Web Streams API, Node.js built-in test runner, existing Sentry envelope client

---

## Scope boundaries

- Do not change Sentry DSN storage, Worker secrets, retry behavior, chat prompts, or customer fallback copy.
- Do not send user messages, images, API keys, raw upstream response bodies, raw stream exception text, URL query strings, or Referer values to Sentry.
- Do not add a third-party SDK; continue using `worker/src/lib/sentry.js`.
- This plan can be implemented and deployed independently of the promotion dashboard plan.

### Task 1: Reproduce both missing AI alerts through `handleChat`

**Files:**
- Modify: `worker/tests/chat-access.test.mjs`

**Interfaces:**
- Exercises: `handleChat(request, env)` from `worker/src/index.js`.
- Observes: the mocked Sentry envelope request and promises passed to `request._ctx.waitUntil`.

- [ ] **Step 1: Add a fetch recorder for LLM and Sentry calls**

Add a helper beside the existing `makeSseResponse` helper. It must route the fake LLM URL separately from the Sentry envelope URL and restore `globalThis.fetch` in `finally`:

```js
async function captureAiFailure({ env, request, llmResponse }) {
  const originalFetch = globalThis.fetch;
  const envelopes = [];
  const pending = [];
  request._ctx = { waitUntil(promise) { pending.push(promise); } };
  env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/42';
  env.ENVIRONMENT = 'test';

  globalThis.fetch = async (url) => {
    if (String(url) === env.OPENAI_API_ENDPOINT) return llmResponse();
    if (String(url).includes('/api/42/envelope/')) {
      return new Response(null, { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const sentryFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/api/42/envelope/')) envelopes.push(String(init.body));
    return sentryFetch(url, init);
  };

  try {
    const response = await handleChat(request, env);
    assert.equal(response.status, 200);
    await response.text();
    await Promise.all(pending);
    return envelopes;
  } finally {
    globalThis.fetch = originalFetch;
  }
}
```

- [ ] **Step 2: Add a failing upstream-status alert test**

Use the existing `makeEnv` and `makeRequest` helpers. The raw upstream body contains an email deliberately, and the assertion proves it never reaches Sentry:

```js
test('handleChat reports a safe Sentry event when the LLM upstream rejects the request', async () => {
  const { env } = makeEnv();
  const request = makeRequest({
    conversation_id: 'sentry-upstream-1',
    message: 'The laser is not starting.',
  });
  const envelopes = await captureAiFailure({
    env,
    request,
    llmResponse: () => new Response('buyer@example.com upstream detail', { status: 502 }),
  });

  assert.equal(envelopes.length, 1);
  assert.match(envelopes[0], /"feature":"ai_chat"/);
  assert.match(envelopes[0], /"stage":"upstream"/);
  assert.match(envelopes[0], /"status":502/);
  assert.doesNotMatch(envelopes[0], /buyer@example\.com/);
});
```

- [ ] **Step 3: Add a failing stream-error alert test**

Return a successful HTTP response whose body errors during reading:

```js
test('handleChat reports a Sentry event when the LLM stream fails', async () => {
  const { env } = makeEnv();
  const request = makeRequest({
    conversation_id: 'sentry-stream-1',
    message: 'The cutting head stopped moving.',
  });
  const envelopes = await captureAiFailure({
    env,
    request,
    llmResponse: () => new Response(new ReadableStream({
      start(controller) { controller.error(new Error('stream exploded buyer@example.com stream-secret-canary')); },
    }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
  });

  assert.equal(envelopes.length, 1);
  assert.match(envelopes[0], /"feature":"ai_chat"/);
  assert.match(envelopes[0], /"stage":"stream"/);
  assert.match(envelopes[0], /LLM stream processing failed/);
  assert.doesNotMatch(envelopes[0], /buyer@example\.com|stream-secret-canary/);
});
```

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```bash
cd worker
node --test tests/chat-access.test.mjs
```

Expected: the two new tests fail because both current call sites omit `env`, so no Sentry envelope is sent.

### Task 2: Pass complete, privacy-safe context to Sentry

**Files:**
- Modify: `worker/src/index.js:4307-4331`
- Modify: `worker/src/index.js:4403-4418`
- Modify: `worker/src/lib/sentry.js`

- [ ] **Step 1: Replace the upstream alert call**

Keep the redacted console output and customer fallback unchanged. Do not place `errText` in the constructed Error:

```js
captureException(
  new Error(`LLM upstream request failed with status ${apiResponse.status}`),
  env,
  {
    request,
    ctx: request._ctx,
    extra: {
      feature: 'ai_chat',
      stage: 'upstream',
      status: apiResponse.status,
      market: getRequestMarket(request),
      iteration,
    },
  },
);
```

- [ ] **Step 2: Replace the stream alert call without forwarding raw exception text**

Keep the original error only in the existing console log. Send a generic error plus the same safe request context to Sentry:

```js
captureException(new Error('LLM stream processing failed'), env, {
  request,
  ctx: request._ctx,
  extra: {
    feature: 'ai_chat',
    stage: 'stream',
    market: getRequestMarket(request),
  },
});
```

- [ ] **Step 3: Sanitize Sentry request metadata centrally**

In `worker/src/lib/sentry.js`, serialize request URLs as origin plus pathname only. Exclude Referer from the allowed header list; retain the other existing safe headers. Add request query and Referer canaries to the chat tests, assert both are absent from the complete envelope, and keep assertions for the route pathname and HTTP method.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
cd worker
node --test tests/chat-access.test.mjs
```

Expected: all chat-access tests pass, both envelope assertions pass, and the raw upstream email is absent.

- [ ] **Step 5: Commit the isolated alert repair**

```bash
git add worker/src/index.js worker/src/lib/sentry.js worker/tests/chat-access.test.mjs
git commit -m "fix(worker): report caught AI failures to Sentry"
```

### Task 3: Verify the Worker regression boundary

**Files:**
- No source changes expected.

- [ ] **Step 1: Run Sentry boundary and public route tests**

Run:

```bash
cd worker
node --test tests/chat-access.test.mjs tests/diagnostics-boundary.test.mjs tests/public-routes.test.mjs
```

Expected: PASS. The development-only Sentry smoke route remains inaccessible in production, and public route behavior is unchanged.

- [ ] **Step 2: Run the complete Worker suite**

Run:

```bash
cd worker
npm test
```

Expected: `pretest`, all Worker tests, and the evaluation harness pass with zero failures.

- [ ] **Step 3: Verify a clean diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional commits from this plan are present.

- [ ] **Step 4: Confirm the production Sentry binding exists before deployment**

Run from `worker/` with the existing authenticated Wrangler environment:

```bash
npx wrangler secret list --env production
```

Expected: the output lists the secret name `SENTRY_DSN`. Do not print or replace its value. If the name is absent, stop deployment and configure the existing secret through the approved Cloudflare/GitHub secret process.
