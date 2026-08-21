import { apiFetch } from './client';

export async function getTodayEventsApi() {
  return apiFetch('/api/events/today');
}

export async function getEventsByDateApi(month, day) {
  return apiFetch(`/api/events/date/${month}/${day}`);
}

export async function searchEventsApi(query, category = '', country = '') {
  const params = new URLSearchParams({ q: query });
  if (category) params.append('category', category);
  if (country) params.append('country', country);
  return apiFetch(`/api/events/search?${params.toString()}`);
}

export async function addBookmarkApi(eventId) {
  return apiFetch(`/api/events/bookmarks/${eventId}`, {
    method: 'POST',
  });
}

export async function removeBookmarkApi(eventId) {
  return apiFetch(`/api/events/bookmarks/${eventId}`, {
    method: 'DELETE',
  });
}

export async function getMyBookmarksApi() {
  return apiFetch('/api/events/bookmarks/me');
}
