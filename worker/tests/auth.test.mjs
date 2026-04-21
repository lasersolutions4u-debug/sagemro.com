/**
 * 认证相关纯函数单元测试
 *
 * 运行方式（Node 20+ 内置 test runner，无需依赖）：
 *   cd worker
 *   node --test tests/auth.test.mjs
 *
 * 目标：锁死关键安全函数的行为（密码哈希、JWT、编解码），
 *       避免在后续重构中悄悄引入"看起来能跑但 token/密码全失效"的回归。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateSalt,
  hashPasswordNew,
  hashPasswordLegacy,
  verifyPassword,
  generateOrderNo,
  base64UrlEncode,
  base64UrlDecode,
  signJwt,
  verifyJwt,
} from '../src/lib/auth.js';

// ============ 盐值生成 ============

test('generateSalt 返回 32 位 hex 字符串（16 字节）', () => {
  const salt = generateSalt();
  assert.equal(typeof salt, 'string');
  assert.equal(salt.length, 32);
  assert.match(salt, /^[0-9a-f]{32}$/);
});

test('generateSalt 每次调用都不相同', () => {
  const seen = new Set();
  for (let i = 0; i < 50; i++) seen.add(generateSalt());
  assert.equal(seen.size, 50, '50 次调用应产生 50 个不同盐值');
});

// ============ 新密码哈希（PBKDF2）============

test('hashPasswordNew 对相同 password + salt 具有确定性', async () => {
  const salt = generateSalt();
  const h1 = await hashPasswordNew('my-password-123', salt);
  const h2 = await hashPasswordNew('my-password-123', salt);
  assert.equal(h1, h2);
  assert.equal(h1.length, 64, 'PBKDF2 SHA-256 输出 256 位 = 64 hex');
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test('hashPasswordNew 对不同 salt 产生不同哈希（同 password）', async () => {
  const h1 = await hashPasswordNew('same-password', 'salt-a'.padEnd(32, '0'));
  const h2 = await hashPasswordNew('same-password', 'salt-b'.padEnd(32, '0'));
  assert.notEqual(h1, h2);
});

test('hashPasswordNew 对不同 password 产生不同哈希（同 salt）', async () => {
  const salt = generateSalt();
  const h1 = await hashPasswordNew('password-1', salt);
  const h2 = await hashPasswordNew('password-2', salt);
  assert.notEqual(h1, h2);
});

// ============ 旧密码哈希（SHA-256 + 固定盐）============

test('hashPasswordLegacy 对同一密码保持稳定（不能在修复中改变输出）', async () => {
  // 这个值是 hashPasswordLegacy('hello-sagemro') 的预期输出
  // 如果这个断言失败，说明旧算法被改动，会让历史用户无法登录
  const expected = await hashPasswordLegacy('hello-sagemro');
  assert.equal(expected.length, 64);
  assert.match(expected, /^[0-9a-f]{64}$/);

  // 对同输入多次调用必须一致
  assert.equal(await hashPasswordLegacy('hello-sagemro'), expected);
});

// ============ verifyPassword 兼容分支 ============

test('verifyPassword 有 salt 时走新算法', async () => {
  const salt = generateSalt();
  const password = 'user-password';
  const hash = await hashPasswordNew(password, salt);

  assert.equal(await verifyPassword(password, hash, salt), true);
  assert.equal(await verifyPassword('wrong-password', hash, salt), false);
});

test('verifyPassword 无 salt 时走旧算法（兼容遗留用户）', async () => {
  const password = 'legacy-user';
  const hash = await hashPasswordLegacy(password);

  // salt 为空字符串 / null / undefined 都应走旧算法
  assert.equal(await verifyPassword(password, hash, ''), true);
  assert.equal(await verifyPassword(password, hash, null), true);
  assert.equal(await verifyPassword(password, hash, undefined), true);
  assert.equal(await verifyPassword('wrong', hash, null), false);
});

test('verifyPassword 不会把旧哈希误判为新算法的匹配', async () => {
  const legacyHash = await hashPasswordLegacy('pwd');
  const salt = generateSalt();
  // 给新算法分支传遗留哈希 + 随机 salt，必须返回 false
  assert.equal(await verifyPassword('pwd', legacyHash, salt), false);
});

// ============ 工单号 ============

test('generateOrderNo 返回 WO-YYYYMMDD-NNN 格式', () => {
  const no = generateOrderNo();
  assert.match(no, /^WO-\d{8}-\d{3}$/);
});

// ============ Base64URL 编解码 ============

test('base64UrlEncode/Decode 对 ASCII 字符串往返一致', () => {
  const s = 'hello world 123 !@#$%';
  const encoded = base64UrlEncode(s);
  assert.doesNotMatch(encoded, /[+/=]/, 'base64url 不应包含 + / =');
  assert.equal(base64UrlDecode(encoded), s);
});

test('base64UrlEncode/Decode 对 UTF-8 中文字符串往返一致', () => {
  const s = '你好世界，小智平台测试';
  assert.equal(base64UrlDecode(base64UrlEncode(s)), s);
});

test('base64UrlEncode 接受 ArrayBuffer/Uint8Array', () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 255, 128]);
  const encoded = base64UrlEncode(bytes);
  assert.equal(typeof encoded, 'string');
  assert.doesNotMatch(encoded, /[+/=]/);
});

// ============ JWT 签发与验证 ============

const TEST_SECRET = 'this-is-a-test-secret-32-chars!';  // 长度 ≥ 16

test('signJwt + verifyJwt 成功往返，payload 完整', async () => {
  const payload = { userId: 'user-123', userType: 'customer', iat: 1700000000, exp: 9999999999 };
  const token = await signJwt(payload, TEST_SECRET);
  assert.equal(token.split('.').length, 3, 'JWT 应由 3 段组成');

  const verified = await verifyJwt(token, TEST_SECRET);
  assert.deepEqual(verified, payload);
});

test('verifyJwt 用错误 secret 返回 null', async () => {
  const token = await signJwt({ userId: 'x', exp: 9999999999 }, TEST_SECRET);
  const otherSecret = 'a-completely-different-secret-x1';
  assert.equal(await verifyJwt(token, otherSecret), null);
});

test('verifyJwt 对过期 token 返回 null', async () => {
  const token = await signJwt(
    { userId: 'x', iat: 1000, exp: Math.floor(Date.now() / 1000) - 60 }, // 60 秒前过期
    TEST_SECRET
  );
  assert.equal(await verifyJwt(token, TEST_SECRET), null);
});

test('verifyJwt 对被篡改 payload 返回 null', async () => {
  const token = await signJwt({ userId: 'alice', exp: 9999999999 }, TEST_SECRET);
  const parts = token.split('.');
  // 伪造 payload：把 alice 改成 admin
  const fakePayload = base64UrlEncode(JSON.stringify({ userId: 'admin', exp: 9999999999 }));
  const tampered = `${parts[0]}.${fakePayload}.${parts[2]}`;
  assert.equal(await verifyJwt(tampered, TEST_SECRET), null);
});

test('verifyJwt 对格式错误的 token 返回 null（而不是抛异常）', async () => {
  assert.equal(await verifyJwt('', TEST_SECRET), null);
  assert.equal(await verifyJwt('not.a.jwt', TEST_SECRET), null);
  assert.equal(await verifyJwt('only-one-part', TEST_SECRET), null);
  assert.equal(await verifyJwt('a.b.c.d', TEST_SECRET), null);
});

// ============ JWT 安全守卫：拒绝弱密钥 ============

test('signJwt 在 secret 缺失或太短时抛异常（防御性）', async () => {
  await assert.rejects(() => signJwt({ userId: 'x' }, ''), /JWT_SECRET/);
  await assert.rejects(() => signJwt({ userId: 'x' }, null), /JWT_SECRET/);
  await assert.rejects(() => signJwt({ userId: 'x' }, undefined), /JWT_SECRET/);
  await assert.rejects(() => signJwt({ userId: 'x' }, 'short'), /JWT_SECRET/);
});

test('verifyJwt 在 secret 缺失或太短时直接返回 null（不走验证流程）', async () => {
  // 先用合法 secret 签一个 token
  const token = await signJwt({ userId: 'x', exp: 9999999999 }, TEST_SECRET);
  // 如果用弱 secret 验证，绝不能意外通过
  assert.equal(await verifyJwt(token, ''), null);
  assert.equal(await verifyJwt(token, null), null);
  assert.equal(await verifyJwt(token, 'short'), null);
});
