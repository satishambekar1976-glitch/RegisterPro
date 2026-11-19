/**
 * RegisterPro API Client
 */
const API = {
  TOKEN_KEY: 'rp_session_token',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(this.TOKEN_KEY, token);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = options.headers || {};

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const contentType = response.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType.includes('text/csv')) {
        return response.blob();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  },

  // Public
  getConfig() {
    return this.request('/api/config');
  },

  getSponsor(code) {
    return this.request(`/api/sponsor/${encodeURIComponent(code)}`);
  },

  register(data) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  login(credentials) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  },

  getMe() {
    return this.request('/api/auth/me');
  },

  submitPayment(formData) {
    return this.request('/api/auth/payment', {
      method: 'POST',
      body: formData
    });
  },

  // Member
  getMemberDashboard() {
    return this.request('/api/member/dashboard');
  },

  getMemberDownlines(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/member/downline?${query}`);
  },

  getMemberTree(rootId = '') {
    return this.request(`/api/member/tree?rootId=${encodeURIComponent(rootId)}`);
  },

  getMemberDevices() {
    return this.request('/api/member/devices');
  },

  createDeviceOrder(formData) {
    return this.request('/api/member/orders', {
      method: 'POST',
      body: formData
    });
  },

  getMyOrders() {
    return this.request('/api/member/orders');
  },

  getMyCommissions() {
    return this.request('/api/member/commissions');
  },

  requestWithdrawal(data) {
    return this.request('/api/member/withdraw', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getMyWithdrawals() {
    return this.request('/api/member/withdrawals');
  },

  // Admin
  getAdminOverview() {
    return this.request('/api/admin/overview');
  },

  getAdminMembers() {
    return this.request('/api/admin/members');
  },

  verifyMemberPayment(userId) {
    return this.request(`/api/admin/members/${userId}/verify-payment`, {
      method: 'POST'
    });
  },

  rejectMemberPayment(userId) {
    return this.request(`/api/admin/members/${userId}/reject-payment`, {
      method: 'POST'
    });
  },

  getAdminDevices() {
    return this.request('/api/admin/devices');
  },

  addDevice(deviceData) {
    return this.request('/api/admin/devices', {
      method: 'POST',
      body: JSON.stringify(deviceData)
    });
  },

  updateDevice(id, deviceData) {
    return this.request(`/api/admin/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(deviceData)
    });
  },

  deleteDevice(id) {
    return this.request(`/api/admin/devices/${id}`, {
      method: 'DELETE'
    });
  },

  getAdminOrders() {
    return this.request('/api/admin/orders');
  },

  approveOrder(orderId) {
    return this.request(`/api/admin/orders/${orderId}/approve`, {
      method: 'POST'
    });
  },

  rejectOrder(orderId) {
    return this.request(`/api/admin/orders/${orderId}/reject`, {
      method: 'POST'
    });
  },

  getAdminCommissions() {
    return this.request('/api/admin/commissions');
  },

  getAdminWithdrawals() {
    return this.request('/api/admin/withdrawals');
  },

  processWithdrawal(id, data) {
    return this.request(`/api/admin/withdrawals/${id}/process`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getAdminSettings() {
    return this.request('/api/admin/settings');
  },

  updateAdminSettings(settings) {
    return this.request('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  }
};

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}
