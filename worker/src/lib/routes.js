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

// 受保护路由白名单：必须与 index.js 里 routeRequest 的已登录分支保持同步。
// 系统已裁剪为主站（营销页）/ AI 门户 / 知识中枢 / 工程师招募页，
// 工单、物料、客户管理、商务、评价、设备、通知等接口已下架，不要在这里恢复。
export function isKnownProtectedRoute(path) {
  return path.startsWith('/api/admin/')
    || path === '/api/conversations'
    || path.startsWith('/api/conversations/')
    || path === '/api/auth/change-password';
}
