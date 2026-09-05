import { apiFetch } from './client';

export async function getFriendsApi() {
  return apiFetch('/api/auth/friends');
}

export async function addFriendApi(addresseeId) {
  return apiFetch('/api/auth/friends/request', {
    method: 'POST',
    body: JSON.stringify({ addressee_id: addresseeId }),
  });
}

export async function removeFriendApi(friendId) {
  return apiFetch(`/api/auth/friends/${friendId}`, {
    method: 'DELETE',
  });
}

export async function searchUsersByTagApi(query) {
  return apiFetch(`/api/auth/search?q=${encodeURIComponent(query)}&tag=${encodeURIComponent(query)}`);
}

export async function getIncomingFriendRequestsApi() {
  return apiFetch('/api/auth/friends/requests/incoming');
}

export async function getOutgoingFriendRequestsApi() {
  return apiFetch('/api/auth/friends/requests/outgoing');
}

export async function acceptFriendRequestApi(requestId) {
  return apiFetch(`/api/auth/friends/requests/${requestId}/accept`, {
    method: 'POST',
  });
}

export async function declineFriendRequestApi(requestId) {
  return apiFetch(`/api/auth/friends/requests/${requestId}/decline`, {
    method: 'POST',
  });
}
