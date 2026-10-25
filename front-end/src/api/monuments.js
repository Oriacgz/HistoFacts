import { apiFetch } from './client';

export async function getMonumentLearning(signal,accountId) {
  const [favorites, completions] = await Promise.all([
    apiFetch('/api/monuments/favorites', {signal,expectedUserId:accountId}),
    apiFetch('/api/monuments/progress', {signal,expectedUserId:accountId}),
  ]);
  return {favorites,completions};
}

export function setMonumentFavorite({monumentId,saved,accountId}) {
  return apiFetch(`/api/monuments/favorites/${encodeURIComponent(monumentId)}`, {method:saved?'PUT':'DELETE',expectedUserId:accountId});
}

export function completeMonumentTour({monumentId,tourRevision,accountId}) {
  return apiFetch(`/api/monuments/progress/${encodeURIComponent(monumentId)}`, {method:'PUT',body:JSON.stringify({tour_revision:tourRevision}),expectedUserId:accountId});
}
