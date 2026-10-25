import registry from './data/registry.generated.json';

export function getMonumentStudy(id) {
  const monument=registry.find(entry=>entry.id===id);
  if (!monument) return null;
  return {
    id:monument.id,name:monument.name,
    quizTopic:`${monument.name}: history and architecture`,
    notesPrompt:`Create study notes about ${monument.name}. Cover its historical context, architecture, cultural significance, and key dates. Distinguish established evidence from uncertainty and cite reliable sources.`,
  };
}
