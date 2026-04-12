// 生成唯一 ID
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 格式化时间
export function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('zh-CN', {
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
    return '今天';
  } else if (targetDate.getTime() === yesterday.getTime()) {
    return '昨天';
  } else if (targetDate.getTime() > weekAgo.getTime()) {
    return '近7天';
  } else {
    return '更早';
  }
}

// 获取对话标题（第一条用户消息的前20字）
export function getConversationTitle(firstMessage) {
  if (!firstMessage) return '新对话';
  return firstMessage.content.slice(0, 20) + (firstMessage.content.length > 20 ? '...' : '');
}
