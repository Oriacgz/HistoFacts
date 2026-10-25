import { apiFetch } from './client';

export async function getQuizHistoryApi(limit = 20, offset = 0) {
  return apiFetch(`/api/quiz/history?limit=${limit}&offset=${offset}`);
}

export async function getQuizHistoryDetailApi(sessionId) {
  return apiFetch(`/api/quiz/history/${sessionId}`);
}

export async function getGlobalLeaderboardApi() {
  return apiFetch('/api/quiz/leaderboard');
}

export async function getHostableQuizzesApi() {
  return apiFetch('/api/quiz/lobby/quizzes');
}

export async function createLobbyApi(quizSessionId) {
  return apiFetch('/api/quiz/lobby/create', {
    method: 'POST', body: JSON.stringify({ quiz_session_id: quizSessionId }),
  });
}

export async function getLobbyInfoApi(code) {
  return apiFetch(`/api/quiz/lobby/${code}`);
}

export const QUIZ_REQUEST_TIMEOUT_MS = 180000;

export async function startPersonalizedQuizApi({ topic, difficulty, file, signal }) {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, {once:true});
  if (signal?.aborted) cancel();
  const timer = setTimeout(() => {timedOut=true;controller.abort();}, QUIZ_REQUEST_TIMEOUT_MS);
  try {
    if (file) {
      const body = new FormData();
      body.append('file', file);
      body.append('difficulty', difficulty);
      return await apiFetch('/api/quiz/personalized/from-pdf', { method: 'POST', body, signal:controller.signal });
    }
    return await apiFetch('/api/quiz/personalized/generate', {
      method: 'POST', body: JSON.stringify({ topic, difficulty }), signal:controller.signal,
    });
  } catch(error) {
    if (timedOut) throw new Error('Quiz generation took too long. Please try again when the local model is less busy.', {cause:error});
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort',cancel);
  }
}

export async function startGlobalQuizApi() {
  return apiFetch('/api/quiz/global/start', { method: 'POST' });
}

export async function getCurrentGlobalQuizApi() {
  return apiFetch('/api/quiz/global/current');
}

export async function completeQuizApi(sessionId, questions, answers, duration) {
  return apiFetch(`/api/quiz/sessions/${sessionId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ answers: Object.fromEntries(questions.map((q, i) => [q.id, answers[i]])), total_time_seconds: duration }),
  });
}

export async function endLobbyApi(code) {
  return apiFetch(`/api/quiz/lobby/${code}/end`, { method: 'POST' });
}
