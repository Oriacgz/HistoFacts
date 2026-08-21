import { apiFetch } from './client';

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
