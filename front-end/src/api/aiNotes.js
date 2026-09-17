import { apiFetch, API_BASE_URL } from './client';

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
      style: paramsOrTopic.style || 'standard',
    };
  } else {
    body = {
      topic: paramsOrTopic,
      curriculum,
      event_id: eventId,
      style: 'standard',
    };
  }

  return apiFetch('/api/notes/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function generateHandwrittenNoteApi(noteId) {
  return apiFetch(`/api/notes/${noteId}/handwritten`, {
    method: 'POST',
  });
}

export async function reviseNoteApi(noteId, instruction) {
  return apiFetch(`/api/notes/${noteId}/revise`, {
    method: 'POST',
    body: JSON.stringify({ instruction }),
  });
}

export async function getNoteThreadApi(noteId) {
  return apiFetch(`/api/notes/${noteId}/thread`);
}

export async function getMyNotesApi() {
  return apiFetch('/api/notes');
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

export async function getWalletApi() {
  return apiFetch('/api/wallet/me');
}

export async function getShopPacksApi() {
  return apiFetch('/api/shop/packs');
}

export async function purchasePackApi(packId, idempotencyKey = null) {
  const options = { method: 'POST' };
  if (idempotencyKey) {
    options.headers = { 'Idempotency-Key': idempotencyKey };
  }
  return apiFetch(`/api/shop/purchase/${packId}`, options);
}

async function streamSseReader(res, onDelta, onNoteSaved) {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Network or server error' }));
    const error = new Error(errorData.detail || 'An error occurred during streaming');
    error.status = res.status;
    error.data = errorData;
    throw error;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // preserve trailing partial line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const rawData = trimmed.slice(6);
      if (rawData === '[DONE]') break;

      try {
        const parsed = JSON.parse(rawData);
        if (parsed.delta && onDelta) {
          onDelta(parsed.delta);
        }
        if (parsed.note && onNoteSaved) {
          onNoteSaved(parsed.note);
        }
      } catch (err) {
        console.warn('Failed to parse SSE chunk:', rawData, err);
      }
    }
  }
}

export async function streamGenerateNoteApi({ payload, onDelta, onNoteSaved, signal }) {
  const token = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE_URL}/api/notes/generate/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  return streamSseReader(res, onDelta, onNoteSaved);
}

export async function streamContinueConversationApi({ noteId, payload, onDelta, onNoteSaved, signal }) {
  const token = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE_URL}/api/notes/${noteId}/continue/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  return streamSseReader(res, onDelta, onNoteSaved);
}
