import { runtimeConfig } from '../config/runtime';

const API_BASE = runtimeConfig.apiBase;
const DEBUG_API = import.meta.env.DEV;

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
  if (DEBUG_API) {
    console.debug('[admin-api]', options.method || 'GET', path, 'hasToken:', !!headers['Authorization']);
  }
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
  if (DEBUG_API) {
    console.debug('[admin-api] response:', res.status);
  }
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

export async function getAdminEngineerDetail(engineerId) {
  return request(`/api/admin/engineers/${engineerId}`);
}

export async function updateAdminEngineer(engineerId, data) {
  return request(`/api/admin/engineers/${engineerId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getAdminWorkOrders(status = 'all', page = 1, pageSize = 20) {
  return request(`/api/admin/workorders?status=${status}&page=${page}&pageSize=${pageSize}`);
}

export async function getAdminWorkOrder(workOrderId) {
  return request(`/api/workorders/${workOrderId}`);
}

export async function getAdminWorkOrderMessages(workOrderId) {
  return request(`/api/workorders/${workOrderId}/messages`);
}

export async function postAdminWorkOrderMessage(workOrderId, content, isInternalNote = true) {
  return request(`/api/workorders/${workOrderId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, is_internal_note: isInternalNote }),
  });
}

export async function assignAdminWorkOrder(workOrderId, engineerId) {
  return request(`/api/admin/workorders/${workOrderId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ engineer_id: engineerId }),
  });
}

export async function assignAdminWorkOrderRegionalLead(workOrderId, regionalLeadId) {
  return request(`/api/admin/workorders/${workOrderId}/assign-regional-lead`, {
    method: 'PATCH',
    body: JSON.stringify({ regional_lead_id: regionalLeadId }),
  });
}

export async function approveAdminWorkOrderPricing(workOrderId) {
  return request(`/api/admin/workorders/${workOrderId}/pricing/approve`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}

export async function rejectAdminWorkOrderPricing(workOrderId, note = '') {
  return request(`/api/admin/workorders/${workOrderId}/pricing/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  });
}


export async function approveAdminWorkOrderPaymentStart(workOrderId, note = '') {
  return request(`/api/admin/workorders/${workOrderId}/payment/approve-start`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export async function updateAdminWorkOrderPayout(workOrderId, data) {
  return request(`/api/admin/workorders/${workOrderId}/payout`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function archiveAdminWorkOrder(workOrderId) {
  return request(`/api/admin/workorders/${workOrderId}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}

export async function createAdminUser(userData) {
  return request('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function getAdminEngineerApplications(page = 1, pageSize = 20, status = 'all', market = 'all') {
  const params = new URLSearchParams({ page, pageSize, status, market });
  return request(`/api/admin/engineer-applications?${params}`);
}

export async function updateAdminEngineerApplication(applicationId, data) {
  return request(`/api/admin/engineer-applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
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

export async function getAdminLeads(page = 1, pageSize = 20, status = 'all') {
  return request(`/api/admin/leads?page=${page}&pageSize=${pageSize}&status=${status}`);
}

export async function updateAdminLead(leadId, status) {
  return request(`/api/admin/leads/${leadId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
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

export async function getAdminMaterials(page = 1, pageSize = 20, filters = {}) {
  const params = new URLSearchParams({ page, pageSize, ...filters });
  return request(`/api/admin/materials?${params}`);
}

export async function getAdminMaterialRequests(page = 1, pageSize = 20, filters = {}) {
  const params = new URLSearchParams({ page, pageSize, ...filters });
  return request(`/api/admin/material-requests?${params}`);
}

export async function reviewAdminMaterialRequest(requestId, payload) {
  return request(`/api/admin/material-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createAdminMaterial(material) {
  return request('/api/admin/materials', {
    method: 'POST',
    body: JSON.stringify(material),
  });
}

export async function updateAdminMaterial(materialId, material) {
  return request(`/api/admin/materials/${materialId}`, {
    method: 'PATCH',
    body: JSON.stringify(material),
  });
}

export async function adjustAdminMaterialInventory(materialId, adjustment) {
  return request(`/api/admin/materials/${materialId}/inventory-adjustments`, {
    method: 'POST',
    body: JSON.stringify(adjustment),
  });
}
