const CONTACT_PLACEHOLDER = 'XXX';

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PLUS_PHONE_PATTERN = /\+\d[\d\s().-]{6,}\d/g;
const CN_PHONE_PATTERN = /(?<!\d)1[3-9]\d{9}(?!\d)/g;

function replaceWithPlaceholder(match) {
  const digitCount = String(match || '').replace(/\D/g, '').length;
  if (digitCount > 0 && digitCount < 8) return match;
  return 'XXX';
}

export function redactContactInfo(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(EMAIL_PATTERN, () => CONTACT_PLACEHOLDER)
    .replace(PLUS_PHONE_PATTERN, replaceWithPlaceholder)
    .replace(CN_PHONE_PATTERN, () => CONTACT_PLACEHOLDER);
}

export function canEngineerViewCustomerContact(status) {
  return ['in_service', 'resolved', 'pending_review', 'completed'].includes(status);
}
