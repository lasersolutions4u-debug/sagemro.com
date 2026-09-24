import { runtimeConfig } from '../config/runtime.js';

// 后台已裁剪为「知识库中枢」：这里只保留 登录/会话、注册用户统计与管理、内部员工账号、知识库、知识候选
// 所需的调用。工单、物料、报价、商务、推广分析、评价、工程师等接口已随业务下线，不要再往回加。
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
  const data = await request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  if (data.token) localStorage.setItem('admin_token', data.token);
  if (data.csrfToken) {
    localStorage.setItem('admin_csrf_token', data.csrfToken);
    localStorage.removeItem('admin_token');
  }
  return data;
}

// ---------- 内部员工账号（只用来分发知识库维护权限） ----------

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

export async function reactivateAdminStaffAccount(staffId) {
  return request(`/api/admin/staff/${staffId}/reactivate`, { method: 'POST' });
}

export async function resetAdminStaffPassword(staffId) {
  return request(`/api/admin/staff/${staffId}/reset-password`, { method: 'POST' });
}

// ---------- 注册用户 ----------

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

// ---------- 知识库 ----------

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

// 批量导入：一行一条知识条目。返回 { total, imported, skipped, failed, results[] }
export async function importAdminKnowledgeBatch(articles, status) {
  return request('/api/admin/knowledge/batch', {
    method: 'POST',
    body: JSON.stringify({ articles, status }),
  });
}

export async function updateAdminKnowledge(articleId, article) {
  return request(`/api/admin/knowledge/${articleId}`, {
    method: 'PATCH',
    body: JSON.stringify(article),
  });
}

// ---------- 知识候选（AI / 服务记录沉淀的待审知识） ----------

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
