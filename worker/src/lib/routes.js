const TEST_ROUTE_PREFIXES = Object.freeze([
  '/api/test-',
  '/api/debug-',
]);

export function isTestRoute(path) {
  return TEST_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix))
    || path === '/api/init-test-data'
    || path === '/api/init-db'
    || path === '/api/clear-test-data';
}

export function isKnownProtectedRoute(path) {
  return path.startsWith('/api/admin/')
    || path === '/api/material-requests'
    || path === '/api/upsell-requests'
    || path === '/api/upsell-requests/mine'
    || path === '/api/leads/machine'
    || path === '/api/conversations'
    || path.startsWith('/api/conversations/')
    || path === '/api/materials'
    || path === '/api/location/search'
    || path === '/api/workorders'
    || path.startsWith('/api/workorders/')
    || path === '/api/devices'
    || path.startsWith('/api/devices/')
    || path === '/api/notifications'
    || path.startsWith('/api/notifications/')
    || path.startsWith('/api/engineers/')
    || path === '/api/push-subscription'
    || path === '/api/platform-ratings'
    || path === '/api/customer-ratings'
    || path === '/api/customers/profile'
    || path === '/api/customers/push-subscription'
    || /^\/api\/customers\/[^/]+\/reviews$/.test(path)
    || path === '/api/auth/change-password';
}
