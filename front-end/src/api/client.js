const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized — attempt refresh once
  if (response.status === 401 && !options._retry && localStorage.getItem('refresh_token')) {
    options._retry = true;
    const refreshed = await attemptRefreshToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${localStorage.getItem('access_token')}`;
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Network or server error' }));
    const error = new Error(errorData.detail || 'An error occurred');
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return response.json();
}

async function attemptRefreshToken() {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      return false;
    }

    const data = await res.json();
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return true;
  } catch {
    return false;
  }
}
