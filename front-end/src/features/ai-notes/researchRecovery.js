import { apiFetch } from '../../api/client';

const key = (owner, root) => `histofacts_research_pending_${owner}_${root || 'new'}`;
export function pendingResearch(owner, root) {
  if (!owner) return null;
  try {
    const value = JSON.parse(localStorage.getItem(key(owner, root)) || 'null');
    return value?.requestId && value.owner === owner ? value : null;
  } catch { return null; }
}
export function clearPendingResearch(owner, root, requestId) {
  if (pendingResearch(owner, root)?.requestId === requestId) localStorage.removeItem(key(owner, root));
}
export function researchRunStatus(owner, requestId, signal) {
  return apiFetch(`/api/notes/research/runs/${requestId}`, {expectedUserId:owner, signal});
}
export function cancelResearchRun(owner, requestId) {
  return apiFetch(`/api/notes/research/runs/${requestId}/cancel`, {method:'POST', expectedUserId:owner, keepalive:true});
}
const fingerprint = (root, payload) => JSON.stringify([root || null, payload.topic || payload.message, Boolean(payload.think), payload.research_depth || 'standard']);

async function waitForRun(owner, pending, signal, onResearch) {
  const deadline = Date.now() + 185000;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    let status;
    try { status = await researchRunStatus(owner, pending.requestId, signal); }
    catch (error) { if (error.status === 404) return {state:'not_found'}; throw error; }
    if (status.state !== 'running') return status;
    onResearch?.({stage:'recovering',run_id:pending.requestId});
    await new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); cancelResearchRun(owner,pending.requestId).catch(() => {}); reject(signal.reason || new DOMException('Stopped','AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort',abort); resolve(); }, 700);
      signal?.addEventListener('abort',abort,{once:true});
    });
  }
  throw new Error('Research status could not be confirmed. Your request is retained; retry to check it without starting another charge.');
}

export async function runRecoverableResearch({owner, root, payload, send, onResearch, onDelta, onNoteSaved, signal}) {
  let pending = pendingResearch(owner, root);
  const sameQuestion = !pending || pending.fingerprint === fingerprint(root, payload);
  async function finish(status) {
    signal?.throwIfAborted();
    if (status.note) {
      onNoteSaved?.(status.note, sameQuestion ? {} : {retained_prompt:payload.topic || payload.message});
      clearPendingResearch(owner, root, pending.requestId);
      return true;
    }
    return false;
  }
  if (pending) {
    const status = await waitForRun(owner, pending, signal, onResearch);
    if (await finish(status)) return;
    if (status.state === 'failed' || status.state === 'cancelled') {
      clearPendingResearch(owner, root, pending.requestId);
      pending = null;
    } else if (status.state !== 'not_found' || !sameQuestion) {
      throw new Error('A previous research request is unresolved. Restore its original question to recover it before starting another.');
    }
  }
  signal?.throwIfAborted();
  if (!pending) {
    pending = {owner, root:root || null, requestId:crypto.randomUUID(), fingerprint:fingerprint(root,payload),
               prompt:payload.topic || payload.message, payload, createdAt:Date.now()};
    // If durable storage fails, do not send a billable request with no recovery ID.
    localStorage.setItem(key(owner, root), JSON.stringify(pending));
  }
  let saved = false;
  const stop = () => { cancelResearchRun(owner,pending.requestId).catch(() => {}); };
  signal?.addEventListener('abort',stop,{once:true});
  try {
    await send({...pending.payload, research_request_id:pending.requestId}, {
      onResearch, onDelta,
      onNoteSaved: (note, metadata) => {
        if (signal?.aborted) return;
        saved = true;
        onNoteSaved?.(note,metadata);
        clearPendingResearch(owner,root,pending.requestId);
      }, signal,
    });
    if (!saved) {
      const status = await waitForRun(owner,pending,signal,onResearch);
      if (!await finish(status)) throw new Error('Research ended without a saved answer. Your draft is retained.');
    }
  } catch (error) {
    if (saved) return;
    if (!signal?.aborted && !saved) {
      try {
        const status = await waitForRun(owner,pending,signal,onResearch);
        if (await finish(status)) return;
        if (['failed','cancelled'].includes(status.state)) clearPendingResearch(owner,root,pending.requestId);
      } catch { /* Retain the stable request ID whenever completion is unknown. */ }
    }
    throw error;
  } finally {
    signal?.removeEventListener('abort',stop);
  }
}
