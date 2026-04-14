// API 服务层
const API_BASE = import.meta.env.VITE_API_BASE || 'https://sagemro-api.lasersolutions4u.workers.dev';

// ============ 认证相关 ============

/**
 * 发送验证码
 */
export async function sendVerifyCode(phone) {
  const response = await fetch(`${API_BASE}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 客户注册
 */
export async function registerCustomer({ name, phone, password, code }) {
  const response = await fetch(`${API_BASE}/api/auth/register/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, password, code }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 工程师注册
 */
export async function registerEngineer({ name, phone, password, code, specialties, brands, services, service_region, bio }) {
  const response = await fetch(`${API_BASE}/api/auth/register/engineer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, password, code, specialties, brands, services, service_region, bio }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 登录
 */
export async function login({ phone, password }) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 发送重置密码验证码
 */
export async function sendResetCode(phone) {
  const response = await fetch(`${API_BASE}/api/auth/send-reset-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 重置密码
 */
export async function resetPassword({ phone, code, newPassword }) {
  const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code, newPassword }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============ 聊天相关 ============

/**
 * 发送消息并获取流式响应
 */
export async function streamChat({ conversationId, message, onChunk, onDone, onError, signal, customerId }) {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        message: message,
        customer_id: customerId || localStorage.getItem('sagemro_customer_id'),
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

// ============ 工单相关 ============

/**
 * 提交工单
 */
export async function submitWorkOrder(data) {
  const response = await fetch(`${API_BASE}/api/workorders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 获取工单列表
 */
export async function getWorkOrders(customerId) {
  const url = customerId
    ? `${API_BASE}/api/workorders?customer_id=${customerId}`
    : `${API_BASE}/api/workorders`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取工单详情
 */
export async function getWorkOrder(id) {
  const response = await fetch(`${API_BASE}/api/workorders/${id}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 提交评价
 */
export async function submitRating(data) {
  const response = await fetch(`${API_BASE}/api/workorders/rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============ 工程师相关 ============

/**
 * 获取工程师的工单列表
 */
export async function getEngineerTickets(engineerId) {
  const url = engineerId
    ? `${API_BASE}/api/engineers/tickets?engineer_id=${engineerId}`
    : `${API_BASE}/api/engineers/tickets`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 工程师接单
 */
export async function acceptTicket({ work_order_id, engineer_id }) {
  const response = await fetch(`${API_BASE}/api/engineers/tickets/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ work_order_id, engineer_id }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 工程师拒单
 */
export async function rejectTicket({ work_order_id, engineer_id }) {
  const response = await fetch(`${API_BASE}/api/engineers/tickets/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ work_order_id, engineer_id }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取工单推荐的工程师列表
 */
export async function getRecommendedEngineers(workOrderId) {
  const response = await fetch(`${API_BASE}/api/engineers/recommend?work_order_id=${workOrderId}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 更新工程师接单状态
 */
export async function updateEngineerStatus({ engineer_id, status }) {
  const response = await fetch(`${API_BASE}/api/engineers/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engineer_id, status }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取工程师档案
 */
export async function getEngineerProfile(engineerId) {
  const response = await fetch(`${API_BASE}/api/engineers/profile?engineer_id=${engineerId}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
