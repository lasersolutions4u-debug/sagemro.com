import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearServiceRequestDraft,
  createEmptyServiceRequestDraft,
  loadServiceRequestDraft,
  mergeServiceRequestEntryPresets,
  normalizeServiceRequestDraft,
  saveServiceRequestDraft,
  toWorkOrderPayload,
  validateServiceRequestStep,
} from '../src/components/ServiceRequest/serviceRequestDraft.js';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    values,
  };
}

function validDraft(overrides = {}) {
  return normalizeServiceRequestDraft({
    service_kind: 'repair',
    device_types: ['fiber_laser_cutting_machine'],
    device_brands: ['TRUMPF'],
    device_model: 'TruLaser 3030',
    alarm_code: 'E204',
    description: 'The cutting head stops after homing.',
    production_impact: 'Production is stopped.',
    service_mode: 'remote',
    region: ['United States', 'Illinois'],
    urgency: 'urgent',
    contact: {
      name: 'Alex Example',
      email: 'alex@example.com',
      phone: '+1 312 555 0101',
      whatsapp: '+1 312 555 0102',
      preference: 'email',
    },
    ...overrides,
  });
}

function assertEmptyDraft(actual) {
  assert.match(actual.submission_key, /^(?:[0-9a-f-]{36}|request-[a-z0-9-]+)$/i);
  const { submission_key: _actualKey, ...actualWithoutKey } = actual;
  const { submission_key: _expectedKey, ...expectedWithoutKey } = createEmptyServiceRequestDraft({});
  assert.deepEqual(actualWithoutKey, expectedWithoutKey);
}

test('creates the versioned canonical shape and applies safe presets', () => {
  const draft = createEmptyServiceRequestDraft({
    locale: 'zh-CN',
    mode: 'ai',
    presets: { service_kind: 'maintenance', unknown: 'discard me' },
  });

  assert.match(draft.submission_key, /^(?:[0-9a-f-]{36}|request-[a-z0-9-]+)$/i);
  const { submission_key: _submissionKey, ...draftWithoutSubmissionKey } = draft;

  assert.deepEqual(draftWithoutSubmissionKey, {
    version: 2,
    mode: 'ai',
    step: 1,
    service_kind: 'maintenance',
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
    service_location: {
      address: '', latitude: null, longitude: null, accuracy_m: null,
      coordinate_system: 'wgs84', source: 'customer_browser',
    },
    urgency: 'normal',
    contact: { name: '', email: '', phone: '', whatsapp: '', preference: 'platform' },
    files: [],
  });
  assert.equal('unknown' in draft, false);
  assert.equal('locale' in draft, false);
});

test('entry presets select AI mode and fill an empty brand without overwriting a saved draft', () => {
  const empty = createEmptyServiceRequestDraft();
  const entered = mergeServiceRequestEntryPresets(empty, {
    mode: 'ai',
    presets: { service_kind: 'repair', device_brands: ['TRUMPF'] },
  });
  assert.equal(entered.mode, 'ai');
  assert.equal(entered.service_kind, 'repair');
  assert.deepEqual(entered.device_brands, ['TRUMPF']);

  const saved = validDraft({ service_kind: 'maintenance', device_brands: ['Bystronic'] });
  const preserved = mergeServiceRequestEntryPresets(saved, {
    mode: 'ai',
    presets: { service_kind: 'repair', device_brands: ['TRUMPF'] },
  });
  assert.equal(preserved.mode, 'ai');
  assert.equal(preserved.service_kind, 'maintenance');
  assert.deepEqual(preserved.device_brands, ['Bystronic']);
});

test('normalization is allowlisted and bounded to the server contract', () => {
  const draft = normalizeServiceRequestDraft({
    version: 999,
    mode: 'unsafe',
    step: 99,
    service_kind: 'not-a-kind',
    category_l1: 'x'.repeat(80),
    category_l2: 'y'.repeat(80),
    device_types: [...Array.from({ length: 20 }, (_, index) => ` type-${index} `), 42],
    device_brands: [' B '.repeat(100)],
    device_model: 'm'.repeat(250),
    alarm_code: 'a'.repeat(150),
    description: 'd'.repeat(5000),
    production_impact: 'i'.repeat(5000),
    service_mode: 'teleport',
    region: [' r '.repeat(150)],
    urgency: 'whenever',
    contact: { name: 'n'.repeat(80), phone: '+86 138 0013 8000', preference: 'fax', secret: 'no' },
    service_location: { address: 'z'.repeat(600), latitude: '36.6', longitude: 117.1, evil: true },
    password: 'never-store-me',
  });

  assert.equal(draft.version, 2);
  assert.equal(draft.mode, 'manual');
  assert.equal(draft.step, 4);
  assert.equal(draft.service_kind, '');
  assert.equal(draft.category_l1, 'other');
  assert.equal(draft.category_l2.length, 50);
  assert.equal(draft.device_types.length, 12);
  assert.equal(draft.device_types[0], 'type-0');
  assert.equal(draft.device_brands[0].length, 100);
  assert.equal(draft.device_model.length, 200);
  assert.equal(draft.alarm_code.length, 100);
  assert.equal(draft.description.length, 4000);
  assert.equal(draft.production_impact.length, 4000);
  assert.equal(draft.service_mode, 'remote');
  assert.equal(draft.urgency, 'normal');
  assert.equal(draft.contact.preference, 'platform');
  assert.equal(draft.service_location.latitude, 36.6);
  assert.equal('password' in draft, false);
  assert.equal('secret' in draft.contact, false);
  assert.equal('evil' in draft.service_location, false);
});

test('coordinates accept only finite numbers or strict numeric strings while preserving zero', () => {
  for (const value of [false, true, [], [0], {}, ' ', Number.NaN, Number.POSITIVE_INFINITY]) {
    const draft = normalizeServiceRequestDraft({
      service_location: { latitude: value, longitude: value, accuracy_m: value },
    });
    assert.equal(draft.service_location.latitude, null);
    assert.equal(draft.service_location.longitude, null);
    assert.equal(draft.service_location.accuracy_m, null);
  }

  const zero = normalizeServiceRequestDraft({
    service_location: { latitude: 0, longitude: '0', accuracy_m: '0' },
  });
  assert.deepEqual(
    { latitude: zero.service_location.latitude, longitude: zero.service_location.longitude, accuracy_m: zero.service_location.accuracy_m },
    { latitude: 0, longitude: 0, accuracy_m: 0 },
  );

  const boundaries = normalizeServiceRequestDraft({
    service_location: { latitude: '-90', longitude: 180, accuracy_m: '500' },
  });
  assert.equal(boundaries.service_location.latitude, -90);
  assert.equal(boundaries.service_location.longitude, 180);
  assert.equal(boundaries.service_location.accuracy_m, 500);

  const outside = normalizeServiceRequestDraft({
    service_location: { latitude: -90.01, longitude: '180.01', accuracy_m: 500.01 },
  });
  assert.equal(outside.service_location.latitude, null);
  assert.equal(outside.service_location.longitude, null);
  assert.equal(outside.service_location.accuracy_m, null);
});

test('storage is isolated by market, roundtrips fields, and never serializes files or credentials', () => {
  const storage = createStorage();
  const runtimeFile = { name: 'alarm.jpg', size: 10, type: 'image/jpeg', arrayBuffer() {} };
  const draft = validDraft({ files: [runtimeFile], password: 'not-allowed', verification_code: '123456' });

  saveServiceRequestDraft(storage, 'com', draft);
  saveServiceRequestDraft(storage, 'cn', validDraft({ description: '中文故障描述' }));

  assert.equal(storage.values.has('sagemro_service_request_draft:com:v2'), true);
  assert.equal(storage.values.has('sagemro_service_request_draft:cn:v2'), true);
  const serialized = storage.values.get('sagemro_service_request_draft:com:v2');
  assert.doesNotMatch(serialized, /alarm\.jpg|password|verification_code/);
  assert.deepEqual(loadServiceRequestDraft(storage, 'com'), { ...draft, files: [] });
  assert.equal(loadServiceRequestDraft(storage, 'cn').description, '中文故障描述');

  clearServiceRequestDraft(storage, 'com');
  assert.equal(storage.values.has('sagemro_service_request_draft:com:v2'), false);
  assert.equal(storage.values.has('sagemro_service_request_draft:cn:v2'), true);
});

test('load clears corrupt, old-version, and wrong-shape stored values without throwing', () => {
  for (const value of [
    '{broken',
    JSON.stringify({ version: 1 }),
    JSON.stringify({ version: 2, mode: 'manual', step: 1, device_types: 'not-an-array' }),
  ]) {
    const storage = createStorage();
    const key = 'sagemro_service_request_draft:com:v2';
    storage.setItem(key, value);
    assertEmptyDraft(loadServiceRequestDraft(storage, 'com'));
    assert.equal(storage.getItem(key), null);
  }
});

test('storage helpers fail closed when storage or required methods are unavailable', () => {
  const draft = validDraft();
  assert.equal(saveServiceRequestDraft(undefined, 'com', draft), false);
  assert.equal(saveServiceRequestDraft({}, 'com', draft), false);
  assert.equal(saveServiceRequestDraft({ setItem() { throw new Error('QuotaExceededError'); } }, 'com', draft), false);
  assert.equal(clearServiceRequestDraft(undefined, 'com'), false);
  assert.equal(clearServiceRequestDraft({}, 'com'), false);
  assert.equal(clearServiceRequestDraft({ removeItem() { throw new Error('blocked'); } }, 'com'), false);

  assertEmptyDraft(loadServiceRequestDraft(undefined, 'com'));
  assertEmptyDraft(loadServiceRequestDraft({}, 'com'));
  assertEmptyDraft(loadServiceRequestDraft({ getItem() { throw new Error('blocked'); } }, 'com'));
});

test('invalid markets never read, write, clear, or alias the com draft key', () => {
  const calls = [];
  const storage = {
    getItem(key) { calls.push(['get', key]); return JSON.stringify(validDraft()); },
    setItem(key) { calls.push(['set', key]); },
    removeItem(key) { calls.push(['remove', key]); },
  };

  assertEmptyDraft(loadServiceRequestDraft(storage, 'global'));
  assert.equal(saveServiceRequestDraft(storage, 'global', validDraft()), false);
  assert.equal(clearServiceRequestDraft(storage, 'global'), false);
  assert.deepEqual(calls, []);
});

test('four-step validation returns stable field errors', () => {
  assert.deepEqual(validateServiceRequestStep(createEmptyServiceRequestDraft({}), 1), {
    valid: false,
    errors: { service_kind: 'required' },
  });

  const stepTwo = validDraft({ device_types: [], description: '   ' });
  assert.deepEqual(validateServiceRequestStep(stepTwo, 2), {
    valid: false,
    errors: { device_types: 'required', description: 'required' },
  });

  const stepThree = validDraft({
    service_mode: 'onsite',
    region: [],
    service_location: { address: '', latitude: null, longitude: null },
  });
  assert.deepEqual(validateServiceRequestStep(stepThree, 3), {
    valid: false,
    errors: { region: 'required', service_location: 'required' },
  });

  const stepFour = validDraft({
    contact: { name: '', email: '', phone: '', whatsapp: '', preference: 'whatsapp' },
  });
  assert.deepEqual(validateServiceRequestStep(stepFour, 4), {
    valid: false,
    errors: { 'contact.name': 'required', 'contact.channel': 'required', 'contact.whatsapp': 'required' },
  });
  assert.deepEqual(validateServiceRequestStep(validDraft(), 4), { valid: true, errors: {} });
});

test('onsite reuses the existing address plus coordinate requirement while hybrid can start remotely', () => {
  const missing = validDraft({
    service_mode: 'onsite',
    service_location: { address: 'Chicago', latitude: null, longitude: null },
  });
  assert.equal(validateServiceRequestStep(missing, 3).errors.service_location, 'required');

  const complete = validDraft({
    service_mode: 'onsite',
    service_location: { address: 'Chicago', latitude: 41.8781, longitude: -87.6298, accuracy_m: 20 },
  });
  assert.deepEqual(validateServiceRequestStep(complete, 3), { valid: true, errors: {} });

  const hybrid = validDraft({
    service_mode: 'hybrid',
    service_location: { address: '', latitude: null, longitude: null },
  });
  assert.deepEqual(validateServiceRequestStep(hybrid, 3), { valid: true, errors: {} });
});

test('contact accepts a global phone format and requires the selected channel', () => {
  const phoneOnly = validDraft({
    contact: { name: 'Marta', email: '', phone: '+34 (91) 555-01-02', whatsapp: '', preference: 'phone' },
  });
  assert.deepEqual(validateServiceRequestStep(phoneOnly, 4), { valid: true, errors: {} });

  const missingEmail = validDraft({
    contact: { name: 'Marta', email: '', phone: '+34 915550102', whatsapp: '', preference: 'email' },
  });
  assert.equal(validateServiceRequestStep(missingEmail, 4).errors['contact.email'], 'required');
});

test('all six service kinds map to the existing work-order types without rewriting description', () => {
  const expected = {
    repair: 'fault',
    retrofit: 'aftersales',
    relocation: 'aftersales',
    maintenance: 'maintenance',
    used_equipment: 'aftersales',
    parts: 'parts',
  };

  for (const [service_kind, type] of Object.entries(expected)) {
    const description = `  Original customer text for ${service_kind}\n`;
    const payload = toWorkOrderPayload(validDraft({ service_kind, description }), ' conversation-123 ');
    assert.match(payload.idempotency_key, /\S/);
    assert.equal(payload.type, type);
    assert.equal(payload.description, description);
    assert.equal(payload.conversation_id, 'conversation-123');
    assert.equal(payload.intake.service_request_kind, service_kind);
    assert.equal('files' in payload, false);
  }
});

test('payload creation rejects an empty or invalid service kind with a stable error', () => {
  for (const service_kind of ['', 'unknown']) {
    assert.throws(
      () => toWorkOrderPayload({ ...validDraft(), service_kind }),
      (error) => error instanceof Error && error.message === 'service_request_kind_invalid',
    );
  }
});

test('payload carries structured intake and location but omits empty conversation id and unknown keys', () => {
  const draft = validDraft({
    service_location: {
      address: '233 S Wacker Dr, Chicago',
      latitude: 41.8789,
      longitude: -87.6359,
      accuracy_m: 12,
      coordinate_system: 'wgs84',
      source: 'customer_browser',
    },
    unexpected: 'do-not-send',
  });
  const payload = toWorkOrderPayload(draft, '   ');

  assert.deepEqual(payload.intake, {
    service_request_kind: 'repair',
    device_types: ['fiber_laser_cutting_machine'],
    device_brands: ['TRUMPF'],
    device_model: 'TruLaser 3030',
    region: ['United States', 'Illinois'],
    alarm_code: 'E204',
    production_impact: 'Production is stopped.',
    contact: {
      name: 'Alex Example', email: 'alex@example.com', phone: '+1 312 555 0101',
      whatsapp: '+1 312 555 0102', preference: 'email',
    },
  });
  assert.equal(payload.service_address, '233 S Wacker Dr, Chicago');
  assert.equal(payload.service_latitude, 41.8789);
  assert.equal(payload.service_longitude, -87.6359);
  assert.equal(payload.service_accuracy_m, 12);
  assert.equal(payload.service_coordinate_system, 'wgs84');
  assert.equal(payload.service_location_source, 'customer_browser');
  assert.equal('conversation_id' in payload, false);
  assert.equal('unexpected' in payload, false);
});
