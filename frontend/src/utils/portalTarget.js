const PUBLIC_HOSTS = new Set(['sagemro.com', 'www.sagemro.com', 'sagemro.cn', 'www.sagemro.cn']);
const CUSTOMER_HOSTS = new Set(['ai.sagemro.com', 'ai.sagemro.cn']);
const ENGINEER_HOSTS = new Set(['engineer.sagemro.com', 'engineer.sagemro.cn']);
const LOCAL_CUSTOMER_HOSTS = new Set(['customer.127.0.0.1.nip.io']);
const LOCAL_ENGINEER_HOSTS = new Set(['engineer.127.0.0.1.nip.io']);
const SERVICE_REQUEST_PRESET_KEYS = ['mode', 'service', 'brand', 'source'];

export function resolvePortalTarget({ buildTarget = 'public', hostname = '' } = {}) {
  const host = String(hostname).toLowerCase().replace(/\.$/, '');
  if (ENGINEER_HOSTS.has(host) || LOCAL_ENGINEER_HOSTS.has(host)) return 'engineer';
  if (buildTarget === 'portal' && (CUSTOMER_HOSTS.has(host) || LOCAL_CUSTOMER_HOSTS.has(host))) return 'customer';
  if (buildTarget === 'public' && PUBLIC_HOSTS.has(host)) return 'public';
  if (host === 'localhost' || host === '127.0.0.1' || host === '') return buildTarget === 'portal' ? 'customer' : 'public';
  return 'blocked';
}

export function getCustomerPortalOrigin({ market, hostname = '' } = {}) {
  const host = String(hostname).toLowerCase().replace(/\.$/, '');
  const useCn = market === 'cn' || (!market && (host === 'sagemro.cn' || host.endsWith('.sagemro.cn')));
  return useCn ? 'https://ai.sagemro.cn' : 'https://ai.sagemro.com';
}

export function buildCustomerPortalUrl({ path = '/service-request', market, hostname, presets = {} } = {}) {
  const url = new URL(path, getCustomerPortalOrigin({ market, hostname }));
  for (const key of SERVICE_REQUEST_PRESET_KEYS) {
    const value = presets?.[key];
    if (typeof value !== 'string') continue;
    const normalized = value.trim().slice(0, 120);
    if (normalized) url.searchParams.set(key, normalized);
  }
  return url.toString();
}

export function parseServiceRequestEntry(search = '', { resolveBrand } = {}) {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  const requestedMode = params.get('mode');
  const mode = requestedMode === 'assist' || requestedMode === 'ai' ? 'ai' : 'manual';
  const service = params.get('service');
  const brandSlug = params.get('brand');
  const serviceKind = ['repair', 'retrofit', 'relocation', 'maintenance', 'used_equipment', 'parts']
    .includes(service) ? service : '';
  const brandName = /^[a-z0-9-]{1,100}$/.test(brandSlug || '')
    ? resolveBrand?.(brandSlug)
    : '';
  return {
    mode,
    presets: {
      ...(serviceKind ? { service_kind: serviceKind } : {}),
      ...(brandName ? { device_brands: [String(brandName).slice(0, 100)] } : {}),
    },
  };
}
