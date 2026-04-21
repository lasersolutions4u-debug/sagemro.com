import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ValidationError,
  LIMITS,
  assertMaxLength,
  assertFieldLimits,
  validateImageUrl,
  validationErrorToResponse,
} from '../src/lib/validators.js';

function catching(fn) {
  try { fn(); return null; } catch (e) { return e; }
}

// ============ assertMaxLength ============

test('assertMaxLength null 原样返回', () => {
  assert.equal(assertMaxLength(null, 'f', 10), null);
});

test('assertMaxLength undefined 原样返回', () => {
  assert.equal(assertMaxLength(undefined, 'f', 10), undefined);
});

test('assertMaxLength 非字符串抛错（数组注入）', () => {
  const err = catching(() => assertMaxLength(['a', 'b'], 'f', 10));
  assert.ok(err instanceof ValidationError);
  assert.equal(err.status, 400);
  assert.match(err.message, /必须为字符串/);
});

test('assertMaxLength 非字符串抛错（对象注入）', () => {
  const err = catching(() => assertMaxLength({ a: 1 }, 'f', 10));
  assert.ok(err instanceof ValidationError);
});

test('assertMaxLength 非字符串抛错（数字）', () => {
  const err = catching(() => assertMaxLength(12345, 'f', 10));
  assert.ok(err instanceof ValidationError);
});

test('assertMaxLength 未超限放行', () => {
  assert.equal(assertMaxLength('hello', 'f', 10), 'hello');
});

test('assertMaxLength 恰好等于上限放行', () => {
  assert.equal(assertMaxLength('1234567890', 'f', 10), '1234567890');
});

test('assertMaxLength 超限抛错并带字段名和上限', () => {
  const err = catching(() => assertMaxLength('12345678901', 'description', 10));
  assert.ok(err instanceof ValidationError);
  assert.equal(err.status, 400);
  assert.match(err.message, /description/);
  assert.match(err.message, /10/);
});

test('assertMaxLength 空字符串视为已提供但长度 0', () => {
  assert.equal(assertMaxLength('', 'f', 10), '');
});

// ============ assertFieldLimits ============

test('assertFieldLimits body 为 null 不抛错', () => {
  assert.doesNotThrow(() => assertFieldLimits(null, { a: 10 }));
});

test('assertFieldLimits body 为非对象不抛错', () => {
  assert.doesNotThrow(() => assertFieldLimits('not-an-object', { a: 10 }));
});

test('assertFieldLimits 所有字段合法放行', () => {
  assert.doesNotThrow(() =>
    assertFieldLimits({ name: 'abc', bio: 'hello' }, { name: 50, bio: 2000 })
  );
});

test('assertFieldLimits 某字段超限抛错，错误带该字段名', () => {
  const body = { name: 'a'.repeat(5), bio: 'x'.repeat(2001) };
  const err = catching(() => assertFieldLimits(body, { name: 50, bio: 2000 }));
  assert.ok(err instanceof ValidationError);
  assert.match(err.message, /bio/);
});

test('assertFieldLimits 跳过 body 里未定义的字段', () => {
  assert.doesNotThrow(() =>
    assertFieldLimits({ name: 'abc' }, { name: 50, bio: 2000 })
  );
});

// ============ validateImageUrl ============

test('validateImageUrl null 返回 null', () => {
  assert.equal(validateImageUrl(null), null);
});

test('validateImageUrl undefined 返回 null', () => {
  assert.equal(validateImageUrl(undefined), null);
});

test('validateImageUrl 空字符串返回 null', () => {
  assert.equal(validateImageUrl(''), null);
});

test('validateImageUrl 全空白返回 null', () => {
  assert.equal(validateImageUrl('   '), null);
});

test('validateImageUrl 非字符串抛错', () => {
  const err = catching(() => validateImageUrl(12345));
  assert.ok(err instanceof ValidationError);
  assert.match(err.message, /必须为字符串/);
});

test('validateImageUrl http:// 拒绝', () => {
  const err = catching(() => validateImageUrl('http://imagedelivery.net/foo.jpg'));
  assert.ok(err instanceof ValidationError);
  assert.match(err.message, /https/);
});

test('validateImageUrl javascript: 拒绝', () => {
  const err = catching(() => validateImageUrl('javascript:alert(1)'));
  assert.ok(err instanceof ValidationError);
});

test('validateImageUrl data: 拒绝', () => {
  const err = catching(() => validateImageUrl('data:image/png;base64,AAAA'));
  assert.ok(err instanceof ValidationError);
});

test('validateImageUrl ftp: 拒绝', () => {
  const err = catching(() => validateImageUrl('ftp://imagedelivery.net/foo.jpg'));
  assert.ok(err instanceof ValidationError);
});

test('validateImageUrl 非法 URL 抛错', () => {
  const err = catching(() => validateImageUrl('not a url'));
  assert.ok(err instanceof ValidationError);
  assert.match(err.message, /合法 URL/);
});

test('validateImageUrl 白名单精确匹配放行（imagedelivery.net）', () => {
  const url = 'https://imagedelivery.net/abc/img/public';
  assert.equal(validateImageUrl(url), url);
});

test('validateImageUrl 白名单后缀匹配放行（*.imagedelivery.net）', () => {
  const url = 'https://cdn.imagedelivery.net/abc/img/public';
  assert.equal(validateImageUrl(url), url);
});

test('validateImageUrl 白名单后缀匹配放行（r2.dev 子域）', () => {
  const url = 'https://pub-abc123.r2.dev/photo.jpg';
  assert.equal(validateImageUrl(url), url);
});

test('validateImageUrl 白名单后缀匹配放行（腾讯 COS）', () => {
  const url = 'https://bucket.cos.ap-shanghai.myqcloud.com/k.jpg';
  assert.equal(validateImageUrl(url), url);
});

test('validateImageUrl 白名单后缀匹配放行（阿里 OSS）', () => {
  const url = 'https://bucket.oss-cn-hangzhou.aliyuncs.com/k.jpg';
  assert.equal(validateImageUrl(url), url);
});

test('validateImageUrl 子域混淆攻击拒绝（imagedelivery.net.evil.com）', () => {
  const err = catching(() =>
    validateImageUrl('https://imagedelivery.net.evil.com/pwn.jpg')
  );
  assert.ok(err instanceof ValidationError);
  assert.match(err.message, /白名单/);
});

test('validateImageUrl 前缀混淆攻击拒绝（eviImagedelivery.net）', () => {
  const err = catching(() =>
    validateImageUrl('https://evilimagedelivery.net/pwn.jpg')
  );
  assert.ok(err instanceof ValidationError);
});

test('validateImageUrl 其他域名拒绝', () => {
  const err = catching(() =>
    validateImageUrl('https://evil.example.com/pwn.jpg')
  );
  assert.ok(err instanceof ValidationError);
  assert.match(err.message, /白名单/);
});

test('validateImageUrl 超长 URL 抛错', () => {
  const longPath = 'a'.repeat(LIMITS.url + 10);
  const err = catching(() =>
    validateImageUrl(`https://imagedelivery.net/${longPath}`)
  );
  assert.ok(err instanceof ValidationError);
  assert.match(err.message, /最大长度/);
});

test('validateImageUrl 前后空白被修剪', () => {
  const url = '  https://imagedelivery.net/abc  ';
  assert.equal(validateImageUrl(url), 'https://imagedelivery.net/abc');
});

test('validateImageUrl host 大小写不敏感', () => {
  const url = 'https://IMAGEDELIVERY.NET/abc';
  // URL normalizes host to lowercase, so should still pass
  const result = validateImageUrl(url);
  assert.ok(result !== null);
});

test('validateImageUrl 错误信息带自定义字段名', () => {
  const err = catching(() =>
    validateImageUrl('http://evil.com/x', 'logo_url')
  );
  assert.ok(err instanceof ValidationError);
  assert.match(err.message, /logo_url/);
});

// ============ validationErrorToResponse ============

test('validationErrorToResponse ValidationError 转 400', () => {
  const fakeErrResponse = (msg, status) => ({ msg, status });
  const verr = new ValidationError('bad field', 400);
  const out = validationErrorToResponse(verr, fakeErrResponse);
  assert.deepEqual(out, { msg: 'bad field', status: 400 });
});

test('validationErrorToResponse ValidationError 带自定义 status', () => {
  const fakeErrResponse = (msg, status) => ({ msg, status });
  const verr = new ValidationError('forbidden thing', 422);
  const out = validationErrorToResponse(verr, fakeErrResponse);
  assert.deepEqual(out, { msg: 'forbidden thing', status: 422 });
});

test('validationErrorToResponse 其他 Error 返回 null', () => {
  const fakeErrResponse = (msg, status) => ({ msg, status });
  const other = new Error('not mine');
  const out = validationErrorToResponse(other, fakeErrResponse);
  assert.equal(out, null);
});
