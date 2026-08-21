import { apiFetch } from './client';

export async function generateNoteApi(topic, curriculum, eventId = null) {
  return apiFetch('/api/notes/generate', {
    method: 'POST',
    body: JSON.stringify({ topic, curriculum, event_id: eventId }),
  });
}

export async function getMyNotesApi() {
  return apiFetch('/api/notes');
}

export async function updateNoteApi(noteId, title, content, curriculumTag) {
  return apiFetch(`/api/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify({ title, content, curriculum_tag: curriculumTag }),
  });
}

export async function shareNoteToGroupApi(noteId, groupId) {
  return apiFetch(`/api/notes/${noteId}/share/${groupId}`, {
    method: 'POST',
  });
}
