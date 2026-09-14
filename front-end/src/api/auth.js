import { apiFetch } from './client';

export async function registerApi({ username, email, password }) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
}

export async function loginApi({ email, password }) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
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

