export const SERVICE_MODES = new Set(['remote', 'onsite', 'hybrid']);

export function normalizeServiceMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return SERVICE_MODES.has(mode) ? mode : 'remote';
}

export function requiresArrivalVerification(serviceMode) {
  return normalizeServiceMode(serviceMode) === 'onsite';
}
