const VERSION = 2;
const STORAGE_PREFIX = 'sagemro_service_request_draft';
const ARRAY_LIMIT = 12;

const SERVICE_KINDS = new Set([
  'repair',
  'retrofit',
  'relocation',
  'maintenance',
  'used_equipment',
  'parts',
]);
const SERVICE_MODES = new Set(['remote', 'onsite', 'hybrid']);
const URGENCY_LEVELS = new Set(['normal', 'urgent', 'critical']);
const CONTACT_PREFERENCES = new Set(['platform', 'email', 'phone', 'whatsapp']);
const COORDINATE_SYSTEMS = new Set(['wgs84', 'gcj02']);
const CATEGORY_L1_VALUES = new Set([
  'laser_cutting',
  'bending',
  'punching',
  'welding',
  'surface_treatment',
  'auxiliary',
  'cnc_automation',
  'inspection',
  'other',
]);

const SERVICE_KIND_TO_TYPE = Object.freeze({
  repair: 'fault',
  retrofit: 'aftersales',
  relocation: 'aftersales',
  maintenance: 'maintenance',
  used_equipment: 'aftersales',
  parts: 'parts',
});

const LIMITS = Object.freeze({
  category: 50,
  type: 100,
  brand: 100,
  model: 200,
  region: 200,
  description: 4000,
  name: 50,
  email: 254,
  phone: 20,
  address: 500,
  source: 40,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PHONE_PATTERN = /^[+\d\s().-]+$/u;
const STRICT_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu;

function createSubmissionKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `request-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function emptyDraft() {
  return {
    version: VERSION,
    submission_key: createSubmissionKey(),
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
    service_location: {
      address: '',
      latitude: null,
      longitude: null,
      accuracy_m: null,
      coordinate_system: 'wgs84',
      source: 'customer_browser',
    },
    urgency: 'normal',
    contact: {
      name: '',
      email: '',
      phone: '',
      whatsapp: '',
      preference: 'platform',
    },
    files: [],
  };
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cleanString(value, limit, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, limit);
}

function cleanOriginalText(value, limit) {
  if (typeof value !== 'string') return '';
  return value.slice(0, limit);
}

function cleanStringArray(value, itemLimit) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const item of value) {
    if (result.length >= ARRAY_LIMIT) break;
    const normalized = cleanString(item, itemLimit);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function cleanNumber(value, minimum, maximum) {
  let number;
  if (typeof value === 'number') {
    number = value;
  } else if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized || !STRICT_NUMBER_PATTERN.test(normalized)) return null;
    number = Number(normalized);
  } else {
    return null;
  }
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function cleanFiles(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((file) => {
    if (typeof Blob !== 'undefined' && file instanceof Blob) return true;
    return isPlainObject(file)
      && typeof file.name === 'string'
      && Number.isFinite(file.size)
      && typeof file.type === 'string';
  }).slice(0, ARRAY_LIMIT);
}

function marketKey(market) {
  if (typeof market !== 'string') return null;
  const normalizedMarket = market.trim().toLowerCase();
  if (normalizedMarket !== 'com' && normalizedMarket !== 'cn') return null;
  return `${STORAGE_PREFIX}:${normalizedMarket}:v${VERSION}`;
}

function hasValidCoordinatePair(location) {
  return location.latitude !== null
    && location.longitude !== null
    && location.latitude >= -90
    && location.latitude <= 90
    && location.longitude >= -180
    && location.longitude <= 180;
}

function isStoredDraftShape(value) {
  return isPlainObject(value)
    && value.version === VERSION
    && ['manual', 'ai'].includes(value.mode)
    && Number.isInteger(value.step)
    && value.step >= 1
    && value.step <= 4
    && typeof value.service_kind === 'string'
    && typeof value.category_l1 === 'string'
    && typeof value.category_l2 === 'string'
    && Array.isArray(value.device_types)
    && Array.isArray(value.device_brands)
    && typeof value.device_model === 'string'
    && typeof value.alarm_code === 'string'
    && typeof value.description === 'string'
    && typeof value.production_impact === 'string'
    && typeof value.service_mode === 'string'
    && Array.isArray(value.region)
    && isPlainObject(value.service_location)
    && typeof value.urgency === 'string'
    && isPlainObject(value.contact);
}

export function createEmptyServiceRequestDraft({ locale, mode = 'manual', presets = {} } = {}) {
  void locale;
  const safePresets = isPlainObject(presets) ? presets : {};
  return normalizeServiceRequestDraft({
    ...emptyDraft(),
    ...safePresets,
    mode,
    step: 1,
  });
}

export function mergeServiceRequestEntryPresets(draft, { mode = 'manual', presets = {} } = {}) {
  const current = normalizeServiceRequestDraft(draft);
  const safePresets = isPlainObject(presets) ? presets : {};
  const presetDraft = createEmptyServiceRequestDraft({ mode, presets: safePresets });
  return normalizeServiceRequestDraft({
    ...current,
    mode,
    service_kind: current.service_kind || presetDraft.service_kind,
    device_brands: current.device_brands.length
      ? current.device_brands
      : presetDraft.device_brands,
  });
}

export function normalizeServiceRequestDraft(value) {
  const source = isPlainObject(value) ? value : {};
  const base = emptyDraft();
  const rawLocation = isPlainObject(source.service_location) ? source.service_location : {};
  const rawContact = isPlainObject(source.contact) ? source.contact : {};
  const rawMode = cleanString(source.mode, 20);
  const rawServiceKind = cleanString(source.service_kind, LIMITS.type);
  const rawCategoryL1 = cleanString(source.category_l1, LIMITS.category);
  const rawServiceMode = cleanString(source.service_mode, LIMITS.type);
  const rawUrgency = cleanString(source.urgency, LIMITS.type);
  const rawPreference = cleanString(rawContact.preference, LIMITS.type);
  const rawCoordinateSystem = cleanString(rawLocation.coordinate_system, LIMITS.type).toLowerCase();
  const numericStep = Number(source.step);

  return {
    version: VERSION,
    submission_key: cleanString(source.submission_key, 100) || base.submission_key,
    mode: rawMode === 'ai' ? 'ai' : 'manual',
    step: Number.isFinite(numericStep) ? Math.min(4, Math.max(1, Math.trunc(numericStep))) : 1,
    service_kind: SERVICE_KINDS.has(rawServiceKind) ? rawServiceKind : '',
    category_l1: CATEGORY_L1_VALUES.has(rawCategoryL1) ? rawCategoryL1 : base.category_l1,
    category_l2: cleanString(source.category_l2, LIMITS.category, base.category_l2) || base.category_l2,
    device_types: cleanStringArray(source.device_types, LIMITS.type),
    device_brands: cleanStringArray(source.device_brands, LIMITS.brand),
    device_model: cleanString(source.device_model, LIMITS.model),
    alarm_code: cleanString(source.alarm_code, LIMITS.type),
    description: cleanOriginalText(source.description, LIMITS.description),
    production_impact: cleanString(source.production_impact, LIMITS.description),
    service_mode: SERVICE_MODES.has(rawServiceMode) ? rawServiceMode : base.service_mode,
    region: cleanStringArray(source.region, LIMITS.region),
    service_location: {
      address: cleanString(rawLocation.address, LIMITS.address),
      latitude: cleanNumber(rawLocation.latitude, -90, 90),
      longitude: cleanNumber(rawLocation.longitude, -180, 180),
      accuracy_m: cleanNumber(rawLocation.accuracy_m, 0, 500),
      coordinate_system: COORDINATE_SYSTEMS.has(rawCoordinateSystem)
        ? rawCoordinateSystem
        : base.service_location.coordinate_system,
      source: cleanString(rawLocation.source, LIMITS.source, base.service_location.source)
        || base.service_location.source,
    },
    urgency: URGENCY_LEVELS.has(rawUrgency) ? rawUrgency : base.urgency,
    contact: {
      name: cleanString(rawContact.name, LIMITS.name),
      email: cleanString(rawContact.email, LIMITS.email),
      phone: cleanString(rawContact.phone, LIMITS.phone),
      whatsapp: cleanString(rawContact.whatsapp, LIMITS.phone),
      preference: CONTACT_PREFERENCES.has(rawPreference) ? rawPreference : base.contact.preference,
    },
    files: cleanFiles(source.files),
  };
}

export function validateServiceRequestStep(draft, step) {
  const source = isPlainObject(draft) ? draft : {};
  const normalized = normalizeServiceRequestDraft(source);
  const errors = {};

  if (step === 1) {
    if (!SERVICE_KINDS.has(source.service_kind)) errors.service_kind = 'required';
  } else if (step === 2) {
    if (normalized.device_types.length === 0) errors.device_types = 'required';
    if (!normalized.description.trim()) errors.description = 'required';
  } else if (step === 3) {
    if (!SERVICE_MODES.has(source.service_mode)) errors.service_mode = 'invalid';
    if (normalized.region.length === 0) errors.region = 'required';
    if (source.service_mode === 'onsite'
      && (!normalized.service_location.address || !hasValidCoordinatePair(normalized.service_location))) {
      errors.service_location = 'required';
    }
  } else if (step === 4) {
    const { contact } = normalized;
    if (!contact.name) errors['contact.name'] = 'required';

    const hasEmail = Boolean(contact.email);
    const hasPhone = Boolean(contact.phone);
    const hasWhatsapp = Boolean(contact.whatsapp);
    if (!hasEmail && !hasPhone && !hasWhatsapp) errors['contact.channel'] = 'required';
    if (hasEmail && !EMAIL_PATTERN.test(contact.email)) errors['contact.email'] = 'invalid';
    if (hasPhone && (!PHONE_PATTERN.test(contact.phone) || !/\d/u.test(contact.phone))) {
      errors['contact.phone'] = 'invalid';
    }
    if (hasWhatsapp && (!PHONE_PATTERN.test(contact.whatsapp) || !/\d/u.test(contact.whatsapp))) {
      errors['contact.whatsapp'] = 'invalid';
    }

    const rawPreference = source.contact?.preference;
    if (!CONTACT_PREFERENCES.has(rawPreference)) {
      errors['contact.preference'] = 'invalid';
    } else if (rawPreference !== 'platform' && !contact[rawPreference]) {
      errors[`contact.${rawPreference}`] = 'required';
    }
  } else {
    errors.step = 'invalid';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function loadServiceRequestDraft(storage, market) {
  const fallback = createEmptyServiceRequestDraft({});
  const key = marketKey(market);
  if (!key || typeof storage?.getItem !== 'function') return fallback;
  try {
    const stored = storage.getItem(key);
    if (stored === null || stored === undefined) return fallback;
    const parsed = JSON.parse(stored);
    if (!isStoredDraftShape(parsed)) {
      storage?.removeItem?.(key);
      return fallback;
    }
    return { ...normalizeServiceRequestDraft(parsed), files: [] };
  } catch {
    clearServiceRequestDraft(storage, market);
    return fallback;
  }
}

export function saveServiceRequestDraft(storage, market, draft) {
  const key = marketKey(market);
  if (!key || typeof storage?.setItem !== 'function') return false;
  const { files: _files, ...persisted } = normalizeServiceRequestDraft(draft);
  try {
    storage.setItem(key, JSON.stringify(persisted));
    return true;
  } catch {
    return false;
  }
}

export function clearServiceRequestDraft(storage, market) {
  const key = marketKey(market);
  if (!key || typeof storage?.removeItem !== 'function') return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function toWorkOrderPayload(draft, conversationId) {
  const normalized = normalizeServiceRequestDraft(draft);
  if (!SERVICE_KINDS.has(normalized.service_kind)) {
    throw new Error('service_request_kind_invalid');
  }
  const payload = {
    idempotency_key: normalized.submission_key,
    type: SERVICE_KIND_TO_TYPE[normalized.service_kind],
    description: normalized.description,
    urgency: normalized.urgency,
    category_l1: normalized.category_l1,
    category_l2: normalized.category_l2,
    service_mode: normalized.service_mode,
    service_address: normalized.service_location.address,
    service_latitude: normalized.service_location.latitude,
    service_longitude: normalized.service_location.longitude,
    service_accuracy_m: normalized.service_location.accuracy_m,
    service_coordinate_system: normalized.service_location.coordinate_system,
    service_location_source: normalized.service_location.source,
    intake: {
      service_request_kind: normalized.service_kind,
      device_types: normalized.device_types,
      device_brands: normalized.device_brands,
      device_model: normalized.device_model,
      region: normalized.region,
      alarm_code: normalized.alarm_code,
      production_impact: normalized.production_impact,
      contact: normalized.contact,
    },
  };
  const normalizedConversationId = cleanString(conversationId, 100);
  if (normalizedConversationId) payload.conversation_id = normalizedConversationId;
  return payload;
}
