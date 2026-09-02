import { apiFetch } from './client';

export async function getUnreadCount() {
  return apiFetch('/api/notifications/unread-count');
}

export async function getNotifications({ unreadOnly = false, limit = 20, before = null } = {}) {
  const params = new URLSearchParams();
  if (unreadOnly) params.append('unread_only', 'true');
  if (limit) params.append('limit', limit.toString());
  if (before) params.append('before', before);

  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/notifications${query}`);
}

export async function markNotificationRead(id) {
  return apiFetch(`/api/notifications/${id}/read`, {
    method: 'POST',
  });
}

export async function markAllNotificationsRead() {
  return apiFetch('/api/notifications/read-all', {
    method: 'POST',
  });
}
