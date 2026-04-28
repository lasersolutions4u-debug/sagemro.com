// API 服务层
const API_BASE = import.meta.env.VITE_API_BASE || 'https://sagemro-api.lasersolutions4u.workers.dev';

// 401 统一拦截：当任意认证接口返回 401 时，清理本地 token 并派发事件，
// 由 App.jsx 订阅后自动登出并弹出登录框。避免用户在 token 过期后看到一堆
// "HTTP 401" 红色弹窗但登录状态仍保持的混乱体验。
//
// 实现方式：猴子补丁 window.fetch，只对 API_BASE 开头的请求生效，
// 其他外部资源（如 CDN / OneSignal）完全不受影响。已做幂等保护，
// 避免 HMR 或重复加载时装多层。
let __authFailureTriggered = false;
function triggerAuthFailure() {
  // 同一帧内多个并发请求同时返回 401 时只触发一次
  if (__authFailureTriggered) return;
  __authFailureTriggered = true;
  // 下一帧重置，允许后续独立的 401 再次触发
  setTimeout(() => { __authFailureTriggered = false; }, 500);

  try {
    localStorage.removeItem('sagemro_token');
    localStorage.removeItem('sagemro_user');
    localStorage.removeItem('sagemro_user_type');
    localStorage.removeItem('sagemro_customer_id');
    localStorage.removeItem('sagemro_engineer_id');
  } catch { /* localStorage 不可用时忽略 */ }

  if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('sagemro:auth-expired'));
  }
}

if (typeof window !== 'undefined' && !window.__sagemroFetchPatched) {
  window.__sagemroFetchPatched = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await nativeFetch(input, init);
    // 只对本平台 API 的 401 触发：避免干扰第三方 SDK（OneSignal 等）
    if (response.status === 401 && url.startsWith(API_BASE)) {
      // 不 clone response 消费 body — 交给调用方处理错误文案
      triggerAuthFailure();
    }
    return response;
  };
}

// 获取认证请求头（自动附带 JWT token）
function authHeaders() {
  const token = localStorage.getItem('sagemro_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

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
export async function registerCustomer({ name, phone, password, code, company, identity }) {
  const response = await fetch(`${API_BASE}/api/auth/register/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, password, code, company, identity }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 工程师入驻
 */
export async function registerEngineer({ name, phone, password, code, specialties, brands, services, service_region, bio, company }) {
  const response = await fetch(`${API_BASE}/api/auth/register/engineer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, password, code, specialties, brands, services, service_region, bio, company }),
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
    const userType = localStorage.getItem('sagemro_user_type') || 'guest';
    const engineerId = localStorage.getItem('sagemro_engineer_id');

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        message: message,
        customer_id: customerId || localStorage.getItem('sagemro_customer_id'),
        engineer_id: engineerId,
        user_type: userType,
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
  const response = await fetch(`${API_BASE}/api/conversations`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取对话详情
 */
export async function getConversation(id) {
  const response = await fetch(`${API_BASE}/api/conversations/${id}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 删除对话
 */
export async function deleteConversation(id) {
  const response = await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 重命名对话
 */
export async function renameConversation(id, title) {
  const response = await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============ 工单相关 ============

/**
 * 提交工单
 */
export async function submitWorkOrder(data) {
  const response = await fetch(`${API_BASE}/api/workorders`, {
    method: 'POST',
    headers: authHeaders(),
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
  const response = await fetch(url, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取工单详情
 */
export async function getWorkOrder(id) {
  const response = await fetch(`${API_BASE}/api/workorders/${id}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 提交评价
 */
export async function submitRating(data) {
  const response = await fetch(`${API_BASE}/api/workorders/rating`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============ 工单消息与核价 ============

/**
 * 获取工单消息列表
 */
export async function getWorkOrderMessages(workOrderId) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/messages`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 发送工单消息
 */
export async function postWorkOrderMessage(workOrderId, data) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取工单核价信息
 */
export async function getWorkOrderPricing(workOrderId) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/pricing`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 工程师提交/更新核价
 */
export async function submitWorkOrderPricing(workOrderId, data) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/pricing`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const d = await response.json();
    throw new Error(d.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 客户确认报价
 */
export async function confirmWorkOrderPricing(workOrderId, customerId) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/pricing/confirm`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ customer_id: customerId }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 客户拒绝/议价
 */
export async function rejectWorkOrderPricing(workOrderId, customerId, reason) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/pricing/reject`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ customer_id: customerId, reason }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
  const response = await fetch(url, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 工程师接单
 */
export async function acceptTicket({ work_order_id, engineer_id }) {
  const response = await fetch(`${API_BASE}/api/engineers/tickets/accept`, {
    method: 'POST',
    headers: authHeaders(),
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
    headers: authHeaders(),
    body: JSON.stringify({ work_order_id, engineer_id }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取工单推荐的工程师列表
 */
export async function getRecommendedEngineers(workOrderId) {
  const response = await fetch(`${API_BASE}/api/engineers/recommend?work_order_id=${workOrderId}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 更新工程师接单状态
 */
export async function updateEngineerStatus({ engineer_id, status }) {
  const response = await fetch(`${API_BASE}/api/engineers/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ engineer_id, status }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取工程师档案
 */
export async function getEngineerProfile(engineerId) {
  const response = await fetch(`${API_BASE}/api/engineers/profile?engineer_id=${engineerId}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 工程师标记服务完成
 */
export async function resolveWorkOrder(workOrderId, engineerId) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/resolve`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ engineer_id: engineerId }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ============ 工程师钱包与保证金 ============

/**
 * 获取工程师钱包信息
 */
export async function getEngineerWallet(engineerId) {
  const url = engineerId
    ? `${API_BASE}/api/engineers/wallet?engineer_id=${engineerId}`
    : `${API_BASE}/api/engineers/wallet`;
  const response = await fetch(url, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 申请提现
 */
export async function applyWithdraw(amount) {
  const response = await fetch(`${API_BASE}/api/engineers/wallet/withdraw`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount }),
  });
  if (!response.ok) {
    const d = await response.json();
    throw new Error(d.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// 保存推送订阅（OneSignal Player ID）
// 后端按 JWT 里的 userType 自动路由到 customers / engineers 表
export async function savePushSubscription(userId, { onesignal_player_id }) {
  const response = await fetch(`${API_BASE}/api/push-subscription`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      user_id: userId,
      onesignal_player_id,
    }),
  });
  if (!response.ok) {
    const d = await response.json();
    throw new Error(d.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============ 设备管理 ============

/**
 * 获取客户的所有设备
 */
export async function getDevices() {
  const response = await fetch(`${API_BASE}/api/devices`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取单个设备详情（含维修记录）
 */
export async function getDevice(deviceId) {
  const response = await fetch(`${API_BASE}/api/devices/${deviceId}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 添加新设备
 */
export async function createDevice({ name, type, brand, model, power }) {
  const response = await fetch(`${API_BASE}/api/devices`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, type, brand, model, power }),
  });
  if (!response.ok) {
    const d = await response.json();
    throw new Error(d.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 更新设备
 */
export async function updateDevice(deviceId, { name, type, brand, model, power, status, photo_url, notes }) {
  const response = await fetch(`${API_BASE}/api/devices/${deviceId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name, type, brand, model, power, status, photo_url, notes }),
  });
  if (!response.ok) {
    const d = await response.json();
    throw new Error(d.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 删除设备
 */
export async function deleteDevice(deviceId) {
  const response = await fetch(`${API_BASE}/api/devices/${deviceId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ============ 通知相关 ============

/**
 * 获取当前用户的通知列表
 */
export async function getNotifications(limit = 50, offset = 0) {
  const response = await fetch(`${API_BASE}/api/notifications?limit=${limit}&offset=${offset}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取未读通知数量
 */
export async function getUnreadNotificationCount() {
  const response = await fetch(`${API_BASE}/api/notifications/unread-count`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 标记单条通知为已读
 */
export async function markNotificationRead(notificationId) {
  const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 标记所有通知为已读
 */
export async function markAllNotificationsRead() {
  const response = await fetch(`${API_BASE}/api/notifications/read-all`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ============ 个人中心 ============

/**
 * 更新客户档案
 */
export async function updateCustomerProfile({ name, region }) {
  const response = await fetch(`${API_BASE}/api/customers/profile`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, region }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 更新工程师档案
 */
export async function updateEngineerProfile({ name, bio, service_region }) {
  const response = await fetch(`${API_BASE}/api/engineers/profile`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, bio, service_region }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 修改密码
 */
export async function changePassword({ oldPassword, newPassword }) {
  const response = await fetch(`${API_BASE}/api/auth/change-password`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ============ 工程师评价客户 ============

/**
 * 提交工程师对客户的评价
 */
export async function submitEngineerReview(workOrderId, data) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/engineer-review`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const d = await response.json();
    throw new Error(d.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 获取工单的工程师评价
 */
export async function getEngineerReview(workOrderId) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/engineer-review`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 获取客户的所有工程师评价（仅工程师/平台可见）
 */
export async function getCustomerReviews(customerId) {
  const response = await fetch(`${API_BASE}/api/customers/${customerId}/reviews`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
