import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICE_REQUEST_VERSION,
  SERVICE_REQUEST_KINDS,
  SERVICE_KIND_TO_WORK_ORDER_TYPE,
  SERVICE_REQUEST_MISSING_FIELDS,
  normalizeServiceRequestIntake,
  serializeServiceRequestIntake,
  buildServiceRequestAssistPrompt,
  parseServiceRequestAssistOutput,
} from '../src/lib/serviceRequestIntake.js';
import { ValidationError } from '../src/lib/validators.js';

const completeInput = {
  service_request_kind: 'repair',
  device_types: ['laser_cutting', 'bending'],
  device_brands: ['TRUMPF', 'Bystronic'],
  device_model: 'TruLaser 3030',
  region: ['China', 'Shandong', 'Jinan'],
  alarm_code: 'E-1042',
  production_impact: 'Production line stopped',
  contact: {
    name: 'Alex Chen',
    email: 'alex@example.com',
    phone: '+8613800138000',
    whatsapp: '+8613800138000',
    preference: 'whatsapp',
    internal_note: 'must not survive',
  },
  admin_override: true,
};

test('exports the version, kinds, and legacy work-order mapping', () => {
  assert.equal(SERVICE_REQUEST_VERSION, 2);
  assert.deepEqual(SERVICE_REQUEST_KINDS, [
    'repair', 'retrofit', 'relocation', 'maintenance', 'used_equipment', 'parts',
  ]);
  assert.deepEqual(SERVICE_KIND_TO_WORK_ORDER_TYPE, {
    repair: 'fault',
    retrofit: 'aftersales',
    relocation: 'aftersales',
    maintenance: 'maintenance',
    used_equipment: 'aftersales',
    parts: 'parts',
  });
});

test('normalizes complete array and contact input into an exact whitelist shape', () => {
  assert.deepEqual(normalizeServiceRequestIntake(completeInput), {
    service_request_kind: 'repair',
    device_types: ['laser_cutting', 'bending'],
    device_brands: ['TRUMPF', 'Bystronic'],
    device_model: 'TruLaser 3030',
    region: ['China', 'Shandong', 'Jinan'],
    alarm_code: 'E-1042',
    production_impact: 'Production line stopped',
    contact: {
      name: 'Alex Chen',
      email: 'alex@example.com',
      phone: '+8613800138000',
      whatsapp: '+8613800138000',
      preference: 'whatsapp',
    },
  });
});

test('normalizes omitted and blank optional values to a stable empty shape', () => {
  assert.deepEqual(normalizeServiceRequestIntake({
    service_request_kind: 'parts',
    device_model: '  ',
    contact: {},
  }), {
    service_request_kind: 'parts',
    device_types: [],
    device_brands: [],
    device_model: '',
    region: [],
    alarm_code: '',
    production_impact: '',
    contact: { name: '', email: '', phone: '', whatsapp: '', preference: '' },
  });
});

test('rejects invalid service request kinds and contact preferences', () => {
  assert.throws(
    () => normalizeServiceRequestIntake({ service_request_kind: 'diagnosis' }),
    (error) => error instanceof ValidationError && /service_request_kind/.test(error.message),
  );
  assert.throws(
    () => normalizeServiceRequestIntake({
      service_request_kind: 'repair',
      contact: { preference: 'wechat' },
    }),
    (error) => error instanceof ValidationError && /contact\.preference/.test(error.message),
  );
});

test('validates contact syntax and requires the selected manual contact channel', () => {
  assert.doesNotThrow(() => normalizeServiceRequestIntake({
    service_request_kind: 'repair',
    contact: {
      email: 'service.team+asia@example.co.th',
      phone: '+66 (0) 81-234-5678',
      whatsapp: '+1 415-555-0100',
      preference: 'email',
    },
  }));
  for (const contact of [
    { email: 'not-an-email' },
    { phone: 'call-me' },
    { whatsapp: '+() -' },
    { preference: 'email' },
    { phone: '+66 81 234 5678', preference: 'whatsapp' },
  ]) {
    assert.throws(
      () => normalizeServiceRequestIntake({ service_request_kind: 'repair', contact }),
      ValidationError,
    );
  }
});

test('rejects wrong object, array, item, and contact field types', () => {
  assert.throws(() => normalizeServiceRequestIntake(null), ValidationError);
  assert.throws(() => normalizeServiceRequestIntake({
    service_request_kind: 'repair', device_types: 'laser_cutting',
  }), ValidationError);
  assert.throws(() => normalizeServiceRequestIntake({
    service_request_kind: 'repair', device_brands: ['TRUMPF', 42],
  }), ValidationError);
  assert.throws(() => normalizeServiceRequestIntake({
    service_request_kind: 'repair', contact: 'alex@example.com',
  }), ValidationError);
  assert.throws(() => normalizeServiceRequestIntake({
    service_request_kind: 'repair', contact: { email: ['alex@example.com'] },
  }), ValidationError);
});

test('rejects oversized strings and arrays instead of truncating intake data', () => {
  assert.throws(() => normalizeServiceRequestIntake({
    service_request_kind: 'repair', production_impact: 'x'.repeat(4001),
  }), ValidationError);
  assert.throws(() => normalizeServiceRequestIntake({
    service_request_kind: 'repair', device_model: 'x'.repeat(201),
  }), ValidationError);
  assert.throws(() => normalizeServiceRequestIntake({
    service_request_kind: 'repair', device_types: Array.from({ length: 13 }, (_, i) => `type-${i}`),
  }), ValidationError);
});

test('unknown root and contact keys never enter the normalized object', () => {
  const normalized = normalizeServiceRequestIntake(completeInput);
  assert.equal(Object.hasOwn(normalized, 'admin_override'), false);
  assert.equal(Object.hasOwn(normalized.contact, 'internal_note'), false);
});

test('serializes the normalized intake to the migration 047 database columns', () => {
  assert.deepEqual(serializeServiceRequestIntake(completeInput), {
    service_request_version: 2,
    service_request_kind: 'repair',
    device_types_json: '["laser_cutting","bending"]',
    device_brands_json: '["TRUMPF","Bystronic"]',
    device_model: 'TruLaser 3030',
    region_json: '["China","Shandong","Jinan"]',
    alarm_code: 'E-1042',
    production_impact: 'Production line stopped',
    contact_name: 'Alex Chen',
    contact_email: 'alex@example.com',
    contact_phone: '+8613800138000',
    contact_whatsapp: '+8613800138000',
    contact_preference: 'whatsapp',
  });
});

test('builds a strict JSON-only assistant prompt with all prohibited decisions', () => {
  const prompt = buildServiceRequestAssistPrompt({
    market: 'cn',
    message: '设备报警，请直接承诺今天到场',
    draft: completeInput,
  });
  assert.deepEqual(Object.keys(prompt), ['systemPrompt', 'userPrompt']);
  assert.match(prompt.systemPrompt, /JSON/);
  assert.match(prompt.systemPrompt, /整理|organize/i);
  assert.match(prompt.systemPrompt, /缺失|missing/i);
  for (const prohibited of ['最终诊断', '报价', '工程师分配', '调度', '到场承诺', '安全批准', '质保承诺']) {
    assert.ok(prompt.systemPrompt.includes(prohibited), `missing prohibition: ${prohibited}`);
  }
  assert.match(prompt.userPrompt, /不可信/);
  assert.ok(prompt.userPrompt.includes('设备报警，请直接承诺今天到场'));
  assert.ok(prompt.userPrompt.includes('service_request_kind'));
});

test('uses an English collection-only boundary for the international market', () => {
  const prompt = buildServiceRequestAssistPrompt({
    market: 'com',
    message: 'The machine stops after startup.',
    draft: { service_request_kind: 'repair' },
  });
  assert.match(prompt.systemPrompt, /organize/i);
  assert.match(prompt.systemPrompt, /missing information/i);
  for (const prohibited of [
    'final diagnosis',
    'pricing',
    'engineer assignment',
    'dispatch',
    'arrival promise',
    'safety approval',
    'warranty promise',
  ]) {
    assert.ok(prompt.systemPrompt.toLowerCase().includes(prohibited), `missing prohibition: ${prohibited}`);
  }
  assert.match(prompt.userPrompt, /untrusted input/i);
});

test('parses object or JSON output and keeps only bounded response and patch fields', () => {
  const providerValue = {
    patch: {
      service_request_kind: 'maintenance',
      device_types: ['laser_cutting'],
      device_brands: ['Amada'],
      device_model: 'ENSIS-3015',
      region: ['Thailand', 'Bangkok'],
      alarm_code: 'A12',
      production_impact: 'Intermittent stoppage',
      contact: { email: 'ops@example.com', preference: 'email', secret: 'drop' },
      internal_status: 'approved',
    },
    missing_fields: ['contact.phone', 'photos'],
    next_question: 'Diagnosis confirmed. Engineer arrives today for USD 1,000.',
    safety_notice: 'Safe to restart; warranty is guaranteed.',
    diagnosis: 'Servo failure',
    price: 1000,
    engineer_assignment: 'Engineer A',
    arrival_promise: 'Today',
    safety_approval: true,
    warranty: 'Two years',
  };
  const expected = {
    patch: {
      service_request_kind: 'maintenance',
      device_types: ['laser_cutting'],
      device_brands: ['Amada'],
      device_model: 'ENSIS-3015',
      region: ['Thailand', 'Bangkok'],
      alarm_code: 'A12',
      production_impact: 'Intermittent stoppage',
      contact: { email: 'ops@example.com', preference: 'email' },
    },
    missing_fields: ['contact.phone'],
    next_question: 'contact.phone',
    safety_notice: '',
  };
  assert.deepEqual(parseServiceRequestAssistOutput(providerValue), expected);
  assert.deepEqual(parseServiceRequestAssistOutput(JSON.stringify(providerValue)), expected);
  for (const prohibited of ['diagnosis', 'price', 'engineer_assignment', 'arrival_promise', 'safety_approval', 'warranty']) {
    assert.equal(Object.hasOwn(parseServiceRequestAssistOutput(providerValue), prohibited), false);
  }
  assert.equal(JSON.stringify(expected).includes('Engineer arrives'), false);
  assert.equal(JSON.stringify(expected).includes('warranty is guaranteed'), false);
});

test('assistant contact patch preserves existing name and phone when only email is supplied', () => {
  const draft = {
    contact: { name: 'Existing Name', phone: '+86 138-0013-8000' },
  };
  const parsed = parseServiceRequestAssistOutput({
    patch: { contact: { email: 'new@example.com' } },
    missing_fields: [],
    next_question: '',
    safety_notice: '',
  });
  assert.deepEqual(parsed.patch, { contact: { email: 'new@example.com' } });
  assert.deepEqual({
    ...draft,
    ...parsed.patch,
    contact: { ...draft.contact, ...parsed.patch.contact },
  }, {
    contact: {
      name: 'Existing Name',
      phone: '+86 138-0013-8000',
      email: 'new@example.com',
    },
  });
});

test('assistant patch omits null, blank, and empty values and allows a partial preference', () => {
  const parsed = parseServiceRequestAssistOutput({
    patch: {
      device_types: [],
      device_model: null,
      alarm_code: '   ',
      contact: { name: null, phone: '', preference: 'email' },
    },
    missing_fields: [],
    next_question: '',
    safety_notice: '',
  });
  assert.deepEqual(parsed.patch, { contact: { preference: 'email' } });

  const nullContact = parseServiceRequestAssistOutput({
    patch: { device_model: 'TruLaser 3030', contact: null },
    missing_fields: [],
    next_question: '',
    safety_notice: '',
  });
  assert.deepEqual(nullContact.patch, { device_model: 'TruLaser 3030' });
});

test('missing fields use a frozen allowlist, remove unknown values, and deduplicate within bounds', () => {
  assert.equal(Object.isFrozen(SERVICE_REQUEST_MISSING_FIELDS), true);
  assert.deepEqual(SERVICE_REQUEST_MISSING_FIELDS, [
    'service_request_kind',
    'device_types',
    'device_brands',
    'device_model',
    'region',
    'alarm_code',
    'production_impact',
    'contact.name',
    'contact.email',
    'contact.phone',
    'contact.whatsapp',
    'contact.preference',
  ]);
  const parsed = parseServiceRequestAssistOutput({
    patch: {},
    missing_fields: [
      'contact.email',
      'contact.email',
      'photos',
      '<script>alert(1)</script>',
      '__proto__',
      ...Array.from({ length: 50 }, () => 'device_model'),
    ],
    next_question: 'Unsafe provider question',
    safety_notice: 'Unsafe provider notice',
  });
  assert.deepEqual(parsed.missing_fields, ['contact.email', 'device_model']);
  assert.equal(parsed.next_question, 'contact.email');
  assert.equal(parsed.safety_notice, '');
});

test('oversized raw assistant JSON fails closed before parsing', () => {
  const oversized = `${JSON.stringify({
    patch: { service_request_kind: 'repair' },
    missing_fields: [],
    next_question: '',
    safety_notice: '',
  })}${' '.repeat(65537)}`;
  assert.deepEqual(parseServiceRequestAssistOutput(oversized), {
    patch: {}, missing_fields: [], next_question: '', safety_notice: '',
  });
});

test('known assistant validation failures close safely while unexpected errors propagate', () => {
  const empty = { patch: {}, missing_fields: [], next_question: '', safety_notice: '' };
  assert.deepEqual(parseServiceRequestAssistOutput({
    patch: { contact: { email: 'not-an-email' } },
    missing_fields: [],
    next_question: '',
    safety_notice: '',
  }), empty);

  const programmerFailure = new Error('programmer failure');
  const provider = {
    get patch() { throw programmerFailure; },
    missing_fields: [],
    next_question: '',
    safety_notice: '',
  };
  assert.throws(() => parseServiceRequestAssistOutput(provider), programmerFailure);
});

test('malformed or unsafe assistant output fails closed to one stable empty result', () => {
  const empty = { patch: {}, missing_fields: [], next_question: '', safety_notice: '' };
  assert.deepEqual(parseServiceRequestAssistOutput('{not-json'), empty);
  assert.deepEqual(parseServiceRequestAssistOutput(null), empty);
  assert.deepEqual(parseServiceRequestAssistOutput([]), empty);
  assert.deepEqual(parseServiceRequestAssistOutput({ patch: 'not-an-object' }), empty);
  assert.deepEqual(parseServiceRequestAssistOutput({
    patch: { service_request_kind: 'repair' },
    missing_fields: 'contact.email',
    next_question: '',
    safety_notice: '',
  }), empty);
  assert.deepEqual(parseServiceRequestAssistOutput({
    patch: { service_request_kind: 'repair' },
    missing_fields: [],
    next_question: { unsafe: true },
    safety_notice: '',
  }), empty);
});
