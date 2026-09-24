import {
  ANALYTICS_VERSION,
  createAnalyticsId,
  resolveAnalyticsSession,
  resolveTrafficAttribution,
} from './funnelAnalytics';

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
  'bend_simulator_started',
  'bend_simulator_segment_adjusted',
  'bend_simulator_completed',
  'seo_landing_viewed',
  'content_engaged',
  'tool_started',
  'tool_completed',
  'conversion_cta_clicked',
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
  'request_id',
  'analytics_version',
  'content_type',
  'content_slug',
  'cta_type',
  'engagement_bucket',
  'result_state',
];

function getAnalyticsStorage() {
  try {
    const storage = localStorage;
    storage.getItem(FUNNEL_STORAGE_KEYS.anonymousId);
    return { storage, available: true };
  } catch {
    return { storage: null, available: false };
  }
}

function getAnalyticsStorageValue(storage, key, fallback = null) {
  try {
    return storage?.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function getStoredAnalyticsValue(storage, key, fallback) {
  try {
    const existing = storage?.getItem(key);
    if (existing) return existing;
    const value = typeof fallback === 'function' ? fallback() : fallback;
    storage?.setItem(key, value);
    return value;
  } catch {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

function currentAttribution(storage) {
  if (typeof window === 'undefined') return {};
  let stored = {};
  try {
    stored = JSON.parse(storage?.getItem(FUNNEL_STORAGE_KEYS.source) || '{}');
  } catch { /* ignore */ }
  const attribution = resolveTrafficAttribution({
    search: window.location.search,
    referrer: document.referrer || '',
    siteHostname: window.location.hostname,
    stored,
  });
  const source = attribution.source.trim().toLowerCase();
  const medium = attribution.medium.trim().toLowerCase();
  if (source && source !== 'direct' && medium && medium !== 'direct' && medium !== 'none') {
    try {
      storage?.setItem(FUNNEL_STORAGE_KEYS.source, JSON.stringify(attribution));
    } catch { /* ignore */ }
  }
  return attribution;
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
  const { storage, available: storageAvailable } = getAnalyticsStorage();
  const attribution = currentAttribution(storage);
  const safeProperties = sanitizeFunnelProperties(properties);
  const payload = {
    event_name: eventName,
    anonymous_id: getStoredAnalyticsValue(storage, FUNNEL_STORAGE_KEYS.anonymousId, () => createAnalyticsId('anon')),
    session_id: resolveAnalyticsSession(storage),
    user_type: getAnalyticsStorageValue(storage, 'sagemro_user_type', 'guest'),
    source: attribution.source || '',
    medium: attribution.medium || '',
    campaign: attribution.campaign || '',
    page_path: window.location.pathname,
    referrer: document.referrer || '',
    properties: {
      ...safeProperties,
      analytics_version: ANALYTICS_VERSION,
      market: window.location.hostname.endsWith('.cn') ? 'cn' : 'com',
      locale: window.location.hostname.endsWith('.cn') ? 'zh-CN' : 'en',
    },
  };

  const body = JSON.stringify(payload);
  const csrfToken = getAnalyticsStorageValue(storage, 'sagemro_csrf_token');
  try {
    if (storageAvailable && !csrfToken && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(`${API_BASE}/api/analytics/funnel`, blob)) return;
    }
  } catch { /* fall back to fetch */ }

  fetch(`${API_BASE}/api/analytics/funnel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: storageAvailable ? 'include' : 'omit',
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
      const { storage, available: storageAvailable } = getAnalyticsStorage();
      const legacyToken = getAnalyticsStorageValue(storage, 'sagemro_token');
      if (legacyToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${legacyToken}`);
      const csrfToken = getAnalyticsStorageValue(storage, 'sagemro_csrf_token');
      if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        headers.set('X-CSRF-Token', csrfToken);
      }
      const isAnonymousAnalyticsFallback = url === `${API_BASE}/api/analytics/funnel`
        && !storageAvailable
        && init?.credentials === 'omit';
      requestInit = {
        ...init,
        credentials: isAnonymousAnalyticsFallback ? 'omit' : 'include',
        headers,
      };
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

// 上传表单（语音转写等）不能带 Content-Type，否则 multipart 边界会丢。
function authHeadersNoContentType() {
  const headers = {};
  const token = localStorage.getItem('sagemro_token');
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
    const data = await response.json().catch(() => ({ authenticated: false }));
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
    const response = await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
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

export async function registerCustomer({ name, phone, email, password, code, company, identity }) {
  const response = await fetch(`${API_BASE}/api/auth/register/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, email, password, code, company, identity }),
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

export async function sendResetCode({ phone, email }) {
  const response = await fetch(`${API_BASE}/api/auth/send-reset-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(email ? { email } : { phone }),
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

export async function resetPassword({ phone, email, code, newPassword }) {
  const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(email ? { email } : { phone }), code, newPassword }),
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

export async function streamChat({ conversationId, message, images, onChunk, onDone, onError, signal, customerId, serviceRequestOnly = false }) {
  try {
    const userType = localStorage.getItem('sagemro_user_type') || 'guest';
    const engineerId = localStorage.getItem('sagemro_engineer_id');

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        conversation_id: conversationId,
        message: message,
        service_request_only: serviceRequestOnly,
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
          onDone?.({ completed: true });
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

    onDone?.({ completed: false });
  } catch (error) {
    if (error.name === 'AbortError') {
      onDone?.({ completed: false });
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

// ============ 工程师招募与咨询线索 ============

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

export async function submitBendSimulationReview({ contact = {}, simulation = {} }) {
  const source = simulation.input || simulation;
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const payload = {
    contact: {
      name: typeof contact.name === 'string' ? contact.name.trim() : '',
      company: typeof contact.company === 'string' ? contact.company.trim() : '',
      email: typeof contact.email === 'string' ? contact.email.trim() : '',
      phone: typeof contact.phone === 'string' ? contact.phone.trim() : '',
    },
    simulation: {
      unit_system: source.unitSystem === 'imperial' ? 'imperial' : 'metric',
      material: typeof source.material === 'string' ? source.material : source.material?.id || '',
      thickness_mm: number(source.thicknessMm),
      bend_length_mm: number(source.sheetWidthMm),
      machine: typeof source.machine === 'string' ? source.machine : source.machine?.id || '',
      upper_tool: typeof source.upperTool === 'string' ? source.upperTool : source.upperTool?.id || '',
      lower_tool: typeof source.lowerTool === 'string' ? source.lowerTool : source.lowerTool?.id || '',
      segments: Array.isArray(source.segments) ? source.segments.map((segment) => ({ span_length_mm: number(segment.lengthMm), angle_deg: number(segment.angleDeg), inside_radius_mm: number(segment.insideRadiusMm), order: number(segment.order) })) : [],
      flange_lengths_mm: Array.isArray(simulation.flangeLengthsMm) ? simulation.flangeLengthsMm.map(number) : [],
      result_status: simulation.resultStatus === 'ready' ? 'ready' : 'review_required',
      warning_codes: Array.isArray(simulation.warnings) ? simulation.warnings.map((warning) => warning?.code).filter((code) => typeof code === 'string') : [],
      flat_length_mm: number(simulation.flatLengthMm),
      bend_allowance_mm: number(simulation.totalBendAllowanceMm),
      required_tonnage: number(simulation.tonnage?.withSafetyTons),
    },
  };
  const headers = typeof localStorage === 'undefined' ? { 'Content-Type': 'application/json' } : authHeaders();
  const response = await fetch(`${API_BASE}/api/leads/bend-simulation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// 主站咨询线索表单：写入 leads，不进入工单流程。
export async function submitConsultation(data) {
  const response = await fetch(`${API_BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: typeof data?.name === 'string' ? data.name.trim() : '',
      company: typeof data?.company === 'string' ? data.company.trim() : '',
      email: typeof data?.email === 'string' ? data.email.trim() : '',
      phone: typeof data?.phone === 'string' ? data.phone.trim() : '',
      message: typeof data?.message === 'string' ? data.message.trim() : '',
      source: data?.source || 'website_contact',
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}
