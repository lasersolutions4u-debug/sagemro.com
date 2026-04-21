import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GuardError,
  assertWorkOrderAccess,
  assertConversationAccess,
  assertEngineerOrAdmin,
} from '../src/lib/guards.js';

function catching(fn) {
  try { fn(); return null; } catch (e) { return e; }
}

// ============ assertWorkOrderAccess ============

test('assertWorkOrderAccess 未登录抛 401', () => {
  const err = catching(() => assertWorkOrderAccess(null, { customer_id: 'c1' }));
  assert.ok(err instanceof GuardError);
  assert.equal(err.status, 401);
});

test('assertWorkOrderAccess 工单不存在抛 404', () => {
  const err = catching(() => assertWorkOrderAccess({ userId: 'c1', userType: 'customer' }, null));
  assert.ok(err instanceof GuardError);
  assert.equal(err.status, 404);
});

test('assertWorkOrderAccess admin 放行', () => {
  assert.doesNotThrow(() =>
    assertWorkOrderAccess({ userId: 'a1', userType: 'admin' }, { customer_id: 'c1', engineer_id: 'e1' })
  );
});

test('assertWorkOrderAccess 工单客户本人放行', () => {
  assert.doesNotThrow(() =>
    assertWorkOrderAccess({ userId: 'c1', userType: 'customer' }, { customer_id: 'c1' })
  );
});

test('assertWorkOrderAccess 工单工程师本人放行', () => {
  assert.doesNotThrow(() =>
    assertWorkOrderAccess({ userId: 'e1', userType: 'engineer' }, { engineer_id: 'e1' })
  );
});

test('assertWorkOrderAccess 非本工单的其他客户抛 403', () => {
  const err = catching(() =>
    assertWorkOrderAccess({ userId: 'c2', userType: 'customer' }, { customer_id: 'c1', engineer_id: 'e1' })
  );
  assert.ok(err instanceof GuardError);
  assert.equal(err.status, 403);
});

test('assertWorkOrderAccess 非本工单的其他工程师抛 403', () => {
  const err = catching(() =>
    assertWorkOrderAccess({ userId: 'e2', userType: 'engineer' }, { customer_id: 'c1', engineer_id: 'e1' })
  );
  assert.ok(err instanceof GuardError);
  assert.equal(err.status, 403);
});

test('assertWorkOrderAccess 未知 userType 抛 403', () => {
  const err = catching(() =>
    assertWorkOrderAccess({ userId: 'x', userType: 'guest' }, { customer_id: 'c1', engineer_id: 'e1' })
  );
  assert.ok(err instanceof GuardError);
  assert.equal(err.status, 403);
});

// ============ assertConversationAccess ============

test('assertConversationAccess 未登录抛 401', () => {
  const err = catching(() => assertConversationAccess(null, { customer_id: 'c1' }));
  assert.equal(err.status, 401);
});

test('assertConversationAccess 会话不存在抛 404', () => {
  const err = catching(() =>
    assertConversationAccess({ userId: 'c1', userType: 'customer' }, null)
  );
  assert.equal(err.status, 404);
});

test('assertConversationAccess admin 放行', () => {
  assert.doesNotThrow(() =>
    assertConversationAccess({ userId: 'a1', userType: 'admin' }, { customer_id: 'c1' })
  );
});

test('assertConversationAccess 会话主人放行', () => {
  assert.doesNotThrow(() =>
    assertConversationAccess({ userId: 'c1', userType: 'customer' }, { customer_id: 'c1' })
  );
});

test('assertConversationAccess 其他客户抛 403', () => {
  const err = catching(() =>
    assertConversationAccess({ userId: 'c2', userType: 'customer' }, { customer_id: 'c1' })
  );
  assert.equal(err.status, 403);
});

test('assertConversationAccess 历史会话（customer_id=NULL）非 admin 抛 403', () => {
  const err = catching(() =>
    assertConversationAccess({ userId: 'c1', userType: 'customer' }, { customer_id: null })
  );
  assert.equal(err.status, 403);
});

test('assertConversationAccess 历史会话 admin 可读', () => {
  assert.doesNotThrow(() =>
    assertConversationAccess({ userId: 'a1', userType: 'admin' }, { customer_id: null })
  );
});

test('assertConversationAccess 工程师不能读对话', () => {
  const err = catching(() =>
    assertConversationAccess({ userId: 'e1', userType: 'engineer' }, { customer_id: 'c1' })
  );
  assert.equal(err.status, 403);
});

// ============ assertEngineerOrAdmin ============

test('assertEngineerOrAdmin 未登录抛 401', () => {
  const err = catching(() => assertEngineerOrAdmin(null));
  assert.equal(err.status, 401);
});

test('assertEngineerOrAdmin engineer 放行', () => {
  assert.doesNotThrow(() => assertEngineerOrAdmin({ userType: 'engineer' }));
});

test('assertEngineerOrAdmin admin 放行', () => {
  assert.doesNotThrow(() => assertEngineerOrAdmin({ userType: 'admin' }));
});

test('assertEngineerOrAdmin customer 抛 403', () => {
  const err = catching(() => assertEngineerOrAdmin({ userType: 'customer' }));
  assert.equal(err.status, 403);
});
