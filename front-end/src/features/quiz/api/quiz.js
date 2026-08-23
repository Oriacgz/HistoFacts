import { apiFetch } from '../../../api/client';

export async function getQuizQuestionsApi(topic = '') {
  const params = topic ? `?topic=${encodeURIComponent(topic)}` : '';
  return apiFetch(`/api/quiz/questions${params}`);
}

export async function submitQuizAttemptApi(sessionId, questionId, selectedOption) {
  return apiFetch('/api/quiz/attempt', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      question_id: questionId,
      selected_option: selectedOption,
    }),
  });
}

export async function getQuizResultsSummaryApi(sessionId) {
  return apiFetch(`/api/quiz/results/${sessionId}`);
}

export async function getGlobalQuizQuestionsApi() {
  return apiFetch('/api/quiz/global/questions');
}

export async function submitGlobalQuizApi(answers) {
  return apiFetch('/api/quiz/global/submit', {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

export async function getGlobalLeaderboardApi(page = 1, limit = 50) {
  return apiFetch(`/api/quiz/global/leaderboard?page=${page}&limit=${limit}`);
}

export async function getGlobalLeaderboardInfoApi() {
  return apiFetch('/api/quiz/global/leaderboard/info');
}

export async function getQuizHistoryApi({ type, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (type) params.append('type', type);
  return apiFetch(`/api/quiz/history?${params.toString()}`);
}

export async function getQuizAttemptDetailApi(attemptId) {
  return apiFetch(`/api/quiz/history/${attemptId}`);
}

export async function createLobbySessionApi(quizId) {
  return apiFetch('/api/quiz/lobby/create', {
    method: 'POST',
    body: JSON.stringify({ quiz_id: quizId }),
  });
}

export async function getLobbySessionApi(roomCode) {
  return apiFetch(`/api/quiz/lobby/${roomCode}`);
}

export async function joinLobbyApi(roomCode, playerName) {
  return apiFetch(`/api/quiz/lobby/${roomCode}/join`, {
    method: 'POST',
    body: JSON.stringify({ player_name: playerName }),
  });
}