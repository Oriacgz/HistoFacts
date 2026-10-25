import { BookOpen, ExternalLink } from 'lucide-react';

export default function ResearchSources({ research }) {
  if (!research?.sources?.length) return null;
  return (
    <details className="mt-3 rounded-lg border border-histo-copper/25 bg-histo-cream/40 p-3 text-sm">
      <summary className="cursor-pointer font-ui font-semibold text-histo-dark">
        <BookOpen className="inline h-4 w-4 mr-2" />
        {research.sources.some(source => source.fixture) ? 'Test fixture sources' : research.outcome === 'limited' ? 'Limited web evidence' : research.outcome === 'disagreement' ? 'Sources contain differing accounts' : 'Web-researched'} · {research.sources.length} sources
      </summary>
      <p className="mt-2 text-xs text-histo-ink/70">References and excerpts were checked. This does not guarantee historical accuracy.</p>
      {research.retrieval_mode === 'saved_evidence' && <p className="mt-2 text-xs text-histo-ink/70">Rechecked against saved evidence. Sources were not fetched again; original retrieval dates are shown.</p>}
      <ol className="mt-3 space-y-4 list-none p-0">
        {research.sources.map(source => (
          <li key={source.id} id={`source-${research.run_id}-${source.id}`}>
            <a className="font-semibold text-histo-copper break-words" href={source.url} target="_blank" rel="noopener noreferrer">
              [{source.id}] {source.title} <ExternalLink className="inline h-3 w-3" />
            </a>
            <p className="text-xs text-histo-ink/60">Retrieved {source.retrieved_at?.slice(0, 10)}</p>
            {(source.author || source.institution) && <p className="text-xs text-histo-ink/60">{source.author || source.institution}</p>}
            {source.published_at && <p className="text-xs text-histo-ink/60">Published {source.published_at}{source.updated_at ? ` · updated ${source.updated_at}` : ''}</p>}
            {source.limitations?.failed_sources > 0 && <p className="text-xs text-amber-800">{source.limitations.failed_sources} source(s) could not be used. {source.limitations.messages?.join(' ')}</p>}
            {source.excerpts_expired && <p className="text-xs text-histo-ink/60">Supporting excerpts expired after 30 days. Open the source or research again for fresh evidence.</p>}
            {source.passages?.map(passage => (
              <blockquote key={passage.id} className="mt-2 border-l-2 border-histo-copper/30 pl-3 text-xs text-histo-ink/80">{passage.text}</blockquote>
            ))}
          </li>
        ))}
      </ol>
    </details>
  );
}
