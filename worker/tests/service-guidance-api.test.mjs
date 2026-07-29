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
    publicMessages: Array.from({ length: 13 }, () => ({ sender_type: 'customer', content: 'Email jane@example.com' })),
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

test('guidance prompt confines the model to advisory output', () => {
  const { systemPrompt, userPrompt } = buildServiceGuidancePrompt({
    market: 'com',
    input: buildServiceGuidanceInput({ workOrder: {}, serviceStandard: {} }),
  });

  assert.match(systemPrompt, /Do not.*complete.*service-standard/i);
  assert.match(userPrompt, /at most 3/i);
  assert.match(userPrompt, /at most 2/i);
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
