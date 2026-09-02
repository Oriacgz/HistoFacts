import { apiFetch } from './client';

export async function getConversationsApi() {
  return apiFetch('/api/chat/conversations');
}

export async function getMessagesApi(conversationId, beforeMsgId = null, limit = 30) {
  const params = new URLSearchParams();
  if (beforeMsgId) params.set('before', beforeMsgId);
  params.set('limit', String(limit));
  return apiFetch(`/api/chat/conversations/${conversationId}/messages?${params}`);
}

export async function getNewMessagesApi(conversationId, afterMsgId = null) {
  const params = afterMsgId ? `?after=${afterMsgId}` : '';
  return apiFetch(`/api/chat/conversations/${conversationId}/messages/new${params}`);
}

export async function sendMessageApi(conversationId, payload) {
  return apiFetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getOrCreateDirectApi(friendUserId) {
  return apiFetch(`/api/chat/conversations/direct/${friendUserId}`, {
    method: 'POST',
  });
}

export async function getOrCreateGroupChatApi(groupId) {
  return apiFetch(`/api/chat/conversations/group/${groupId}`, {
    method: 'POST',
  });
}

export async function markAsReadApi(conversationId) {
  return apiFetch(`/api/chat/conversations/${conversationId}/read`, {
    method: 'POST',
  });
}
