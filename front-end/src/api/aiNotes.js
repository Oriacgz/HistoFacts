import { apiFetch } from './client';

export async function generateNoteApi(paramsOrTopic, curriculum = 'NCERT Class 10 History', eventId = null) {
  let body = {};
  if (typeof paramsOrTopic === 'object' && paramsOrTopic !== null) {
    body = {
      topic: paramsOrTopic.topic,
      curriculum: paramsOrTopic.curriculum || curriculum,
      event_id: paramsOrTopic.eventId || paramsOrTopic.event_id || null,
      attachment_name: paramsOrTopic.attachment_name || null,
      attachment_type: paramsOrTopic.attachment_type || null,
      attachment_text: paramsOrTopic.attachment_text || null,
      attachment_data: paramsOrTopic.attachment_data || null,
    };
  } else {
    body = {
      topic: paramsOrTopic,
      curriculum,
      event_id: eventId,
    };
  }

  return apiFetch('/api/notes/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getMyNotesApi() {
  return apiFetch('/api/notes');
}

export async function updateNoteApi(noteId, titleOrData, maybeContent, maybeCurriculumTag) {
  let body = {};
  if (typeof titleOrData === 'object' && titleOrData !== null) {
    body = titleOrData;
  } else {
    body = {
      title: titleOrData,
      content: maybeContent,
      curriculum_tag: maybeCurriculumTag,
    };
  }

  return apiFetch(`/api/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function shareNoteToGroupApi(noteId, groupId) {
  return apiFetch(`/api/notes/${noteId}/share/${groupId}`, {
    method: 'POST',
  });
}

export async function deleteNoteApi(noteId) {
  return apiFetch(`/api/notes/${noteId}`, {
    method: 'DELETE',
  });
}
