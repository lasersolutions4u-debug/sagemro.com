function currentHostname() {
  if (typeof window === 'undefined') return '';
  return window.location.hostname || '';
}

function normalizeHostname(hostname = currentHostname()) {
  return String(hostname || '').toLowerCase().split(':')[0];
}

export function resolveRuntimeConfig(hostname = currentHostname(), env = {}) {
  const normalized = normalizeHostname(hostname);
  const market = normalized.endsWith('.cn') ? 'cn' : 'com';

  return {
    market,
    portal: 'admin',
    locale: market === 'cn' ? 'zh-CN' : 'en',
    documentTitle: market === 'cn' ? 'SAGEMRO 运营中枢' : 'SAGEMRO Operations Console',
    apiBase: env.VITE_API_BASE || (market === 'cn' ? 'https://api.sagemro.cn' : 'https://api.sagemro.com'),
  };
}

export const runtimeConfig = resolveRuntimeConfig(currentHostname(), import.meta.env || {});
