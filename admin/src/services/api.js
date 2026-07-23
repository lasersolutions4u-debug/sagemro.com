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

export async function getMaterialRequisitionMetrics() {
  return request('/api/material-requisitions/metrics');
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

export async function getMaterialRequisitions() {
  return request('/api/material-requisitions');
}

export async function getMaterialRequisition(requisitionId) {
  return request(`/api/material-requisitions/${requisitionId}`);
}

export async function decideMaterialRequisition(requisitionId, action, reason = '') {
  return request(`/api/material-requisitions/${requisitionId}/${action}`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export async function cancelMaterialRequisitionItem(requisitionId, itemId, reason = '') {
  return request(`/api/material-requisitions/${requisitionId}/items/${itemId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export async function updateMaterialRequisitionProcurement(requisitionId, payload) {
  return request(`/api/material-requisitions/${requisitionId}/procurement`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

const QUANTITY_ACTION_PATHS = {
  allocate_stock: 'stock-allocation',
  record_purchase: 'procurement',
  receive_purchase: 'procurement-receipt',
  issue: 'issue',
  return: 'return',
};

export async function postMaterialRequisitionQuantityAction(requisitionId, action, payload, idempotencyKey) {
  const path = QUANTITY_ACTION_PATHS[action];
  if (!path) throw new Error(`Unsupported material requisition action: ${action}`);
  return request(`/api/material-requisitions/${requisitionId}/${path}`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
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

export async function searchAdminServiceLocations(query) {
  const params = new URLSearchParams({ q: query, limit: '5' });
  return request(`/api/location/search?${params}`);
}

export async function confirmAdminOnsiteConversion(workOrderId, data) {
  return request(`/api/admin/workorders/${workOrderId}/onsite-conversion/confirm`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function overrideAdminArrival(workOrderId, reason) {
  return request(`/api/admin/workorders/${workOrderId}/arrival-override`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
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

export async function approveAdminWorkOrderBalance(workOrderId, note = '') {
  return request(`/api/admin/workorders/${workOrderId}/payment/approve-balance`, {
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

export function openAdminEngineerAccount(applicationId, data) {
  return request(`/api/admin/engineer-applications/${applicationId}/open-account`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function resendAdminEngineerActivation(applicationId) {
  return request(`/api/admin/engineer-applications/${applicationId}/resend-activation`, {
    method: 'POST',
    body: JSON.stringify({}),
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
