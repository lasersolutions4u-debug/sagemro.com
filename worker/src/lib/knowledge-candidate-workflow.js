import { countPII, redactPII } from './redact.js';

export const KNOWLEDGE_CATEGORIES = new Set([
  'fault',
  'cutting_parameters',
  'parts',
  'maintenance',
  'machine_selection',
  'health',
  'safety',
  'other',
]);

export const CURRENT_ADMIN_CANDIDATE_CAPABILITIES = ['operations', 'technical_review'];

const DISPLAY_REDACTIONS = [
  {
    pattern: /((?:customer\s+company|customer|company|contact(?:\s+person)?|customer\s+name|联系人|客户公司|客户名称|客户|公司)\s*[:：]\s*)[^;；\n]+/gi,
    placeholder: '[REDACTED CUSTOMER]',
  },
  {
    pattern: /((?:address|customer\s+address|company\s+address|客户地址|公司地址|地址)\s*[:：]\s*)[^;；\n]+/gi,
    placeholder: '[REDACTED ADDRESS]',
  },
  {
    pattern: /((?:phone|tel(?:ephone)?|mobile|whats?app|call|联系电话|电话|手机)\s*[:：]\s*)(?:\+\d{1,3}[\s.-]*)?(?:\(\d{2,4}\)|\d{2,5})[\d\s().-]{4,}\d/gi,
    placeholder: '[REDACTED CONTACT]',
  },
  {
    pattern: /((?:e-?mail|邮箱)\s*[:：]\s*)[^\s;；\n]+/gi,
    placeholder: '[REDACTED CONTACT]',
  },
  {
    pattern: /((?:quote(?:d)?(?:\s+(?:price|amount))?|price|amount|cost|报价|价格|金额|费用)\s*[:：]\s*)[^;；\n]+/gi,
    placeholder: '[REDACTED COMMERCIAL]',
  },
];

const INTERNATIONAL_PHONE = /\+\d{1,3}(?:[\s().-]*\d){7,14}/g;
const LOCAL_CONTEXT_PHONE = /((?:call(?:\s+me)?(?:\s+at)?|phone|tel(?:ephone)?|mobile|whats?app|contact\s+me(?:\s+at)?)\s*[:,-]?\s*)(?:\(?\d{2,4}\)?(?:[\s.-]*\d){6,10})/gi;
const TECHNICAL_NUMBER_CONTEXT = /(?:part(?:\s+code)?|model|power(?:\s+correction)?|calibration(?:\s+offset)?|offset|voltage|connector|code)\s*$/i;
const CURRENCY_AMOUNT = /(?:[$€£¥]\s*[\d,]+(?:\.\d+)?|(?:USD|EUR|GBP|CNY|RMB|人民币|美元|欧元|英镑)\s*[\d,]+(?:\.\d+)?(?:\s*元)?|[\d,]+(?:\.\d+)?\s*(?:dollars?|euros?|pounds?|yuan|元))/gi;
const ENGLISH_STREET_ADDRESS = /\b\d{1,6}[A-Za-z]?\s+(?:[\p{L}0-9.'-]+\s+){0,4}(?:Street|Road|Avenue|Lane|Drive|Boulevard|Way)\b(?:,\s*[\p{L}][\p{L} '-]{1,40}?)?(?=\s*(?:[.;\n]|$|\b(?:Model|Alarm|Voltage|Part|Code|Power|Connector)\b))/giu;
const CHINESE_STREET_ADDRESS = /[\u4e00-\u9fff]{2,}(?:省|市|自治区)[\u4e00-\u9fff\d]+(?:区|县)[\u4e00-\u9fff\d]+(?:路|街|道|巷|弄)\d*号?/g;
const UNCERTAIN_SENSITIVE_SIGNAL = /\b(?:customer\s+(?:is|was)|contact\s+(?:is|was)|located\s+at|ship\s+to|paid|payment|quote|price)\b|(?:联系人|客户是|客户为|客户已支付|收货地址|联系地址)/i;
const LABELED_NATURAL_IDENTITY = /(\b(?:customer|client|contact|company)\b\s*,\s*)([A-Z][\p{L}&'.-]+(?:\s+[A-Z][\p{L}&'.-]+){1,6})(?=\s*[,;.])/giu;
const CONTACT_NATURAL_IDENTITY = /(\bcontact\s+)([A-Z][\p{L}&'.-]+(?:\s+[A-Z][\p{L}&'.-]+){1,4})(?=\s+(?:after|before|for|about|regarding)\b|[,;.])/giu;
const UNRESOLVED_IDENTITY_LINE = /(?:\b(?:customer|client|contact|company)\b|客户|联系人|公司).*(?:\b(?:GmbH|Ltd|Limited|LLC|Inc|Corporation|Corp|PLC)\b|(?:先生|女士|有限公司|集团|公司))/i;

function redactInternationalPhones(line) {
  return line.replace(INTERNATIONAL_PHONE, (match, offset, source) => {
    const prefix = source.slice(Math.max(0, offset - 36), offset);
    return TECHNICAL_NUMBER_CONTEXT.test(prefix) ? match : '[REDACTED CONTACT]';
  });
}

function sanitizeCandidateDisplayLine(line) {
  if (!line) return line;
  let safe = redactPII(line);
  for (const { pattern, placeholder } of DISPLAY_REDACTIONS) {
    pattern.lastIndex = 0;
    safe = safe.replace(pattern, (_match, label) => `${label}${placeholder}`);
  }
  safe = safe.replace(LOCAL_CONTEXT_PHONE, (_match, label) => `${label}[REDACTED CONTACT]`);
  safe = redactInternationalPhones(safe);
  safe = safe.replace(LABELED_NATURAL_IDENTITY, (_match, label) => `${label}[REDACTED CUSTOMER]`);
  safe = safe.replace(CONTACT_NATURAL_IDENTITY, (_match, label) => `${label}[REDACTED CUSTOMER]`);
  safe = safe.replace(
    /(\bcustomer\s+(?:is|was)\s+)(.+?)(?=\s+(?:and|who)\s+(?:paid|pays|contacted)|[.;]|$)/gi,
    (_match, label) => `${label}[REDACTED CUSTOMER]`,
  );
  safe = safe.replace(/((?:联系人|客户联系人)(?:是|为)?)[\u4e00-\u9fffA-Za-z· ]{2,30}(?=[，,。；;]|$)/g, '$1[REDACTED CUSTOMER]');
  safe = safe.replace(CURRENCY_AMOUNT, '[REDACTED COMMERCIAL]');
  if (!/^\s*(?:Model|Part|Code)\b/i.test(safe)) {
    safe = safe.replace(ENGLISH_STREET_ADDRESS, '[REDACTED ADDRESS]');
  }
  safe = safe.replace(CHINESE_STREET_ADDRESS, '[REDACTED ADDRESS]');

  if (UNRESOLVED_IDENTITY_LINE.test(safe) && !/customer-reported/i.test(safe)) {
    return '[SENSITIVE LINE REDACTED]';
  }

  const unresolvedPhone = /\+\d{1,3}(?:[\s().-]*\d){7,14}/.test(safe);
  const unresolvedAddress = /\b\d{1,6}\s+[^\n,;]{2,50}(?:Street|Road|Avenue|Lane|Drive)\b|(?:省|市|区|县)[^\n，。；]{2,50}(?:路|街|道|号)/i.test(safe);
  const unresolvedMoney = /(?:USD|EUR|GBP|CNY|RMB|人民币|美元|欧元|英镑)\s*\d|\d+(?:\.\d+)?\s*元/i.test(safe);
  if (UNCERTAIN_SENSITIVE_SIGNAL.test(safe) && (unresolvedPhone || unresolvedAddress || unresolvedMoney)) {
    return '[SENSITIVE LINE REDACTED]';
  }
  return safe;
}

export function sanitizeCandidateRawContent(rawContent) {
  if (typeof rawContent !== 'string' || !rawContent) return '';
  return rawContent.split('\n').map(sanitizeCandidateDisplayLine).join('\n');
}

const SENSITIVE_FIELDS = ['title', 'sanitized_content', 'equipment_type', 'brand', 'model', 'evidence_notes', 'alarm_codes_json'];
const LABELED_PHONE = /(?:\b(?:phone|tel|telephone|mobile|whats?app|call)\b|联系电话|电话|手机)\s*[:：]?\s*(?:\+\d{1,3}[\s.-]*)?(?:\(\d{2,4}\)|\d{2,5})[\d\s().-]{4,}\d/i;
const LABELED_ADDRESS = /\b(?:address|customer address|company address)\b\s*[:：]\s*\S.+/i;
const LABELED_IDENTITY = /\b(?:customer|customer company|company)\b\s*(?:company\s*)?[:：]\s*\S.+/i;
const LABELED_ADDRESS_CN = /(?:客户地址|公司地址|地址)\s*[:：]\s*\S.+/;
const LABELED_IDENTITY_CN = /(?:客户|客户公司|公司)\s*[:：]\s*\S.+/;

const COMMERCIAL_AMOUNT = /(?:\b(?:price|quote(?:d)?(?:\s+amount)?|amount|cost|customer\s+paid|paid)\b|报价|价格|金额|客户已支付)\s*[:：]?\s*(?:[$€£¥]\s*)?(?:(?:USD|EUR|GBP|CNY|RMB|人民币|美元|欧元|英镑)\s*)?[\d,]+(?:\.\d+)?\s*(?:dollars?|euros?|pounds?|yuan|元)?/i;
const STANDALONE_COMMERCIAL_AMOUNT = /(?:\b(?:USD|EUR|GBP|CNY|RMB)\s*[$€£¥]?\s*[\d,]+(?:\.\d+)?\b|[$€£¥]\s*[\d,]+(?:\.\d+)?\b|\b[\d,]+(?:\.\d+)?\s*(?:dollars?|euros?|pounds?|yuan)\b|[\d,]+(?:\.\d+)?\s*元)/i;

function candidateSensitiveFieldValue(field, value) {
  if (field !== 'alarm_codes_json') return typeof value === 'string' ? value : '';
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join('\n');
  if (typeof value !== 'string') return '';
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').join('\n') : value;
  } catch {
    return value;
  }
}

export function detectCandidateSensitiveFields(candidate) {
  const fields = [];
  for (const field of SENSITIVE_FIELDS) {
    const value = candidateSensitiveFieldValue(field, candidate?.[field]);
    if (!value) continue;
    const existingPii = Object.values(countPII(value)).some((count) => count > 0);
    if (
      existingPii
      || LABELED_PHONE.test(value)
      || LABELED_ADDRESS.test(value)
      || LABELED_IDENTITY.test(value)
      || LABELED_ADDRESS_CN.test(value)
      || LABELED_IDENTITY_CN.test(value)
      || COMMERCIAL_AMOUNT.test(value)
      || STANDALONE_COMMERCIAL_AMOUNT.test(value)
    ) {
      fields.push(field);
    }
  }
  return fields.length
    ? { ok: false, error: 'sensitive_content_detected', fields }
    : { ok: true, fields: [] };
}

export function parseCandidatePagination(pageValue, pageSizeValue) {
  const parseBoundedInteger = (value, fallback, min, max) => {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
  };
  const page = parseBoundedInteger(pageValue, 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = parseBoundedInteger(pageSizeValue, 20, 1, 100);
  if (page === null || pageSize === null) return { ok: false, error: 'invalid_pagination' };
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) return { ok: false, error: 'invalid_pagination' };
  return { ok: true, page, pageSize, offset };
}

const ACTIONS = {
  editorial: {
    capability: 'operations',
    transitions: {
      awaiting_operations: 'operations_editing',
      operations_editing: 'operations_editing',
      changes_requested: 'operations_editing',
    },
  },
  submit_review: {
    capability: 'operations',
    transitions: {
      operations_editing: 'awaiting_technical_review',
      changes_requested: 'awaiting_technical_review',
    },
  },
  request_changes: {
    capability: 'technical_review',
    transitions: { awaiting_technical_review: 'changes_requested' },
  },
  approve: {
    capability: 'technical_review',
    transitions: { awaiting_technical_review: 'approved' },
  },
  reject: {
    capability: 'technical_review',
    transitions: {
      awaiting_operations: 'rejected',
      operations_editing: 'rejected',
      awaiting_technical_review: 'rejected',
      changes_requested: 'rejected',
    },
  },
};

const EDITORIAL_FIELDS = new Set([
  'title',
  'category',
  'sanitized_content',
  'equipment_type',
  'brand',
  'model',
  'alarm_codes_json',
  'risk_level',
  'evidence_notes',
  'internal_use_allowed',
  'public_use_allowed',
]);

const STRING_LIMITS = {
  title: 300,
  category: 80,
  sanitized_content: 20000,
  equipment_type: 200,
  brand: 120,
  model: 120,
  evidence_notes: 4000,
};

const RISKS = new Set(['low', 'medium', 'high']);

export function readEditorialCandidate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_payload' };
  }
  const values = {};
  for (const [field, value] of Object.entries(body)) {
    if (!EDITORIAL_FIELDS.has(field)) {
      return { ok: false, error: 'unsupported_field', field };
    }
    if (field === 'internal_use_allowed' || field === 'public_use_allowed') {
      if (typeof value !== 'boolean') return { ok: false, error: 'invalid_field', field };
      values[field] = value ? 1 : 0;
      continue;
    }
    if (field === 'alarm_codes_json') {
      if (!Array.isArray(value)) return { ok: false, error: 'invalid_field', field };
      if (value.length > 50) return { ok: false, error: 'field_too_long', field };
      const codes = [];
      for (const item of value) {
        if (typeof item !== 'string') return { ok: false, error: 'invalid_field', field };
        const code = item.trim();
        if (code.length > 80) return { ok: false, error: 'field_too_long', field };
        if (code && !codes.includes(code)) codes.push(code);
      }
      values[field] = JSON.stringify(codes);
      continue;
    }
    if (field === 'risk_level') {
      if (typeof value !== 'string' || !RISKS.has(value.trim())) {
        return { ok: false, error: 'invalid_field', field };
      }
      values[field] = value.trim();
      continue;
    }
    if (field === 'category') {
      if (typeof value !== 'string' || !KNOWLEDGE_CATEGORIES.has(value.trim())) {
        return { ok: false, error: 'invalid_field', field };
      }
      values[field] = value.trim();
      continue;
    }
    if (typeof value !== 'string') return { ok: false, error: 'invalid_field', field };
    const cleaned = value.trim();
    if (cleaned.length > STRING_LIMITS[field]) return { ok: false, error: 'field_too_long', field };
    values[field] = cleaned;
  }
  return { ok: true, values };
}

export function validateCandidateForReview(candidate) {
  for (const field of ['title', 'category', 'sanitized_content', 'evidence_notes']) {
    if (typeof candidate?.[field] !== 'string' || !candidate[field].trim()) {
      return { ok: false, error: 'required_field', field };
    }
  }
  if (!KNOWLEDGE_CATEGORIES.has(candidate.category)) {
    return { ok: false, error: 'invalid_field', field: 'category' };
  }
  if (!RISKS.has(candidate.risk_level)) {
    return { ok: false, error: 'invalid_field', field: 'risk_level' };
  }
  return { ok: true };
}

export function transitionCandidate({ currentStatus, action, actor, candidate = {} }) {
  const rule = ACTIONS[action];
  if (!rule || !rule.transitions[currentStatus]) {
    return { ok: false, error: 'invalid_transition' };
  }
  if (!actor?.capabilities?.includes(rule.capability)) {
    return { ok: false, error: 'forbidden' };
  }
  if (
    action === 'approve'
    && candidate.risk_level === 'high'
    && actor.type === 'engineer'
    && actor.id === candidate.contributor_engineer_id
  ) {
    return { ok: false, error: 'self_review_forbidden' };
  }
  return { ok: true, nextStatus: rule.transitions[currentStatus] };
}
