const SESSION_COOKIE_NAMES = Object.freeze({
  customer: 'sagemro_customer_session',
  engineer: 'sagemro_engineer_session',
  admin: 'sagemro_admin_session',
});

export function expectedPortalRole(origin) {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'engineer.sagemro.com' || hostname === 'engineer.sagemro.cn'
      || hostname === 'engineer.localhost' || hostname === 'engineer.127.0.0.1.nip.io') return 'engineer';
    if (hostname === 'admin.sagemro.com' || hostname === 'admin.sagemro.cn'
      || hostname === 'admin.127.0.0.1.nip.io') return 'admin';
    if (hostname === 'customer.127.0.0.1.nip.io') return 'customer';
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = url.port;
      if (port === '4274' || port === '5174') return 'admin';
      return 'customer';
    }
    if (hostname === 'sagemro.com' || hostname === 'www.sagemro.com') return 'customer';
    if (hostname === 'sagemro.cn' || hostname === 'www.sagemro.cn') return 'customer';
    return null;
  } catch {
    return null;
  }
}

export function sessionResponsePayload(payload, token, portalRole) {
  return portalRole ? payload : { ...payload, token };
}

export function generateCsrfToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function sessionCookieName(role, { production = true } = {}) {
  const name = SESSION_COOKIE_NAMES[role];
  if (!name) throw new Error(`Unsupported session role: ${role}`);
  return production ? `__Host-${name}` : name;
}

function cookieAttributes({ production, maxAge }) {
  const attributes = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (production) attributes.push('Secure');
  return attributes.join('; ');
}

export function buildSessionCookie(role, token, { production = true, maxAge = 7 * 24 * 60 * 60 } = {}) {
  return `${sessionCookieName(role, { production })}=${encodeURIComponent(token)}; ${cookieAttributes({ production, maxAge })}`;
}

export function clearSessionCookie(role, { production = true } = {}) {
  return `${sessionCookieName(role, { production })}=; ${cookieAttributes({ production, maxAge: 0 })}`;
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (!name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

export function validateCsrfRequest({ method, authMethod, expected, provided }) {
  if (authMethod !== 'cookie') return true;
  if (['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase())) return true;
  return Boolean(expected && provided && expected === provided);
}
