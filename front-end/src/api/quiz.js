import { apiFetch } from './client';

export async function getQuizQuestionsApi(topic = '') {
  const params = topic ? `?topic=${encodeURIComponent(topic)}` : '';
  return apiFetch(`/api/quiz/questions${params}`);
}

export async function generateQuizApi({ topic = '', sourceType = 'topic', pdfText = '', difficulty = 'medium', count = 10 }) {
  return apiFetch('/api/quiz/generate', {
    method: 'POST',
    body: JSON.stringify({
      topic,
      source_type: sourceType,
      pdf_text: pdfText,
      difficulty,
      count,
    }),
  });
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

export async function saveQuizSessionApi(sessionData) {
  return apiFetch('/api/quiz/session', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
}

export async function getQuizHistoryApi() {
  return apiFetch('/api/quiz/history');
}

export async function getQuizHistoryDetailApi(sessionId) {
  return apiFetch(`/api/quiz/history/${sessionId}`);
}

export async function getGlobalLeaderboardApi() {
  return apiFetch('/api/quiz/leaderboard');
}

export async function createLobbyApi({ topic = 'History Trivia', difficulty = 'medium', count = 10 }) {
  return apiFetch('/api/quiz/lobby/create', {
    method: 'POST',
    body: JSON.stringify({
      topic,
      difficulty,
      count,
    }),
  });
}

export async function getLobbyInfoApi(code) {
  return apiFetch(`/api/quiz/lobby/${code}`);
}
