// PII / 敏感信息脱敏工具
//
// 双用途：
//   1. Phase 0.5 工单存储前：清洗用户粘贴到 description/notes 的手机号、身份证等
//   2. Phase 1 摘要生成前：清洗送给 gpt-4o-mini 的消息文本（SummaryProtocol 决议4）
//
// 设计原则（非常重要，读代码前请看完）：
//   - 只脱敏"结构明确 + 低误伤"的模式。不要搞 ML/贝叶斯，不要靠上下文推理
//   - 不脱敏技术内容：设备型号（G3015H/TruBend）/ 功率（3000W/6mm）/ 错误码 /
//     工单号（WO-...）/ 订单号 / 品牌（大族/通快）。这些在 RAG 检索时是核心信号
//   - 替换为语义占位符 `[类型]`，不是 `***` —— 让下游 AI 知道"客户确实给了手机号，
//     但内容已脱敏"，不会误判"客户没留电话"。同一类型重复出现仍保持占位符一致
//   - 纯同步、无外部依赖。在 Workers runtime / Node / 浏览器都能跑
//
// API：
//   - redactPII(text) → string                    // 默认全量脱敏
//   - redactPII(text, { categories: [...] })      // 只脱指定类别
//   - countPII(text) → { [category]: count }      // 仅检测，返回各类 hit 数（不改原文）
//
// 当 text 不是字符串 / 为 null / 为空 → 原样返回，不抛错（caller 常传 DB 字段）

const PLACEHOLDERS = {
  phone_cn: '[手机号]',
  id_card_cn: '[身份证]',
  email: '[邮箱]',
  bank_card: '[银行卡]',
  license_plate_cn: '[车牌]',
  url_with_credentials: '[URL]',
};

// 中国手机号：1 开头 + 第二位 3-9 + 共 11 位
// 前后用负向断言避免吃掉 13 位订单号尾部 / 设备序列号里嵌的 11 位子串
// （\b 对中文边界不敏感，用 (?<!\d) / (?!\d) 更可靠）
const RE_PHONE_CN = /(?<!\d)1[3-9]\d{9}(?!\d)/g;

// 中国身份证：18 位（老 15 位已基本淘汰，不处理以免误伤订单号）
// 最后一位可为数字或 X/x
const RE_ID_CARD_CN = /(?<!\d)\d{17}[\dXx](?!\d)/g;

// 邮箱：RFC 近似子集。不追求完美（perfect email regex 见过都知道是 deep magic）
const RE_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// 银行卡：13-19 位连续数字。这类最容易误伤（条码 / 长订单号 / SN），
// 所以要求紧邻关键词上下文才触发。关键词：卡号 / 账号 / 尾号 / 银行卡 / 建行 / 工行 / 农行 / 中行 / 招商 / card
// 命中后把"关键词 + 空格/冒号 + 数字串"整段替成占位符前的关键词 + 占位符
const RE_BANK_CARD_LABELED =
  /(卡号|账号|尾号|银行卡|工行|建行|农行|中行|招商|交行|邮储|card(?:\s*(?:no|number))?)\s*[:：]?\s*(\d{13,19})(?!\d)/gi;

// 中国机动车车牌：省份简称（京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼港澳台）
// + 1 位字母（警牌含警字，这里不处理警车） + 5-6 位字母/数字
// 覆盖普通蓝牌 + 新能源绿牌（6 位）
const RE_LICENSE_PLATE =
  /(?<![A-Z0-9])[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][A-Z0-9]{5,6}(?![A-Z0-9])/g;

// URL 里嵌入 basic auth 凭据：https://user:pass@host/... —— 真见过有人粘整行
// 不脱普通 URL（设备厂商文档链接在 RAG 里有价值）
const RE_URL_WITH_CREDS = /https?:\/\/[^\s/@]+:[^\s/@]+@[^\s]+/g;

const DEFAULT_CATEGORIES = [
  'phone_cn',
  'id_card_cn',
  'email',
  'bank_card',
  'license_plate_cn',
  'url_with_credentials',
];

/**
 * 对单条文本做脱敏。
 * @param {string} text
 * @param {{ categories?: string[] }} [opts]
 * @returns {string}
 */
export function redactPII(text, opts = {}) {
  if (typeof text !== 'string' || text.length === 0) return text;
  const categories = opts.categories || DEFAULT_CATEGORIES;

  let out = text;

  // 顺序很重要：
  //   1. URL_WITH_CREDS 最先——凭据 URL 里的 `user:pass@host` 会被 email 正则吃掉右半段
  //   2. bank_card 第二——带标签的银行卡是"关键词 + 数字串"，必须抢在身份证/手机号
  //      的纯数字匹配之前把数字串整段替换掉
  //   3. 身份证 > 手机号——身份证 18 位包含手机号样式子串，先替换身份证防误伤
  //   4. 邮箱、车牌、普通手机号——互不重叠，顺序无关
  if (categories.includes('url_with_credentials')) {
    out = out.replace(RE_URL_WITH_CREDS, PLACEHOLDERS.url_with_credentials);
  }
  if (categories.includes('bank_card')) {
    out = out.replace(RE_BANK_CARD_LABELED, (_m, label, _digits, _offset, _s) => {
      // 保留原始的"关键词 + 空白/冒号"上下文，只替换数字段
      // 找出 label 后面到数字串前的那段（空白+可选冒号+空白）
      const match = _m.match(/^(.+?)(\s*[:：]?\s*)\d{13,19}$/);
      const sep = match ? match[2] : '';
      return `${label}${sep}${PLACEHOLDERS.bank_card}`;
    });
  }
  if (categories.includes('id_card_cn')) {
    out = out.replace(RE_ID_CARD_CN, PLACEHOLDERS.id_card_cn);
  }
  if (categories.includes('phone_cn')) {
    out = out.replace(RE_PHONE_CN, PLACEHOLDERS.phone_cn);
  }
  if (categories.includes('email')) {
    out = out.replace(RE_EMAIL, PLACEHOLDERS.email);
  }
  if (categories.includes('license_plate_cn')) {
    out = out.replace(RE_LICENSE_PLATE, PLACEHOLDERS.license_plate_cn);
  }

  return out;
}

/**
 * 只数一下每类命中次数（不改原文），用于监控 / 阈值报警。
 * @param {string} text
 * @returns {{ [category: string]: number }}
 */
export function countPII(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c, 0]));
  }
  return {
    phone_cn: (text.match(RE_PHONE_CN) || []).length,
    id_card_cn: (text.match(RE_ID_CARD_CN) || []).length,
    email: (text.match(RE_EMAIL) || []).length,
    bank_card: (text.match(RE_BANK_CARD_LABELED) || []).length,
    license_plate_cn: (text.match(RE_LICENSE_PLATE) || []).length,
    url_with_credentials: (text.match(RE_URL_WITH_CREDS) || []).length,
  };
}

/**
 * 便捷方法：对对象里一组指定字段做脱敏。原对象不改，返回新对象。
 * 典型用法：
 *   const cleaned = redactFields(body, ['description', 'notes']);
 * @template T
 * @param {T} obj
 * @param {string[]} fields
 * @param {{ categories?: string[] }} [opts]
 * @returns {T}
 */
export function redactFields(obj, fields, opts) {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = { ...obj };
  for (const f of fields) {
    if (typeof copy[f] === 'string') {
      copy[f] = redactPII(copy[f], opts);
    }
  }
  return copy;
}
