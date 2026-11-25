// CareFlow Universal Client & Auth Helper
const API_BASE = (window.location.protocol === 'file:' || (window.location.port !== '3000' && window.location.port !== ''))
  ? 'http://localhost:3000'
  : '';

function getToken() {
  return localStorage.getItem('cf_token') || '';
}

function setSession(user, token) {
  if (token) localStorage.setItem('cf_token', token);
  if (user) localStorage.setItem('cf_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('cf_token');
  localStorage.removeItem('cf_user');
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('cf_user')) || null;
  } catch (e) {
    return null;
  }
}

async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : (API_BASE + endpoint);
  const headers = options.headers || {};
  const token = getToken();

  if (token && !headers['Authorization']) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  if (!headers['Content-Type'] && options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });
}

async function getCurrentUser() {
  // Check stored user first
  let user = getStoredUser();
  try {
    const res = await apiFetch('/api/auth/session');
    const data = await res.json();
    if (data && data.user) {
      user = data.user;
      setSession(user, getToken());
    }
  } catch (e) {}
  return user;
}

async function quickSwitchRole(role) {
  try {
    const res = await apiFetch('/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ role })
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setSession(data.user, data.token);
      window.location.reload();
    }
  } catch (e) {
    console.error('Role switch failed:', e);
  }
}

async function doLogout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  clearSession();
  window.location.href = '/';
}
