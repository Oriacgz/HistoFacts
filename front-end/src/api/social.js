import { apiFetch } from './client';

export async function createPostApi(content, eventId = null, groupId = null) {
  return apiFetch('/api/social/posts', {
    method: 'POST',
    body: JSON.stringify({ content, event_id: eventId, group_id: groupId }),
  });
}

export async function getPublicFeedApi() {
  return apiFetch('/api/social/posts');
}

export async function getPostDetailApi(postId) {
  return apiFetch(`/api/social/posts/${postId}`);
}

export async function addCommentApi(postId, content, parentCommentId = null, mentionedUserId = null) {
  return apiFetch(`/api/social/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      parent_comment_id: parentCommentId,
      mentioned_user_id: mentionedUserId,
    }),
  });
}

export async function togglePostLikeApi(postId) {
  return apiFetch(`/api/social/posts/${postId}/like`, {
    method: 'POST',
  });
}
