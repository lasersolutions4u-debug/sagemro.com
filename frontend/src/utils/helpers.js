// 生成唯一 ID
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 格式化时间
export function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 格式化日期（用于分组）
export function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (targetDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (targetDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else if (targetDate.getTime() > weekAgo.getTime()) {
    return 'Last 7 Days';
  } else {
    return 'Earlier';
  }
}

// 获取对话标题（第一条用户消息的前20字）
export function getConversationTitle(firstMessage) {
  if (!firstMessage) return 'New Chat';
  return firstMessage.content.slice(0, 20) + (firstMessage.content.length > 20 ? '...' : '');
}

// 修复 AI 输出的 Markdown 表格：当所有行挤在同一行时拆分为独立行
// AI 有时输出 "| A | B | |:---:|:---:| | 1 | 2 |" 而非每行独立
// 规律：行内单元格间无 "| |"，行边界处才有 "| |"（前一行的尾 | + 空格 + 后一行的头 |）
export function normalizeMarkdownTable(text) {
  if (!text || !text.includes('|')) return text;
  // 只在内容包含表格分隔符特征时才处理
  if (!text.includes('---')) return text;
  return text.replace(/\| \|/g, '|\n|');
}
