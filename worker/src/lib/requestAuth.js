import { credentialVersion, verifyJwt } from './auth.js';
import { hydrateStaffAuth } from './businessIdentity.js';
import {
  expectedPortalRole,
  parseCookies,
  sessionCookieName,
  validateCsrfRequest,
} from './session.js';

export function isProductionSession(request, env) {
  return env.ENVIRONMENT !== 'development' && new URL(request.url).protocol === 'https:';
}

export function requestPortalRole(request) {
  return expectedPortalRole(request.headers.get('Origin'))
    || expectedPortalRole(request.headers.get('Referer'));
}

export async function authenticateRequest(request, env) {
  try {
    return await readRequestSession(request, env);
  } catch {
    throw Object.assign(new Error('Authentication temporarily unavailable. Please try again.'), { code: 'SESSION_AUTH_UNAVAILABLE' });
  }
}

async function readRequestSession(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7), env.JWT_SECRET);
    return authenticateSession(payload, 'bearer', env);
  }

  const role = requestPortalRole(request);
  if (!role) return null;
  const production = isProductionSession(request, env);
  const token = parseCookies(request.headers.get('Cookie'))[sessionCookieName(role, { production })];
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || payload.userType !== role) return null;
  return authenticateSession(payload, 'cookie', env);
}

async function authenticateSession(payload, authMethod, env) {
  const market = env.SESSION_MARKET || 'com';
  if (!payload?.cv || payload.market !== market || !payload.userId
    || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  let credential;
  if (payload.userType === 'admin' && !payload.staffId) {
    if (payload.userId !== 'admin') return null;
    const cn = market === 'cn' && env.ADMIN_PHONE_CN && env.ADMIN_PASSWORD_CN;
    credential = { password_hash: cn ? env.ADMIN_PASSWORD_CN : env.ADMIN_PASSWORD,
      salt: cn ? env.ADMIN_PHONE_CN : env.ADMIN_PHONE };
  } else {
    const table = payload.userType === 'admin' ? 'admin_staff_accounts'
      : payload.userType === 'customer' ? 'customers' : payload.userType === 'engineer' ? 'engineers' : null;
    if (!table || (payload.userType === 'admin' && payload.staffId !== payload.userId)) return null;
    credential = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(payload.userId).first();
    if (!credential || (payload.userType === 'admin' && !credential.is_active)) return null;
  }
  const expected = await credentialVersion(payload, credential, env.JWT_SECRET);
  if (!expected || payload.cv !== expected) return null;
  return hydrateStaffAuth({ ...payload, authMethod }, env, credential);
}

export function hasValidCsrf(request, auth) {
  return validateCsrfRequest({
    method: request.method,
    authMethod: auth?.authMethod,
    expected: auth?.csrf,
    provided: request.headers.get('X-CSRF-Token'),
  });
}
