import { apiFetch } from './client';

export async function getFriendsApi() {
  return apiFetch('/api/auth/friends');
}

export async function addFriendApi(payload) {
  return apiFetch('/api/auth/friends', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeFriendApi(friendId) {
  return apiFetch(`/api/auth/friends/${friendId}`, {
    method: 'DELETE',
  });
}

export async function searchUsersByTagApi(tag) {
  return apiFetch(`/api/auth/search?tag=${encodeURIComponent(tag)}`);
}
