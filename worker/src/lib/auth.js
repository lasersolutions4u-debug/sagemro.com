/**
 * 认证与加密相关的纯函数模块
 *
 * 所有函数只依赖 Web Crypto API（Cloudflare Workers 原生支持，Node 20+ 全局可用），
 * 不依赖任何 env / 数据库，因此可以脱离 worker 运行时直接单元测试。
 */

// 生成随机盐值（16字节，转为hex字符串）
export function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 使用 PBKDF2 生成密码哈希（新算法，每个用户独立盐值）
export async function hashPasswordNew(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 旧算法兼容（SHA-256 + 固定盐），用于已有用户的密码验证
export async function hashPasswordLegacy(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'sagemro_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 验证密码（兼容新旧算法）
// 如果用户有 salt 字段且非空，用新算法；否则用旧算法
export async function verifyPassword(password, hash, salt) {
  if (salt) {
    const inputHash = await hashPasswordNew(password, salt);
    return inputHash === hash;
  }
  const inputHash = await hashPasswordLegacy(password);
  return inputHash === hash;
}

// 生成工单号
export function generateOrderNo() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `WO-${dateStr}-${random}`;
}

// ============ JWT 认证（基于 Web Crypto API）============

// Base64URL 编码
export function base64UrlEncode(data) {
  let str;
  if (typeof data === 'string') {
    str = btoa(unescape(encodeURIComponent(data)));
  } else {
    str = btoa(String.fromCharCode(...new Uint8Array(data)));
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base64URL 解码（文本）
export function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return decodeURIComponent(escape(atob(str)));
}

// 签发 JWT token（HS256）
export async function signJwt(payload, secret) {
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('JWT_SECRET 未配置或长度不足（需要至少 16 字符）');
  }
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureB64 = base64UrlEncode(signature);

  return `${data}.${signatureB64}`;
}

// 验证 JWT token（HS256）
export async function verifyJwt(token, secret) {
  try {
    if (!secret || typeof secret !== 'string' || secret.length < 16) {
      return null;
    }
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    const sigB64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const sigPadded = sigB64 + '='.repeat((4 - sigB64.length % 4) % 4);
    const sigBinary = atob(sigPadded);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) sigBytes[i] = sigBinary.charCodeAt(i);

    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64));

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}
