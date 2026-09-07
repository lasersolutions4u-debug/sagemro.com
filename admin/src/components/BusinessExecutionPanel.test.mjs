import assert from 'node:assert/strict';
import { test } from 'node:test';

test('business service adapter isolates staff identity, multipart uploads and authenticated private media', async () => {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  const calls = [];
  globalThis.localStorage = { getItem: key => ({ admin_csrf_token: 'fictional-csrf', admin_token: 'fictional-admin' })[key] };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return url.includes('/field-media/') ? new Response(new Blob(['fixture'], { type: 'image/png' })) : Response.json({ revision: 2 });
  };
  try {
    const api = await import('../services/api.js');
    const context = { expected_staff_id: 'fixture/staff', scope_version: 'fixture-scope', quote_version: 1, revision: 1, idempotency_key: 'fixture-key' };
    const signal = new AbortController().signal;
    await api.getBusinessService('order/fixture', context.expected_staff_id, context.scope_version, signal);
    assert.match(calls[0].url, /order%2Ffixture\/service\?expected_staff_id=fixture%2Fstaff&scope_version=fixture-scope$/);
    await api.mutateBusinessService('order/fixture', 'report', { ...context, diagnosis: 'Fixture diagnosis' }, signal);
    assert.equal(calls[1].method, 'PUT'); assert.equal(calls[1].headers['X-CSRF-Token'], 'fictional-csrf');
    const form = new FormData(); form.append('photo', new Blob(['fixture'], { type: 'image/png' }), 'fixture.png');
    await api.mutateBusinessService('order/fixture', 'field-days/check-in', form, signal, context);
    assert.equal(calls[2].body.get('expected_staff_id'), context.expected_staff_id);
    assert.equal(calls[2].body.get('revision'), '1');
    assert.equal(calls[2].headers['Content-Type'], undefined);
    assert.equal(calls[2].headers['Idempotency-Key'], context.idempotency_key);
    const media = await api.getBusinessServiceMedia('order/fixture', 'photo/fixture', context.expected_staff_id, context.scope_version, signal);
    assert.equal(media.type, 'image/png'); assert.equal(calls[3].headers.Authorization, 'Bearer fictional-admin');
    assert.match(calls[3].url, /order%2Ffixture\/service\/field-media\/photo%2Ffixture\?/);
    for (const call of calls) { assert.equal(call.credentials, 'include'); assert.equal(call.signal, signal); }
    await assert.rejects(() => api.mutateBusinessService('order', '../approve-payment', context), /Unsupported/);
  } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage; }
});

test('business execution API preserves encoded IDs, scoped identity and CSRF without granting extra fields', async () => {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  const calls = [];
  globalThis.localStorage = { getItem: key => key === 'admin_csrf_token' ? 'fictional-csrf' : null };
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return Response.json({ success: true }); };
  try {
    const api = await import('../services/api.js');
    const signal = new AbortController().signal;
    await api.getBusinessExecution('order/fixture', 'admin', 'scope-fixture', signal);
    assert.match(calls[0].url, /order%2Ffixture\/execution\?expected_staff_id=admin&scope_version=scope-fixture$/);
    assert.equal(calls[0].signal, signal);
    const payload = { expected_staff_id: 'admin', scope_version: 'scope-fixture', quote_version: 1, revision: 0,
      executor_staff_id: 'staff-fixture', reason: 'Fictional local coverage gap', idempotency_key: 'assignment-fixture' };
    await api.assignBusinessExecution('order/fixture', { ...payload, engineer_id: 'not-permitted', status: 'in_service' }, signal);
    assert.match(calls[1].url, /order%2Ffixture\/execution\/assign$/);
    assert.equal(calls[1].method, 'POST');
    assert.deepEqual(JSON.parse(calls[1].body), payload);
    assert.equal(calls[1].headers['X-CSRF-Token'], 'fictional-csrf');
    assert.equal(calls[1].credentials, 'include');
    assert.equal(calls[1].signal, signal);
  } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage; }
});
