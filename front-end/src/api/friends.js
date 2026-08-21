import { apiFetch } from './client';

export async function searchUsersByTagApi(tag) {
  return apiFetch(`/api/auth/search?tag=${encodeURIComponent(tag)}`);
}
