import { Search, FileText, Link, CheckCircle } from 'lucide-react';

const stages = {
  started: ['Finding historical sources…', Search],
  searching: ['Finding historical sources…', Search],
  reading: ['Reading public sources…', FileText],
  checking: ['Preparing answer and checking source support…', Link],
  recovering: ['Checking your previous research request…', Link],
  complete: ['Research saved', CheckCircle],
};

export default function ResearchProgress({ progress }) {
  if (!progress) return null;
  const [label, Icon] = stages[progress.stage] || stages.started;
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-4xl px-4 py-2 flex items-center gap-2 text-xs font-ui text-histo-copper motion-safe:animate-pulse">
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}{progress.stage === 'reading' && progress.total ? ` · ${progress.completed} of ${progress.total}` : ''}</span>
    </div>
  );
}
