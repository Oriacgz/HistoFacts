import { apiFetch } from './client';

export async function createPostApi(content, { title = null, eventId = null, groupId = null } = {}) {
  return apiFetch('/api/social/posts/', {
    method: 'POST',
    body: JSON.stringify({
      content,
      title: title || undefined,
      event_id: eventId || undefined,
      group_id: groupId || undefined,
    }),
  });
}

export async function getPublicFeedApi({ groupId = null, limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (groupId) params.append('group_id', groupId);
  if (limit) params.append('limit', limit);
  if (offset) params.append('offset', offset);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/social/posts/${query}`);
}

export async function getPostDetailApi(postId) {
  return apiFetch(`/api/social/posts/${postId}`);
}

export async function deletePostApi(postId) {
  return apiFetch(`/api/social/posts/${postId}`, {
    method: 'DELETE',
  });
}

export async function addCommentApi(postId, content, { parentCommentId = null, mentionedUserId = null } = {}) {
  return apiFetch(`/api/social/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      parent_comment_id: parentCommentId,
      mentioned_user_id: mentionedUserId,
    }),
  });
}

export async function deleteCommentApi(postId, commentId) {
  return apiFetch(`/api/social/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
  });
}

export async function togglePostLikeApi(postId) {
  return apiFetch(`/api/social/posts/${postId}/like`, {
    method: 'POST',
  });
}

export async function sharePostApi(postId, { shareChannel = 'copy_link', caption = null } = {}) {
  return apiFetch(`/api/social/posts/${postId}/share`, {
    method: 'POST',
    body: JSON.stringify({
      share_channel: shareChannel,
      caption: caption,
    }),
  });
}
