import { verifyJwt } from './auth.js';
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
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwt(authHeader.slice(7), env.JWT_SECRET);
    return hydrateStaffAuth(payload ? { ...payload, authMethod: 'bearer' } : null, env);
  }

  const role = requestPortalRole(request);
  if (!role) return null;
  const production = isProductionSession(request, env);
  const token = parseCookies(request.headers.get('Cookie'))[sessionCookieName(role, { production })];
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || payload.userType !== role) return null;
  return hydrateStaffAuth({ ...payload, authMethod: 'cookie' }, env);
}

export function hasValidCsrf(request, auth) {
  return validateCsrfRequest({
    method: request.method,
    authMethod: auth?.authMethod,
    expected: auth?.csrf,
    provided: request.headers.get('X-CSRF-Token'),
  });
}
