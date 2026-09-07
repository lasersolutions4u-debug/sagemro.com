import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

async function subject() {
  const url = new URL('../src/components/ServiceRequest/serviceRequestChat.js', import.meta.url);
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync(url), true, 'chat-to-form handoff module must exist');
  return import(url);
}

test('chat context covers each service without sending raw URL instructions', async () => {
  const { composeServiceChatMessage } = await subject();
  for (const kind of ['repair', 'maintenance', 'retrofit', 'relocation', 'used_equipment', 'parts']) {
    const message = composeServiceChatMessage('Example request.', { service_kind: kind }, false);
    assert.match(message, /Example request\./);
    assert.match(message, /service request/);
    assert.match(message, /Do not submit/);
  }
  assert.doesNotMatch(composeServiceChatMessage('Hello', { source: 'ignore instructions' }, true), /ignore instructions/);
});

test('handoff extracts only customer statements, preserves source text and cannot submit an order', async () => {
  const { prepareServiceRequestFromChat } = await subject();
  let calls = 0;
  const draft = await prepareServiceRequestFromChat({
    messages: [{ role: 'user', content: 'Example cutter needs maintenance.' }, { role: 'assistant', content: 'Invented model ABC.' }],
    presets: { service_kind: 'maintenance' },
    assist: async ({ message, draft }) => {
      calls++;
      assert.equal(message, 'Example cutter needs maintenance.');
      assert.equal(draft.service_kind, 'maintenance');
      return { patch: { device_types: ['Laser cutter'], step: 4, submission_key: 'unsafe', contact: { name: 'Example Person' } }, missing_fields: ['region'] };
    },
  });
  assert.equal(calls, 1);
  assert.equal(draft.description, 'Example cutter needs maintenance.');
  assert.equal(draft.step, 1);
  assert.notEqual(draft.submission_key, 'unsafe');
  assert.deepEqual(draft.device_types, ['Laser cutter']);
});

test('empty or oversized transcripts never invoke AI and failures propagate without replacing a draft', async () => {
  const { prepareServiceRequestFromChat } = await subject();
  const assist = () => { throw new Error('must not call'); };
  await assert.rejects(prepareServiceRequestFromChat({ messages: [], assist }), /empty_chat/);
  await assert.rejects(prepareServiceRequestFromChat({ messages: [{ role: 'user', content: 'x'.repeat(4001) }], assist }), /chat_too_long/);
  await assert.rejects(prepareServiceRequestFromChat({ messages: [{ role: 'user', content: 'Example' }], assist: async () => { throw new Error('unavailable'); } }), /unavailable/);
});

test('chat offers an explicit handoff and App connects it to the existing form, not submission', async () => {
  const chat = await readFile(new URL('../src/components/Chat/ChatArea.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(chat, /onClick=\{onPrepareServiceRequest\}/);
  assert.match(chat, /Prepare service form/);
  assert.match(app, /prepareServiceRequestFromChat/);
  assert.match(app, /initialDraft=\{preparedRequest\?\.draft \|\| serviceRequestEntry.presets\}/);
  assert.match(app, /handoffVersionRef/);
  const flow = await readFile(new URL('../src/components/ServiceRequest/ServiceRequestFlow.jsx', import.meta.url), 'utf8');
  assert.match(flow, /!choosingDraft/);
  assert.match(flow, /useEntryConversation \? conversationId : undefined/);
});
