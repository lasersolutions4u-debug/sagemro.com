// 纯工具函数 —— 无外部依赖（除标准库）
// 可在 Cloudflare Workers 和 Node 20+ 中运行

// 生成唯一 ID（时间戳 base36 + 随机 base36 尾）
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 按字符数安全截断字符串（支持中文）；null/空串 → ''
export function truncateStr(str, maxChars) {
  if (!str) return '';
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars);
}
