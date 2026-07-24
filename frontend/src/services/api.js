// API 服务层
function resolveApiBase() {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.cn')) {
    return 'https://api.sagemro.cn';
  }
  return 'https://api.sagemro.com';
}

const API_BASE = resolveApiBase();

function isApiRequest(url) {
  return typeof url === 'string' && url.startsWith(API_BASE);
}

const FUNNEL_STORAGE_KEYS = {
  anonymousId: 'sagemro_analytics_anonymous_id',
  sessionId: 'sagemro_analytics_session_id',
  source: 'sagemro_analytics_source',
};
const FUNNEL_EVENT_NAMES = [
  'traffic_source_captured',
  'ai_conversation_started',
  'ai_response_received',
  'signup_started',
  'verification_succeeded',
  'signup_completed',
  'device_saved',
  'service_request_created',
];
const FUNNEL_PROPERTY_ALLOWLIST = [
  'entry',
  'market',
  'locale',
  'user_type',
  'authenticated',
  'conversation_id',
  'has_images',
  'response_status',
  'device_type',
  'service_type',
  'urgency',
  'tool_id',
];

function analyticsId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function getStoredAnalyticsValue(key, fallback) {
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const value = typeof fallback === 'function' ? fallback() : fallback;
    localStorage.setItem(key, value);
    return value;
  } catch {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

function currentAttribution() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const fromUrl = {
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
    content: params.get('utm_content') || '',
    term: params.get('utm_term') || '',
  };
  const hasUrlAttribution = Object.values(fromUrl).some(Boolean);
  if (hasUrlAttribution) {
    try {
      localStorage.setItem(FUNNEL_STORAGE_KEYS.source, JSON.stringify(fromUrl));
    } catch { /* ignore */ }
    return fromUrl;
  }
  try {
    return JSON.parse(localStorage.getItem(FUNNEL_STORAGE_KEYS.source) || '{}');
  } catch {
    return {};
  }
}

function sanitizeFunnelProperties(properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {};
  const out = {};
  for (const key of FUNNEL_PROPERTY_ALLOWLIST) {
    if (properties[key] !== undefined && properties[key] !== null) {
      out[key] = properties[key];
    }
  }
  return out;
}

export function trackFunnelEvent(eventName, properties = {}) {
  if (typeof window === 'undefined') return;
  if (!FUNNEL_EVENT_NAMES.includes(eventName)) return;
  const attribution = currentAttribution();
  const safeProperties = sanitizeFunnelProperties(properties);
  const payload = {
    event_name: eventName,
    anonymous_id: getStoredAnalyticsValue(FUNNEL_STORAGE_KEYS.anonymousId, () => analyticsId('anon')),
    session_id: getStoredAnalyticsValue(FUNNEL_STORAGE_KEYS.sessionId, () => analyticsId('session')),
    user_type: localStorage.getItem('sagemro_user_type') || 'guest',
    source: attribution.source || '',
    medium: attribution.medium || '',
    campaign: attribution.campaign || '',
    page_path: window.location.pathname,
    referrer: document.referrer || '',
    properties: {
      ...safeProperties,
      market: window.location.hostname.endsWith('.cn') ? 'cn' : 'com',
      locale: window.location.hostname.endsWith('.cn') ? 'zh-CN' : 'en',
    },
  };

  const body = JSON.stringify(payload);
  const csrfToken = localStorage.getItem('sagemro_csrf_token');
  try {
    if (!csrfToken && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(`${API_BASE}/api/analytics/funnel`, blob)) return;
    }
  } catch { /* fall back to fetch */ }

  fetch(`${API_BASE}/api/analytics/funnel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

const AUTH_FAILURE_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/session',
  '/api/auth/logout',
  '/api/auth/send-code',
  '/api/auth/register/customer',
  '/api/auth/register/engineer',
  '/api/auth/engineer/activate',
  '/api/auth/send-reset-code',
  '/api/auth/reset-password',
]);

function shouldConfirmAuthFailure(rawUrl) {
  try {
    const url = new URL(rawUrl, window.location.origin);
    return isApiRequest(url.href) && !AUTH_FAILURE_EXEMPT_PATHS.has(url.pathname);
  } catch {
    return false;
  }
}

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
    localStorage.removeItem('sagemro_csrf_token');
  } catch { /* localStorage 不可用时忽略 */ }

  if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('sagemro:auth-expired'));
  }
}

let __authFailureConfirmation = null;
async function confirmAuthFailure(nativeFetch) {
  if (__authFailureConfirmation) return __authFailureConfirmation;

  __authFailureConfirmation = (async () => {
    try {
      const headers = new Headers();
      const legacyToken = localStorage.getItem('sagemro_token');
      if (legacyToken) headers.set('Authorization', `Bearer ${legacyToken}`);
      const response = await nativeFetch(`${API_BASE}/api/auth/session`, {
        credentials: 'include',
        headers,
      });
      if (!response.ok) return;

      const session = await response.json().catch(() => ({}));
      if (session.authenticated) return;
      triggerAuthFailure();
    } catch {
      // Network failures cannot prove that the session expired.
    } finally {
      __authFailureConfirmation = null;
    }
  })();

  return __authFailureConfirmation;
}

if (typeof window !== 'undefined' && !window.__sagemroFetchPatched) {
  window.__sagemroFetchPatched = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    let requestInit = init;
    if (isApiRequest(url)) {
      const method = (init?.method || 'GET').toUpperCase();
      const headers = new Headers(init?.headers || {});
      const legacyToken = localStorage.getItem('sagemro_token');
      const csrfToken = localStorage.getItem('sagemro_csrf_token');
      if (legacyToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${legacyToken}`);
      }
      if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        headers.set('X-CSRF-Token', csrfToken);
      }
      requestInit = { ...init, credentials: 'include', headers };
    }
    const response = await nativeFetch(input, requestInit);
    if (response.status === 401 && shouldConfirmAuthFailure(url)) {
      // A single endpoint can reject access without invalidating the whole session.
      // Confirm with the authoritative session endpoint before signing the user out.
      confirmAuthFailure(nativeFetch);
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

let __sessionRestoreOperation = null;
let __logoutOperation = null;

async function waitForAuthTransitions() {
  if (__sessionRestoreOperation) await __sessionRestoreOperation.catch(() => {});
  if (__logoutOperation) await __logoutOperation.catch(() => {});
}

export async function restoreSession() {
  if (__sessionRestoreOperation) return __sessionRestoreOperation;
  const storedUser = localStorage.getItem('sagemro_user');
  const storedType = localStorage.getItem('sagemro_user_type');
  __sessionRestoreOperation = (async () => {
    const response = await fetch(`${API_BASE}/api/auth/session`, { credentials: 'include' });
    const data = await response.json().catch(() => ({}));

    if (response.status === 404) {
      return {
        authenticated: Boolean(localStorage.getItem('sagemro_token') && storedUser && storedType),
        user: storedUser ? JSON.parse(storedUser) : null,
        userType: storedType || null,
        legacy: true,
      };
    }
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  })().finally(() => { __sessionRestoreOperation = null; });
  return __sessionRestoreOperation;
}

export async function logout() {
  if (__logoutOperation) return __logoutOperation;
  __logoutOperation = (async () => {
    const response = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return response.json().catch(() => ({}));
  })().finally(() => { __logoutOperation = null; });
  return __logoutOperation;
}

// ============ 认证相关 ============

/**
 * 发送验证码
 */
export async function sendVerifyCode({ phone, email }) {
  const payload = email ? { email } : { phone };
  const response = await fetch(`${API_BASE}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 客户注册
 */
export async function registerCustomer({ name, phone, email, password, code, company, identity, conversation_id }) {
  const response = await fetch(`${API_BASE}/api/auth/register/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, email, password, code, company, identity, conversation_id }),
  });
  if (!response.ok) {
    const data = await response.json();
    const err = new Error(data.error || `HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

/**
 * 登录
 */
export async function login({ phone, email, password }) {
  await waitForAuthTransitions();
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, email, password }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  if (data.token) localStorage.setItem('sagemro_token', data.token);
  if (data.csrfToken) {
    localStorage.setItem('sagemro_csrf_token', data.csrfToken);
    localStorage.removeItem('sagemro_token');
  }
  return data;
}

/**
 * 激活工程师账号并设置初始密码
 */
export async function activateEngineerAccount({ token, password }) {
  const response = await fetch(`${API_BASE}/api/auth/engineer/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
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
export async function streamChat({ conversationId, message, images, onChunk, onDone, onError, signal, customerId }) {
  try {
    const userType = localStorage.getItem('sagemro_user_type') || 'guest';
    const engineerId = localStorage.getItem('sagemro_engineer_id');

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        conversation_id: conversationId,
        message: message,
        images: images && images.length > 0 ? images : undefined,
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

export async function transcribeVoiceInput(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'voice.webm');

  const response = await fetch(`${API_BASE}/api/chat/transcribe`, {
    method: 'POST',
    headers: authHeadersNoContentType(),
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Transcription failed (${response.status})`);
  }

  return response.json();
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

export async function searchMaterials({ search = '', category = 'all', pageSize = 20 } = {}) {
  const params = new URLSearchParams({ search, category, pageSize });
  const response = await fetch(`${API_BASE}/api/materials?${params}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function getWorkOrderMaterialItems(workOrderId, purpose = '') {
  const params = purpose ? `?purpose=${encodeURIComponent(purpose)}` : '';
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/material-items${params}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function createMaterialRequest(data) {
  const response = await fetch(`${API_BASE}/api/material-requests`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function getMaterialRequisitions(workOrderId) {
  const query = workOrderId ? `?work_order_id=${encodeURIComponent(workOrderId)}` : '';
  const response = await fetch(`${API_BASE}/api/material-requisitions${query}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function getMaterialRequisition(requisitionId) {
  const response = await fetch(`${API_BASE}/api/material-requisitions/${requisitionId}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function createMaterialRequisition(data, idempotencyKey) {
  const response = await fetch(`${API_BASE}/api/material-requisitions`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const data = await response.json();
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function submitMaterialRequisition(requisitionId) {
  const response = await fetch(`${API_BASE}/api/material-requisitions/${requisitionId}/submit`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function confirmMaterialRequisitionReceipt(requisitionId, data, idempotencyKey) {
  const response = await fetch(`${API_BASE}/api/material-requisitions/${requisitionId}/engineer-receipt`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const data = await response.json();
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
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
export async function rejectWorkOrderPricing(workOrderId, customerId, reason, counterOffer = null) {
  const body = { customer_id: customerId, reason };
  if (counterOffer) body.counter_offer = counterOffer;
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/pricing/reject`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ============ 工程师相关 ============

/**
 * 获取工程师的服务任务列表。
 * Service OS 默认只返回后台已派给当前工程师的服务任务。
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

export async function getEngineerTeam() {
  const response = await fetch(`${API_BASE}/api/engineers/team`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function submitEngineerApplication(data) {
  const response = await fetch(`${API_BASE}/api/engineer-applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function getEngineerCalendarEvents(params = {}) {
  const search = new URLSearchParams();
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  const query = search.toString();
  const response = await fetch(`${API_BASE}/api/engineers/calendar-events${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function createEngineerCalendarEvent(data) {
  const response = await fetch(`${API_BASE}/api/engineers/calendar-events`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function deleteEngineerCalendarEvent(eventId) {
  const response = await fetch(`${API_BASE}/api/engineers/calendar-events/${eventId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function assignEngineerWorkOrder({ work_order_id, engineer_id }) {
  const response = await fetch(`${API_BASE}/api/engineers/assign-engineer`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ work_order_id, engineer_id }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * SERVICE_OS_LEGACY: 工程师确认派工兼容接口。
 * 新 Service OS 主路径应使用后台管理员派工。
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
 * SERVICE_OS_LEGACY: 工程师退回调度兼容接口。
 */
export async function rejectTicket({ work_order_id, engineer_id, reason }) {
  const response = await fetch(`${API_BASE}/api/engineers/tickets/reject`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ work_order_id, engineer_id, reason }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * 更新工程师派工状态
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

export async function searchServiceLocations(query) {
  const params = new URLSearchParams({ q: query, limit: '5' });
  const response = await fetch(`${API_BASE}/api/location/search?${params}`, {
    headers: authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function checkInWorkOrder(workOrderId, location) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/arrival-check`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(location),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.reason || `HTTP ${response.status}`);
  return data;
}

export async function checkInFieldDay(workOrderId, { photo, expectedCheckoutTime, location }, idempotencyKey) {
  const formData = new FormData();
  formData.append('photo', photo);
  formData.append('expected_checkout_time', expectedCheckoutTime);
  formData.append('location', JSON.stringify(location || { location_status: 'unavailable' }));

  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/field-days/check-in`, {
    method: 'POST',
    headers: { ...authHeadersNoContentType(), 'Idempotency-Key': idempotencyKey },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function getFieldDays(workOrderId) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/field-days`, {
    headers: authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function submitFieldDayReport(workOrderId, fieldDayId, data, idempotencyKey) {
  const formData = new FormData();
  for (const field of [
    'completed_work',
    'issues_risks',
    'next_plan',
    'customer_support_needed',
    'labor_hours',
    'internal_note',
    'late_reason',
    'extension_reason',
    'extension_customer_explanation',
    'requested_additional_days',
    'proposed_completion_date',
    'extension_internal_note',
  ]) {
    if (data[field] !== undefined && data[field] !== null) formData.append(field, data[field]);
  }
  for (const photo of data.progress_photos || []) formData.append('progress_photos', photo);
  for (const photo of data.internal_photos || []) formData.append('internal_photos', photo);

  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/field-days/${fieldDayId}/report`, {
    method: 'POST',
    headers: { ...authHeadersNoContentType(), 'Idempotency-Key': idempotencyKey },
    body: formData,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

export async function requestFieldExtension(workOrderId, data) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/extension-requests`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

export function fieldMediaUrl(workOrderId, mediaId) {
  return `${API_BASE}/api/workorders/${workOrderId}/field-media/${mediaId}`;
}

export async function requestOnsiteConversion(workOrderId, note) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/onsite-conversion/request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ note }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export async function confirmOnsiteConversion(workOrderId, location) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/onsite-conversion/confirm`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(location),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

/**
 * 客户取消工单
 */
export async function cancelWorkOrder(workOrderId) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/cancel`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Cancellation failed');
  }
  return response.json();
}

// ============ 付款相关 ============

/**
 * 客户模拟付款
 */
export async function payWorkOrder(workOrderId, { payment_method, payment_stage = 'advance' }) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/pay`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ payment_method, payment_stage }),
  });
  if (!response.ok) {
    const d = await response.json();
    throw new Error(d.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function requestWorkOrderPaymentStart(workOrderId, note = '') {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/payment/start-request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ note }),
  });
  if (!response.ok) {
    const d = await response.json();
    throw new Error(d.error || `HTTP ${response.status}`);
  }
  return response.json();
}


/**
 * 获取工单付款记录
 */
export async function getWorkOrderPayment(workOrderId, paymentStage = 'advance') {
  const query = paymentStage ? `?payment_stage=${encodeURIComponent(paymentStage)}` : '';
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/payment${query}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function getWorkOrderPayout(workOrderId) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return { payout: data.payout || null, payout_status: data.payout_status || 'not_ready' };
}

export async function submitInvoiceRequest(workOrderId, invoiceData) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/invoice-request`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(invoiceData),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function getInvoiceRequest(workOrderId) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/invoice-request`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
  const result = await response.json();
  trackFunnelEvent('device_saved', { device_type: type, authenticated: true });
  return result;
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
export async function updateEngineerProfile({
  name,
  bio,
  service_region,
  payout_method,
  paypal_account,
  bank_country,
  bank_name,
  bank_account,
  bank_branch,
  bank_swift_code,
  account_holder,
  payout_notes,
}) {
  const response = await fetch(`${API_BASE}/api/engineers/profile`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      bio,
      service_region,
      payout_method,
      paypal_account,
      bank_country,
      bank_name,
      bank_account,
      bank_branch,
      bank_swift_code,
      account_holder,
      payout_notes,
    }),
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

// ============ 维修记录 ============

export async function saveRepairRecord(workOrderId, data) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/repair-record`, {
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

// ============ 工单附件 ============

function authHeadersNoContentType() {
  const headers = {};
  const token = localStorage.getItem('sagemro_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function uploadWorkOrderAttachment(workOrderId, file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/attachments`, {
    method: 'POST',
    headers: authHeadersNoContentType(),
    body: formData,
  });
  if (!response.ok) {
    const d = await response.json().catch(() => ({}));
    throw new Error(d.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function getWorkOrderAttachments(workOrderId) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/attachments`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function deleteWorkOrderAttachment(workOrderId, attachmentId) {
  const response = await fetch(`${API_BASE}/api/workorders/${workOrderId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function createMachineLead(data) {
  const response = await fetch(`${API_BASE}/api/leads/machine`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json();
}
