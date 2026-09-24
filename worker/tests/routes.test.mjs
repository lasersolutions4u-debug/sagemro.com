import test from 'node:test';
import assert from 'node:assert/strict';
import { isKnownProtectedRoute, isTestRoute } from '../src/lib/routes.js';

// 系统已裁剪为主站（营销页）/ AI 门户 / 知识中枢 / 工程师招募页，
// 白名单只保留仍存在的已登录接口。
test('test route classifier covers development-only diagnostics', () => {
  assert.equal(isTestRoute('/api/test-full-flow'), true);
  assert.equal(isTestRoute('/api/debug-engineers'), true);
  assert.equal(isTestRoute('/api/init-test-data'), true);
  assert.equal(isTestRoute('/api/init-db'), true);
  assert.equal(isTestRoute('/api/clear-test-data'), true);
  assert.equal(isTestRoute('/api/conversations'), false);
});

test('protected route classifier covers exactly the kept authenticated paths', () => {
  assert.equal(isKnownProtectedRoute('/api/admin/stats'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/staff'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/users'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/users/user-1'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/knowledge'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/knowledge/article-1'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/knowledge-candidates'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/knowledge-candidates/candidate-1/approve'), true);
  assert.equal(isKnownProtectedRoute('/api/conversations'), true);
  assert.equal(isKnownProtectedRoute('/api/conversations/conversation-1'), true);
  assert.equal(isKnownProtectedRoute('/api/auth/change-password'), true);
});

test('retired feature routes are no longer protected because they no longer exist', () => {
  for (const path of [
    '/api/workorders',
    '/api/workorders/work-order-1/messages',
    '/api/material-requisitions/metrics',
    '/api/devices',
    '/api/notifications',
    '/api/inbox',
    '/api/customers/customer-1/reviews',
    '/api/chat',
    '/api/not-a-route',
  ]) {
    assert.equal(isKnownProtectedRoute(path), false, `${path} should no longer be an authenticated route`);
  }
});

test('the retired admin surfaces stay under the admin prefix and 404 in the dispatcher', () => {
  // /api/admin/ 是管理后台的粗粒度边界：退役的 admin 子路径仍会被判为受保护，
  // 但分发器里已经没有对应分支，会落到兜底 404（见 knowledge-admin 的「已下架」用例）。
  for (const path of [
    '/api/admin/workorders',
    '/api/admin/engineers/engineer-1',
    '/api/admin/analytics/overview',
    '/api/admin/business/work-orders',
  ]) {
    assert.equal(isKnownProtectedRoute(path), true);
  }
});
