import { BookOpen } from 'lucide-react';

export default function MarkdownBlockViewer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="space-y-4 text-histo-ink font-body leading-relaxed max-w-none">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        if (trimmed.startsWith('# ')) {
          return (
            <div key={idx} className="pb-2 border-b border-histo-copper/20 pt-1 mb-3">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-histo-dark tracking-tight">
                {trimmed.replace(/^#\s+/, '')}
              </h1>
            </div>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <div key={idx} className="pt-4 pb-1.5 flex items-center gap-2 border-b border-histo-dark/10 text-histo-dark">
              <h2 className="font-display text-base sm:text-lg font-bold tracking-wide text-histo-dark">
                {trimmed.replace(/^##\s+/, '')}
              </h2>
            </div>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="font-display text-sm sm:text-base font-bold text-histo-dark pt-2">
              {trimmed.replace(/^###\s+/, '')}
            </h3>
          );
        }

        if (trimmed.startsWith('>')) {
          return (
            <div
              key={idx}
              className="p-3 my-2 bg-histo-copper/5 border-l-3 border-histo-copper rounded-r-md italic font-body text-sm text-histo-ink/90"
            >
              {trimmed.replace(/^>\s*/, '')}
            </div>
          );
        }

        if (/^\d+\.\s+/.test(trimmed)) {
          const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
          if (numberMatch) {
            return (
              <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-1">
                <span className="h-5 w-5 rounded-full bg-histo-copper/15 text-histo-copper font-ui font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  {numberMatch[1]}
                </span>
                <div
                  className="font-body text-sm text-histo-ink flex-1 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: numberMatch[2].replace(/\*\*(.*?)\*\*/g, '<strong class="text-histo-dark font-semibold">$1</strong>'),
                  }}
                />
              </div>
            );
          }
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const rawText = trimmed.replace(/^[-*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2.5 my-1 pl-2">
              <span className="h-1.5 w-1.5 rounded-full bg-histo-copper shrink-0 mt-2" />
              <div
                className="font-body text-sm text-histo-ink flex-1 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: rawText.replace(/\*\*(.*?)\*\*/g, '<strong class="text-histo-dark font-semibold">$1</strong>'),
                }}
              />
            </div>
          );
        }

        if (trimmed.startsWith('**Curriculum Scope:**')) {
          return (
            <div key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-histo-cream border border-histo-copper/20 rounded-md font-ui text-xs text-histo-dark font-medium mb-2">
              <BookOpen className="h-3 w-3 text-histo-copper" />
              <span>{trimmed.replace(/\*\*/g, '')}</span>
            </div>
          );
        }

        return (
          <p
            key={idx}
            className="font-body text-sm text-histo-ink/90 leading-relaxed my-1"
            dangerouslySetInnerHTML={{
              __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-histo-dark font-semibold">$1</strong>'),
            }}
          />
        );
      })}
    </div>
  );
}
