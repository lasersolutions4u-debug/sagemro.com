/**
 * 输入校验（validators）
 *
 * 统一的文本长度上限 + URL 白名单，防止：
 *   - 客户端不校验时用户粘贴几 MB 文本打爆 D1 / 前端渲染
 *   - 攻击者把 `javascript:` 或其他协议注入 photo_url，点图片时触发 XSS
 *   - 攻击者把 photo_url 指向受控外域，把登录用户的 Referer/IP 引走
 *
 * 设计约束：
 *   - 纯函数，不访问 env/DB；在 handler 最前面跑一次即可
 *   - 超限抛 ValidationError；handler 用 try/catch + validationErrorToResponse 转 400
 *   - 对 null/undefined 宽松放行，让 handler 决定"必填"语义（不抢 errorResponse('缺少必填字段') 的活）
 */

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

// 字段长度上限（字符数，不是字节）。JS `.length` 对中文按 UTF-16 码元算，
// 普通中文是 1，罕用字/emoji 是 2——对人类输入来说跟直觉一致，够用。
export const LIMITS = {
  // 长文本
  description: 4000,        // 工单描述
  content: 4000,            // 工单消息 / AI 对话
  log_content: 2000,        // 工单日志 content
  bio: 2000,                // 工程师自我介绍
  company_description: 2000,// 客户/工程师公司介绍
  business_scope: 1000,     // 经营范围
  notes: 2000,              // 设备备注
  comment: 1000,            // 评价留言
  parts_detail: 2000,       // 核价配件明细
  admin_reply: 2000,        // 管理员回复评价

  // 中等长度
  name: 50,                 // 姓名 / 设备名
  title: 100,               // 对话标题 / 工单标题
  company: 200,             // 公司名
  address: 500,
  city: 100,
  region: 200,
  service_region: 500,
  type: 100,                // 设备类型
  brand: 100,
  model: 200,
  power: 50,
  phone: 20,
  url: 500,                 // 任意 URL 字符上限
};

// photo_url / logo_url 必须是 https，且域名在白名单内。
// 允许的 host 包括：Cloudflare Images、自家 CDN、腾讯云 COS、阿里云 OSS。
// 注意：host 匹配是**完整 host 或 "以 .<domain> 结尾"**，避免
// evil.imagedelivery.net.attacker.com 这种子域混淆攻击。
const ALLOWED_IMAGE_HOST_SUFFIXES = [
  'imagedelivery.net',
  'r2.dev',
  'sagemro.com',
  'sagemro.cn',
  'lasersolutions4u.workers.dev',
  'cos.ap-shanghai.myqcloud.com',
  'cos.ap-guangzhou.myqcloud.com',
  'cos.ap-beijing.myqcloud.com',
  'oss-cn-hangzhou.aliyuncs.com',
  'oss-cn-shanghai.aliyuncs.com',
  'oss-cn-beijing.aliyuncs.com',
];

function hostAllowed(host) {
  const lower = host.toLowerCase();
  return ALLOWED_IMAGE_HOST_SUFFIXES.some(
    (h) => lower === h || lower.endsWith('.' + h)
  );
}

/**
 * 校验并修剪字符串字段。null / undefined / '' 视为"未提供"，直接返回原值
 * 让上层决定是否必填。非字符串类型直接报错（防数组/对象注入）。
 *
 * @param {unknown} value
 * @param {string} field - 出错时的字段名，用于错误信息
 * @param {number} max - 允许的最大字符数
 * @returns {string | null | undefined} 修剪后的字符串（原 null/undefined 保留）
 */
export function assertMaxLength(value, field, max) {
  if (value == null) return value; // 原样返回 null / undefined
  if (typeof value !== 'string') {
    throw new ValidationError(`字段 ${field} 必须为字符串`);
  }
  if (value.length > max) {
    throw new ValidationError(`字段 ${field} 超过最大长度 ${max}`);
  }
  return value;
}

/**
 * 对批量可选字段统一检查长度，简化 handler。
 * fields 形如 { description: 4000, bio: 2000 }，在 body 上逐字段 assertMaxLength。
 *
 * @param {Record<string, unknown>} body
 * @param {Record<string, number>} fieldLimits
 */
export function assertFieldLimits(body, fieldLimits) {
  if (!body || typeof body !== 'object') return;
  for (const [field, max] of Object.entries(fieldLimits)) {
    assertMaxLength(body[field], field, max);
  }
}

/**
 * 校验图片 URL：必须 https + 域名白名单 + 长度上限。
 * 空字符串 / null / undefined 一律返回 null（视作"不设置"）。
 *
 * @param {unknown} value
 * @param {string} [field='photo_url']
 * @returns {string | null}
 */
export function validateImageUrl(value, field = 'photo_url') {
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new ValidationError(`字段 ${field} 必须为字符串`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > LIMITS.url) {
    throw new ValidationError(`字段 ${field} 超过最大长度 ${LIMITS.url}`);
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError(`字段 ${field} 不是合法 URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new ValidationError(`字段 ${field} 必须使用 https`);
  }
  if (!hostAllowed(parsed.host)) {
    throw new ValidationError(`字段 ${field} 域名不在白名单内`);
  }
  return trimmed;
}

/**
 * 把 ValidationError 转成统一的错误响应；非 ValidationError 交由上层处理。
 *
 * @param {Error} err
 * @param {(msg: string, status: number) => Response} errorResponse
 * @returns {Response | null}
 */
export function validationErrorToResponse(err, errorResponse) {
  if (err instanceof ValidationError) {
    return errorResponse(err.message, err.status);
  }
  return null;
}
