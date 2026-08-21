import { apiFetch } from './client';

export async function createGroupApi(name, description = '') {
  return apiFetch('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function getMyGroupsApi() {
  return apiFetch('/api/groups');
}

export async function joinGroupApi(groupId) {
  return apiFetch(`/api/groups/${groupId}/join`, {
    method: 'POST',
  });
}
