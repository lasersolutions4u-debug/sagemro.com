const API_BASE = import.meta.env.VITE_API_BASE || 'https://sagemro-api.lasersolutions4u.workers.dev';

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
  console.log('[admin-api]', options.method || 'GET', path, 'hasToken:', !!headers['Authorization']);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`服务器返回非JSON响应 (${res.status})`);
  }
  console.log('[admin-api] response:', res.status, data);
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

export async function adminLogin(phone, password) {
  return request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
}

export async function getAdminStats() {
  return request('/api/admin/stats');
}

export async function getAdminUsers(type = 'customer', page = 1, pageSize = 20, filters = {}) {
  const params = new URLSearchParams({ type, page, pageSize, ...filters });
  return request(`/api/admin/users?${params}`);
}

export async function getAdminWorkOrders(status = 'all', page = 1, pageSize = 20) {
  return request(`/api/admin/workorders?status=${status}&page=${page}&pageSize=${pageSize}`);
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

export async function getAdminRatings(page = 1, pageSize = 20, filters = {}) {
  const params = new URLSearchParams({ page, pageSize, ...filters });
  return request(`/api/admin/ratings?${params}`);
}

export async function replyToRating(ratingId, content) {
  return request(`/api/admin/ratings/${ratingId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function getAdminPlatformRatings(page = 1, pageSize = 20) {
  return request(`/api/admin/platform-ratings?page=${page}&pageSize=${pageSize}`);
}

export async function getAdminCustomerRatings(page = 1, pageSize = 20) {
  return request(`/api/admin/customer-ratings?page=${page}&pageSize=${pageSize}`);
}
