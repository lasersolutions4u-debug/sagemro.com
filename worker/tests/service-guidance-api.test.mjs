import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GUIDANCE_GENERATION_STATUSES,
  GUIDANCE_VISIBLE_STATUSES,
  adaptReadinessV1,
  buildServiceGuidanceInput,
  buildServiceGuidancePrompt,
  parseServiceGuidance,
} from '../src/lib/serviceGuidance.js';

const itemKeys = new Set([
  'risk.isolation_permission',
  'task.problem_and_goal',
  'ready.parts_and_consumables',
]);

function validGuidance(overrides = {}) {
  return {
    version: 2,
    step_key: 'one_visit_readiness',
    headline: 'Confirm isolation before departure',
    risk_level: 'high',
    observations: [{ priority: 'high', detail: 'Isolation is unconfirmed.', source: 'service_standard' }],
    next_actions: [{
      priority: 'high',
      action: 'Confirm isolation.',
      rationale: 'Required before work.',
      related_item_key: 'risk.isolation_permission',
    }],
    customer_questions: [{ priority: 'high', draft: 'Can the machine be isolated?' }],
    evidence_needed: ['alarm_screen'],
    ...overrides,
  };
}

test('v2 guidance clamps actions and customer questions', () => {
  const result = parseServiceGuidance(JSON.stringify(validGuidance({
    next_actions: [
      { priority: 'high', action: 'Confirm isolation.', rationale: 'Required before work.', related_item_key: 'risk.isolation_permission' },
      { priority: 'medium', action: 'Request alarm photo.', rationale: 'Narrows diagnosis.', related_item_key: 'task.problem_and_goal' },
      { priority: 'low', action: 'Pack cleaning kit.', rationale: 'Likely useful.', related_item_key: 'ready.parts_and_consumables' },
      { priority: 'low', action: 'Extra action.', rationale: 'Must be removed.', related_item_key: '' },
    ],
    customer_questions: [
      { priority: 'high', draft: 'Can the machine be isolated?' },
      { priority: 'medium', draft: 'Please send the alarm screen.' },
      { priority: 'low', draft: 'This third question is removed.' },
    ],
  })), itemKeys);

  assert.equal(result.next_actions.length, 3);
  assert.equal(result.customer_questions.length, 2);
});

test('v2 guidance rejects malformed JSON, wrong scalar types, and missing collections', () => {
  assert.equal(parseServiceGuidance('{not-json}', itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ headline: 42 })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ risk_level: {} })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ observations: {} })), itemKeys), null);

  const missingQuestions = validGuidance();
  delete missingQuestions.customer_questions;
  assert.equal(parseServiceGuidance(JSON.stringify(missingQuestions), itemKeys), null);
});

test('v2 guidance rejects invalid nested shapes within retained caps', () => {
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    observations: [{ priority: 'high', detail: 'Missing source.' }],
  })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    next_actions: [{ priority: 'high', action: 'Confirm.', rationale: 'Needed.' }],
  })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    customer_questions: [{ priority: 'medium', draft: { text: 'Not a string' } }],
  })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ evidence_needed: ['alarm', { name: 'photo' }] })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    next_actions: [
      { priority: 'high', action: 'Confirm.', rationale: 'Needed.', related_item_key: 'risk.isolation_permission' },
      { priority: 'medium', action: 'Request.', rationale: 'Needed.', related_item_key: 'task.problem_and_goal' },
      { priority: 'low', action: 'Invalid retained entry.', rationale: 'Needed.', related_item_key: 'invented.item' },
      { priority: 'low', action: 'Ignored valid overflow.', rationale: 'Needed.', related_item_key: 'ready.parts_and_consumables' },
    ],
  })), itemKeys), null);
});

test('v2 guidance ignores malformed overflow entries after retained caps', () => {
  const result = parseServiceGuidance(JSON.stringify(validGuidance({
    next_actions: [
      { priority: 'high', action: 'Confirm.', rationale: 'Needed.', related_item_key: 'risk.isolation_permission' },
      { priority: 'medium', action: 'Request.', rationale: 'Needed.', related_item_key: 'task.problem_and_goal' },
      { priority: 'low', action: 'Pack.', rationale: 'Needed.', related_item_key: 'ready.parts_and_consumables' },
      { priority: 'low', action: 'Ignored action.', rationale: 'Ignored.', related_item_key: '' },
    ],
    customer_questions: [
      { priority: 'high', draft: 'Can the machine be isolated?' },
      { priority: 'medium', draft: 'Please send the alarm screen.' },
      { priority: 'low', draft: null },
    ],
  })), itemKeys);

  assert.equal(result.next_actions.length, 3);
  assert.equal(result.customer_questions.length, 2);
});

test('v2 guidance rejects values outside the strict schema', () => {
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ risk_level: 'critical' })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ step_key: 'invented_step' })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    observations: [{ priority: 'high', detail: 'Unverified.', source: 'internal_note' }],
  })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    next_actions: [{ priority: 'high', action: 'Confirm.', rationale: 'Needed.', related_item_key: 'invented.item' }],
  })), itemKeys), null);
});

test('v2 guidance projects exact keys and rejects unexpected prototype-shaped JSON', () => {
  const parsed = parseServiceGuidance(JSON.stringify(validGuidance()), itemKeys);
  assert.deepEqual(Object.keys(parsed), [
    'version', 'step_key', 'headline', 'risk_level', 'observations', 'next_actions',
    'customer_questions', 'evidence_needed',
  ]);
  const prototypePayload = `${JSON.stringify(validGuidance()).slice(0, -1)},"__proto__":{"polluted":true}}`;
  assert.equal(parseServiceGuidance(prototypePayload, itemKeys), null);
  assert.equal({}.polluted, undefined);
});

test('guidance lifecycle exposes completed read-only and never generates it', () => {
  assert.deepEqual([...GUIDANCE_VISIBLE_STATUSES], [
    'assigned', 'in_progress', 'pricing', 'pending_payment',
    'payment_review', 'in_service', 'resolved', 'pending_review', 'completed',
  ]);
  assert.deepEqual([...GUIDANCE_GENERATION_STATUSES], [
    'assigned', 'in_progress', 'pricing', 'pending_payment',
    'payment_review', 'in_service', 'resolved', 'pending_review',
  ]);
  assert.equal(GUIDANCE_GENERATION_STATUSES.has('completed'), false);
});

test('guidance input is bounded, redacted, and contains no private evidence', () => {
  const input = buildServiceGuidanceInput({
    workOrder: {
      type: 'repair', description: 'Call jane@example.com on 415-555-0123', urgency: 'high',
      service_mode: 'onsite', ai_summary: 'Customer phone 020 1234 5678', internal_note: 'never expose',
    },
    device: { brand: 'Acme', model: 'M-1' },
    sourceConversationId: 'conversation-1',
    sourceSummary: 'Email jane@example.com',
    sourceMessages: Array.from({ length: 13 }, () => ({ role: 'user', content: 'Call 415-555-0123' })),
    publicMessages: Array.from({ length: 13 }, () => ({
      sender_type: 'customer', content: 'Email jane@example.com', is_internal_note: 0, is_customer_visible: 1,
    })),
    serviceStandard: {
      currentStepKey: 'one_visit_readiness',
      blockingItemKeys: ['risk.isolation_permission'],
      pendingItemKeys: ['ready.parts_and_consumables'],
      internal_reasoning: 'never expose',
    },
    operationalState: {
      paymentState: 'pending_payment', materialRequestCount: 1, fieldDayCount: 2,
      fieldReportCount: 3, serviceReportPresent: false, private_note: 'never expose',
    },
    mediaCounts: {
      source_conversation_image_count: 1,
      work_order_attachment_count: 2,
      work_order_message_attachment_count: 3,
      protected_url: 'https://private.example/media',
    },
  });

  assert.deepEqual(Object.keys(input), [
    'work_order', 'source_conversation', 'public_work_order_messages', 'service_standard',
    'operational_state', 'media_counts',
  ]);
  assert.equal(input.source_conversation.messages.length, 12);
  assert.equal(input.public_work_order_messages.length, 12);
  assert.doesNotMatch(JSON.stringify(input), /jane@example\.com|415-555-0123|020 1234 5678|internal_note|private_note|protected_url|private\.example/);
  assert.deepEqual(input.service_standard, {
    current_step_key: 'one_visit_readiness',
    blocking_item_keys: ['risk.isolation_permission'],
    pending_item_keys: ['ready.parts_and_consumables'],
  });
});

test('guidance input accepts only canonical public evidence and standard item keys', () => {
  const input = buildServiceGuidanceInput({
    workOrder: { description: { private: 'must not stringify' } },
    sourceConversationId: 'conversation-1',
    sourceMessages: [
      { role: 'user', content: 'Customer report' },
      { role: 'system', content: 'SYSTEM-SECRET' },
      { role: 'tool', content: 'TOOL-SECRET' },
      { role: 'assistant', content: { secret: 'OBJECT-SECRET' } },
    ],
    publicMessages: [
      { sender_type: 'customer', content: 'Visible customer message', is_internal_note: 0, is_customer_visible: 1 },
      { sender_type: 'engineer', content: 'Visible engineer message', is_internal_note: false, is_customer_visible: true },
      { sender_type: 'admin', content: 'ADMIN-SECRET', is_internal_note: 0, is_customer_visible: 1 },
      { sender_type: 'customer', content: 'INTERNAL-SECRET', is_internal_note: 1, is_customer_visible: 1 },
      { sender_type: 'engineer', content: 'HIDDEN-SECRET', is_internal_note: 0, is_customer_visible: 0 },
      { sender_type: 'customer', content: { secret: 'OBJECT-SECRET' }, is_internal_note: 0, is_customer_visible: 1 },
    ],
    serviceStandard: {
      blockingItemKeys: ['risk.isolation_permission', 'invented.item'],
      pendingItemKeys: ['ready.parts_and_consumables', 'not.a.standard.item'],
    },
  });

  assert.deepEqual(input.source_conversation.messages, [{ role: 'user', content: 'Customer report' }]);
  assert.deepEqual(input.public_work_order_messages, [
    { sender_type: 'customer', content: 'Visible customer message' },
    { sender_type: 'engineer', content: 'Visible engineer message' },
  ]);
  assert.deepEqual(input.service_standard.blocking_item_keys, ['risk.isolation_permission']);
  assert.deepEqual(input.service_standard.pending_item_keys, ['ready.parts_and_consumables']);
  assert.doesNotMatch(JSON.stringify(input), /SECRET|\[object Object\]|invented\.item|not\.a\.standard\.item/);
});

test('guidance prompts prohibit completion authority in both languages', () => {
  const input = buildServiceGuidanceInput({ workOrder: {}, serviceStandard: {} });
  const english = buildServiceGuidancePrompt({
    market: 'com',
    input,
  });
  const chinese = buildServiceGuidancePrompt({ market: 'cn', input });

  assert.match(english.systemPrompt, /Do not confirm/i);
  assert.match(english.systemPrompt, /clear a gate/i);
  assert.match(english.systemPrompt, /customer-visible completion/i);
  assert.match(english.userPrompt, /at most 3/i);
  assert.match(english.userPrompt, /at most 2/i);
  assert.match(chinese.systemPrompt, /不得确认/);
  assert.match(chinese.systemPrompt, /清除闸门/);
  assert.match(chinese.systemPrompt, /面向客户的完成状态/);
});

test('v1 readiness adaptation uses the first high-priority gap without creating standard progress', () => {
  const guidance = adaptReadinessV1({
    gaps: [
      { priority: 'medium', detail: 'Confirm controller version.', why_it_matters: 'Needed for diagnosis.' },
      { priority: 'high', detail: 'Confirm isolation permission.', why_it_matters: 'Required before work.' },
      { priority: 'high', detail: 'Confirm access window.', why_it_matters: 'Needed for entry.' },
    ],
    customer_questions: [
      { priority: 'high', draft: 'Can the machine be isolated?' },
      { priority: 'medium', draft: 'What is the controller version?' },
      { priority: 'low', draft: 'This is removed.' },
    ],
  });

  assert.equal(guidance.headline, 'Confirm isolation permission.');
  assert.deepEqual(guidance.customer_questions, [
    { priority: 'high', draft: 'Can the machine be isolated?' },
    { priority: 'medium', draft: 'What is the controller version?' },
  ]);
  assert.equal(Object.hasOwn(guidance, 'service_standard_progress'), false);
  assert.doesNotMatch(JSON.stringify(guidance), /completed|confirmed/);
});
