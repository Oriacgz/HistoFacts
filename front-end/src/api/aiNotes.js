import { readNoteEvents } from '../features/ai-notes/sse';
import { apiFetch, authenticatedFetch } from './client';
import { runRecoverableResearch } from '../features/ai-notes/researchRecovery';

export async function generateNoteApi(paramsOrTopic, curriculum = 'General History', eventId = null) {
  const body =
    typeof paramsOrTopic === 'object' && paramsOrTopic !== null
      ? {
          topic: paramsOrTopic.topic,
          curriculum: paramsOrTopic.curriculum || curriculum,
          event_id: paramsOrTopic.eventId || paramsOrTopic.event_id || null,
          attachment_name: paramsOrTopic.attachment_name || null,
          attachment_type: paramsOrTopic.attachment_type || null,
          attachment_text: paramsOrTopic.attachment_text || null,
          attachment_data: paramsOrTopic.attachment_data || null,
          style: paramsOrTopic.style || 'standard',
          think: Boolean(paramsOrTopic.think),
          research_mode: paramsOrTopic.research_mode || 'off',
          research_request_id: paramsOrTopic.research_request_id || null,
          research_depth: paramsOrTopic.research_depth || 'standard',
        }
      : {
          topic: paramsOrTopic,
          curriculum,
          event_id: eventId,
          style: 'standard',
        };

  return apiFetch('/api/notes/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function generateHandwrittenNoteApi(noteId, think = false) {
  return apiFetch(`/api/notes/${noteId}/handwritten`, {
    method: 'POST',
    body: JSON.stringify({think}),
  });
}

export async function reviseNoteApi(noteId, instruction, think = false) {
  return apiFetch(`/api/notes/${noteId}/revise`, {
    method: 'POST',
    body: JSON.stringify({ instruction, think }),
  });
}

export async function getNoteThreadApi(noteId) {
  return apiFetch(`/api/notes/${noteId}/thread`);
}

export function getSharedNoteApi(noteId) {
  return apiFetch(`/api/notes/${noteId}/shared`);
}

export async function getMyNotesApi() {
  return apiFetch('/api/notes');
}

export async function shareNoteApi(noteId, conversationIds) {
  return apiFetch(`/api/notes/${noteId}/share`, {
    method: 'POST',
    body: JSON.stringify({ conversation_ids: conversationIds }),
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

async function streamSseReader(res, onDelta, onNoteSaved, onResearch, onContext) {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Network or server error' }));
    const error = new Error(errorData.detail || 'An error occurred during streaming');
    error.status = res.status;
    error.data = errorData;
    throw error;
  }

  if (!res.body) {
    throw new Error('ReadableStream not supported by response body');
  }

  return readNoteEvents(res.body, parsed => {
    if (parsed.error) throw new Error(parsed.error);
    if (parsed.research) onResearch?.(parsed.research);
    if (parsed.context) onContext?.(parsed.context);
    if (parsed.delta) onDelta?.(parsed.delta);
    if (parsed.note) onNoteSaved?.(parsed.note, {token_balance:parsed.token_balance,tokens_used:parsed.tokens_used});
  });
}

export async function streamGenerateNoteApi({ payload, onDelta, onNoteSaved, onResearch, onContext, signal, owner, _recovering = false }) {
  if (payload.research_mode === 'web' && owner && !_recovering) {
    return runRecoverableResearch({owner, root:null, payload, onDelta, onNoteSaved, onResearch, signal,
      send:(next,callbacks) => streamGenerateNoteApi({payload:next,...callbacks,owner,_recovering:true})});
  }
  const headers = {
    'Content-Type': 'application/json',
  };

  const res = await authenticatedFetch('/api/notes/generate/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
    expectedUserId:owner,
  });

  return streamSseReader(res, onDelta, onNoteSaved, onResearch, onContext);
}

export async function streamContinueConversationApi({ noteId, payload, onDelta, onNoteSaved, onResearch, onContext, signal, owner, _recovering = false }) {
  if (payload.research_mode === 'web' && owner && !_recovering) {
    return runRecoverableResearch({owner, root:noteId, payload, onDelta, onNoteSaved, onResearch, signal,
      send:(next,callbacks) => streamContinueConversationApi({noteId,payload:next,...callbacks,owner,_recovering:true})});
  }
  const headers = {
    'Content-Type': 'application/json',
  };

  const res = await authenticatedFetch(`/api/notes/${noteId}/continue/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
    expectedUserId:owner,
  });

  return streamSseReader(res, onDelta, onNoteSaved, onResearch, onContext);
}

export function getResearchStatusApi() {
  return apiFetch('/api/notes/research/status');
}

export function cancelSessionGenerationApi(root, operationId, owner) {
  return apiFetch(`/api/notes/sessions/${root}/context/cancel`, {
    method:'POST',expectedUserId:owner,keepalive:true,body:JSON.stringify({operation_id:operationId}),
  });
}
