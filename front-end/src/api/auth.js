import { apiFetch } from './client';

export async function registerApi({ username, email, password }) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
}

export async function loginApi({ email, password, totp_code }) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, totp_code }),
  });
}

export async function getMeApi() {
  return apiFetch('/api/auth/me');
}

export async function updateProfileApi(profileData) {
  return apiFetch('/api/auth/users/me', {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
}

export async function uploadAvatarApi(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch('/api/auth/users/me/avatar', {
    method: 'POST',
    body: formData,
  });
}

export async function changePasswordApi({ current_password, new_password }) {
  return apiFetch('/api/auth/users/me/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  });
}

export async function requestEmailChangeApi({ new_email }) {
  return apiFetch('/api/auth/users/me/change-email', {
    method: 'POST',
    body: JSON.stringify({ new_email }),
  });
}

export async function confirmEmailChangeApi(token) {
  return apiFetch(`/api/auth/users/me/change-email/confirm?token=${encodeURIComponent(token)}`);
}

// ── Sessions Management ───────────────────────────────────────────────────────
export async function getSessionsApi() {
  return apiFetch('/api/auth/users/me/sessions');
}

export async function revokeSessionApi(sessionId) {
  return apiFetch(`/api/auth/users/me/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

// ── Two-Factor Authentication (TOTP) ──────────────────────────────────────────
export async function setup2FAApi() {
  return apiFetch('/api/auth/users/me/2fa/setup', {
    method: 'POST',
  });
}

export async function enable2FAApi(code) {
  return apiFetch('/api/auth/users/me/2fa/enable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function disable2FAApi({ password, code }) {
  return apiFetch('/api/auth/users/me/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ password, code }),
  });
}

// ── Preferences ───────────────────────────────────────────────────────────────
export async function getPreferencesApi() {
  return apiFetch('/api/auth/users/me/preferences');
}

export async function updatePreferencesApi(preferences) {
  return apiFetch('/api/auth/users/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(preferences),
  });
}

// ── Blocked Users ─────────────────────────────────────────────────────────────
export async function getBlockedUsersApi() {
  return apiFetch('/api/auth/users/me/blocked');
}

export async function blockUserApi(userId) {
  return apiFetch(`/api/auth/users/${userId}/block`, {
    method: 'POST',
  });
}

export async function unblockUserApi(userId) {
  return apiFetch(`/api/auth/users/${userId}/block`, {
    method: 'DELETE',
  });
}

// ── Account Deletion & Data Export ────────────────────────────────────────────
export async function scheduleAccountDeletionApi() {
  return apiFetch('/api/auth/users/me/delete', {
    method: 'POST',
  });
}

export async function cancelAccountDeletionApi() {
  return apiFetch('/api/auth/users/me/delete/cancel', {
    method: 'POST',
  });
}

export async function exportUserDataApi() {
  const token = localStorage.getItem('access_token');
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const res = await fetch(`${baseUrl}/api/auth/users/me/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to export data' }));
    throw new Error(err.detail || 'Failed to export data');
  }
  return res.blob();
}
