// API 服务层
const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.lasersolutions4u.workers.dev';

/**
 * 发送消息并获取流式响应
 * @param {Object} params
 * @param {string|null} params.conversationId - 对话 ID，新对话时为 null
 * @param {string} params.message - 用户消息
 * @param {Function} params.onChunk - 接收到数据块时的回调
 * @param {Function} params.onDone - 流结束时的回调
 * @param {Function} params.onError - 错误时的回调
 * @param {AbortSignal} params.signal - AbortController.signal，用于中断请求
 */
export async function streamChat({ conversationId, message, onChunk, onDone, onError, signal }) {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        message: message,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === 'data: [DONE]') {
          onDone?.();
          return;
        }
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            onChunk?.(data);
          } catch (e) {
            // 忽略解析失败的行
          }
        }
      }
    }

    onDone?.();
  } catch (error) {
    if (error.name === 'AbortError') {
      onDone?.();
    } else {
      onError?.(error);
    }
  }
}

/**
 * 获取对话列表
 */
export async function getConversations() {
  const response = await fetch(`${API_BASE}/api/conversations`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取对话详情
 */
export async function getConversation(id) {
  const response = await fetch(`${API_BASE}/api/conversations/${id}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 删除对话
 */
export async function deleteConversation(id) {
  const response = await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 提交工单
 */
export async function submitWorkOrder(data) {
  const response = await fetch(`${API_BASE}/api/workorders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取工单列表
 */
export async function getWorkOrders() {
  const response = await fetch(`${API_BASE}/api/workorders`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
