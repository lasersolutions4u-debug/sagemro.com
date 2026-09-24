import { runtimeConfig } from '../config/runtime.js';

const API_BASE = runtimeConfig.apiBase;
const DEBUG_API = import.meta.env?.DEV;

function authHeaders() {
  const token = localStorage.getItem('admin_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(path, options = {}) {
  const headers = { ...authHeaders(), ...options.headers };
  if (options.body instanceof FormData) delete headers['Content-Type'];
  const method = (options.method || 'GET').toUpperCase();
  const csrfToken = localStorage.getItem('admin_csrf_token');
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  if (DEBUG_API) {
    console.debug('[admin-api]', options.method || 'GET', path, 'hasToken:', !!headers['Authorization']);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`服务器返回非JSON响应 (${res.status})`);
  }
  if (DEBUG_API) {
    console.debug('[admin-api] response:', res.status);
  }
  if (!res.ok) {
    const error = new Error(data.error || `请求失败 (${res.status})`);
    error.status = res.status;
    if (data.code !== undefined) error.code = data.code;
    if (data.field !== undefined) error.field = data.field;
    if (data.fields !== undefined) error.fields = data.fields;
    throw error;
  }
  return data;
}

const PROMOTION_ANALYTICS_FILTER_KEYS = ['from', 'to', 'market', 'source', 'medium', 'campaign'];

function promotionAnalyticsQuery(filters = {}) {
  const params = new URLSearchParams();
  const values = filters || {};
  for (const key of PROMOTION_ANALYTICS_FILTER_KEYS) {
    if (values[key]) params.set(key, values[key]);
  }
  return params.toString();
}

function promotionAnalyticsPath(path, filters) {
  const query = promotionAnalyticsQuery(filters);
  return query ? `${path}?${query}` : path;
}

export async function adminLogin(phone, password) {
  const data = await request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
  if (data.token) localStorage.setItem('admin_token', data.token);
  if (data.csrfToken) {
    localStorage.setItem('admin_csrf_token', data.csrfToken);
    localStorage.removeItem('admin_token');
  }
  return data;
}

export async function restoreAdminSession() {
  try {
    const data = await request('/api/auth/session');
    if (!data.authenticated) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_csrf_token');
      return data;
    }
    if (data.csrfToken) {
      localStorage.setItem('admin_csrf_token', data.csrfToken);
      localStorage.removeItem('admin_token');
    }
    return data;
  } catch (error) {
    if (error?.status === 404 || /404/.test(error?.message || '')) {
      localStorage.removeItem('admin_csrf_token');
      const saved = localStorage.getItem('admin_user');
      return {
        authenticated: Boolean(localStorage.getItem('admin_token') && saved),
        userType: 'admin',
        user: saved ? JSON.parse(saved) : null,
        legacy: true,
      };
    }
    throw error;
  }
}

export async function adminLogout() {
  try {
    return await request('/api/auth/logout', { method: 'POST' });
  } finally {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_csrf_token');
  }
}

export async function getAdminStats() {
  return request('/api/admin/stats');
}

export async function changeAdminPassword(oldPassword, newPassword) {
  return request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export async function getAdminStaffAccounts() {
  return request('/api/admin/staff');
}

export async function createAdminStaffAccount(staff) {
  return request('/api/admin/staff', {
    method: 'POST',
    body: JSON.stringify(staff),
  });
}

export async function deactivateAdminStaffAccount(staffId) {
  return request(`/api/admin/staff/${staffId}/deactivate`, { method: 'POST' });
}

export async function resetAdminStaffPassword(staffId) {
  return request(`/api/admin/staff/${staffId}/reset-password`, { method: 'POST' });
}

export async function getAdminUsers(type = 'customer', page = 1, pageSize = 20, filters = {}) {
  const params = new URLSearchParams({ type, page, pageSize, ...filters });
  return request(`/api/admin/users?${params}`);
}

export async function createAdminUser(userData) {
  return request('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function deleteAdminUser(userId, userType) {
  return request(`/api/admin/users/${userId}?type=${userType}`, {
    method: 'DELETE',
  });
}

export async function getAdminKnowledge(page = 1, pageSize = 20, filters = {}) {
  const params = new URLSearchParams({ page, pageSize, ...filters });
  return request(`/api/admin/knowledge?${params}`);
}

export async function createAdminKnowledge(article) {
  return request('/api/admin/knowledge', {
    method: 'POST',
    body: JSON.stringify(article),
  });
}

export async function updateAdminKnowledge(articleId, article) {
  return request(`/api/admin/knowledge/${articleId}`, {
    method: 'PATCH',
    body: JSON.stringify(article),
  });
}

export async function getAdminKnowledgeCandidates(page = 1, pageSize = 20, status = 'all', options = {}) {
  const params = new URLSearchParams({ page, pageSize, status });
  return request(`/api/admin/knowledge-candidates?${params}`, { signal: options.signal });
}

export async function getAdminKnowledgeCandidate(candidateId, options = {}) {
  return request(`/api/admin/knowledge-candidates/${candidateId}`, { signal: options.signal });
}

export async function updateAdminKnowledgeCandidateEditorial(candidateId, payload) {
  return request(`/api/admin/knowledge-candidates/${candidateId}/editorial`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function submitAdminKnowledgeCandidateReview(candidateId, payload = {}) {
  return request(`/api/admin/knowledge-candidates/${candidateId}/submit-review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function requestAdminKnowledgeCandidateChanges(candidateId, notes) {
  return request(`/api/admin/knowledge-candidates/${candidateId}/request-changes`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function approveAdminKnowledgeCandidate(candidateId, notes) {
  return request(`/api/admin/knowledge-candidates/${candidateId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function rejectAdminKnowledgeCandidate(candidateId, notes) {
  return request(`/api/admin/knowledge-candidates/${candidateId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}
