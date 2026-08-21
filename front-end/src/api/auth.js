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
