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

export async function startPersonalizedQuizApi({ topic, difficulty, file }) {
  if (file) {
    const body = new FormData();
    body.append('file', file);
    body.append('difficulty', difficulty);
    return apiFetch('/api/quiz/personalized/from-pdf', { method: 'POST', body });
  }
  return apiFetch('/api/quiz/personalized/generate', {
    method: 'POST', body: JSON.stringify({ topic, difficulty }),
  });
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
